/**
 * 【教学演示】Mini-Cursor Agent 引擎
 * 
 * 本文件展示了一个类似 Cursor/Claude Artifacts 的轻量级多轮对话 Agent 引擎。
 * 核心机制包含：
 * 1. 使用内存型对话历史记录（InMemoryChatMessageHistory）维护多轮交互上下文。
 * 2. 绑定本地文件操作与命令执行工具（Tool/Function Calling）。
 * 3. 采用“流式生成与双轨解析验证”架构：
 *    - 阶段一（只读流阶段）：在 for await...of 循环中实时流式接收模型输出。如果是普通思考文本，直接打字机输出给用户；
 *      如果是 write_file 工具调用，则利用 JsonOutputToolsParser 的 Partial JSON 修复机制，在不破坏消息结构的前提下进行增量 JSON 解析，为用户渲染炫酷的代码流式预览，但此时并不真正修改本地文件。
 *    - 阶段二（落盘执行阶段）：在流式接收完毕、确认 JSON 序列化无误且拼装出完整的 AIMessage 后，再依次真实调用本地工具修改文件或执行系统命令。
 */
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";
import {
  executeCommandTool,
  listDirectoryTool,
  readFileTool,
  writeFileTool,
} from "./all-tools.mjs";
import chalk from "chalk";

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  modelKwargs: {
    // 【国产模型避坑点 1】：使用 Tool/Function Calling 时，
    // 很多推理/思考模型（如 DeepSeek R1）若开启思考模式，在指定工具调用时可能因 API 冲突报错，故在此显式关闭
    thinking: { type: "disabled" },
  },
});

const tools = [
  readFileTool,
  writeFileTool,
  executeCommandTool,
  listDirectoryTool,
];

// 绑定工具到模型
const modelWithTools = model.bindTools(tools);

// Agent 执行函数
async function runAgentWithTools(query, maxIterations = 30) {
  const history = new InMemoryChatMessageHistory();

  await history.addMessage(
    new SystemMessage(`你是一个项目管理助手，使用工具完成任务。

当前工作目录: ${process.cwd()}

工具：
1. read_file: 读取文件
2. write_file: 写入文件
3. execute_command: 执行命令（支持 workingDirectory 参数）
4. list_directory: 列出目录

重要规则 - execute_command：
- workingDirectory 参数会自动切换到指定目录
- 当使用 workingDirectory 时，绝对不要在 command 中使用 cd
- 错误示例: { command: "cd react-todo-app && pnpm install", workingDirectory: "react-todo-app" }
- 正确示例: { command: "pnpm install", workingDirectory: "react-todo-app" }

重要规则 - write_file：
- 当写入 React 组件文件（如 App.tsx）时，如果存在对应的 CSS 文件（如 App.css），在其他 import 语句后加上这个 css 的导入
`),
  );

  await history.addMessage(new HumanMessage(query));

  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));

    // 获取当前消息历史
    const messages = await history.getMessages();

    // 开启流式响应，获取原始的流式 MessageChunk 异步迭代器
    const rawStream = await modelWithTools.stream(messages);

    // 准备一个空的容器来拼接完整的 AIMessage 对象。
    // 这对于多轮对话的 Agent 架构至关重要：在流结束后我们需要把包含完整 tool_calls 的 AIMessage 存入 history。
    // 如果这里使用 modelWithTools.pipe(toolParser).stream()，
    // 流中产出的数据将只有工具参数，从而丢失原始消息，导致下一次发送 ToolMessage 时报 ID 不匹配的 400 错误。
    let fullAIMessage = null;

    // 准备一个 tool_call_chunks 的 JSON 增量解析器。
    // 注意：该解析器内置了“半解析（Partial JSON）”修复机制，能自动补齐流式传输中不完整的 JSON 结构（如未闭合的双引号、括号等）。
    // 同时，它只解析 message 里的 tool_call_chunks 字段，会完全忽略 chunk.content 文本内容。
    const toolParser = new JsonOutputToolsParser();

    // 记录每个工具调用已打印的长度（用 id 或 filePath 作为 key），
    // 用于在打字机效果预览中，只打印本次迭代新增的代码字符，避免重复输出。
    const printedLengths = new Map();

    console.log(chalk.bgBlue(`\n🚀 Agent 开始思考并生成流...\n`));

    // ==========================================
    // 阶段一：流式生成与控制台预览 (只读，不写盘)
    // ==========================================
    for await (const chunk of rawStream) {
      // 这里的 chunk 是 AIMessageChunk，把它拼接起来以复原出最终完整的 AIMessage
      fullAIMessage = fullAIMessage ? fullAIMessage.concat(chunk) : chunk;

      let parsedTools = null;

      try {
        // 将当前已拼接的 fullAIMessage 传入解析器，尝试增量解析出工具参数
        parsedTools = await toolParser.parseResult([
          { message: fullAIMessage },
        ]);
      } catch (e) {
        // 在最开始几个 token 传输时，由于 JSON 太残缺（如只有一个 "{"），
        // 增量解析器修复失败会抛出异常，在此忽略异常，继续累积下一个 chunk 即可
      }

      if (parsedTools && parsedTools.length > 0) {
        // 如果成功解析出工具调用信息
        for (const toolCall of parsedTools) {
          // 这里我们专门监听 "write_file" 工具的 content 参数（即要写入文件的代码内容）
          if (toolCall.type === "write_file" && toolCall.args?.content) {
            const toolCallId =
              toolCall.id || toolCall.args.filePath || "default";
            const currentContent = String(toolCall.args.content);
            const previousLength = printedLengths.get(toolCallId);

            // 如果 previousLength 是 undefined，说明这是该工具第一次输出 content
            if (previousLength === undefined) {
              printedLengths.set(toolCallId, 0);
              // 仅在初次开始时打印一次醒目的标题，避免每次循环都重复打印标题
              console.log(
                chalk.bgBlue(
                  `\n[工具调用] write_file("${toolCall.args.filePath}") - 开始写入（流式预览）\n`,
                ),
              );
            }

            // 对比之前已打印的长度，只输出最新产生的增量代码片段，实现顺滑的打字机流式效果
            if (currentContent.length > previousLength) {
              const newContent = currentContent.slice(previousLength);
              process.stdout.write(newContent);
              printedLengths.set(toolCallId, currentContent.length);
            }
          }
        }
      } else {
        // 当前还没有解析出工具调用时（或者是纯聊天回复），如果有文本内容（chunk.content）就直接打字机输出。
        // 如果使用 .pipe() 方式，这部分普通的文本和模型的思考过程会被解析器彻底过滤吞掉。
        if (chunk.content) {
          process.stdout.write(
            typeof chunk.content === "string"
              ? chunk.content
              : JSON.stringify(chunk.content),
          );
        }
      }
    }

    // 此时 rawStream 的 for await 循环已彻底结束，fullAIMessage 已经完美复原并包含最终完整的参数 JSON。
    // 我们在此处将它存入对话历史记录中。
    await history.addMessage(fullAIMessage);
    console.log(chalk.green("\n✅ 消息已完整存入历史"));

    // 检查模型是否发起了工具调用。如果没有工具调用，说明 Agent 的任务已完成，返回最终文本回复。
    if (!fullAIMessage.tool_calls || fullAIMessage.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${fullAIMessage.content}\n`);
      return fullAIMessage.content;
    }

    // ==========================================
    // 阶段二：流结束，实际调用工具执行写盘/系统操作
    // ==========================================
    // 在这里我们遍历已完全接收的工具调用，依次真正执行它们
    for (const toolCall of fullAIMessage.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (foundTool) {
        // 调用 tool.invoke 实际写盘文件或执行系统命令
        const toolResult = await foundTool.invoke(toolCall.args);
        // 执行完后，必须返回 ToolMessage 并放入历史记录，告诉大模型该步骤的真实执行结果，以便模型进行下一轮思考
        await history.addMessage(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
          }),
        );
      }
    }
  }

  const finalMessages = await history.getMessages();
  return finalMessages[finalMessages.length - 1].content;
}

const case1 = `创建一个功能丰富的 React TodoList 应用：

1. 创建项目：echo -e "n\nn" | pnpm create vite react-todo-app --template react-ts
2. 修改 src/App.tsx，实现完整功能的 TodoList：
 - 添加、删除、编辑、标记完成
 - 分类筛选（全部/进行中/已完成）
 - 统计信息显示
 - localStorage 数据持久化
3. 添加复杂样式：
 - 渐变背景（蓝到紫）
 - 卡片阴影、圆角
 - 悬停效果
4. 添加动画：
 - 添加/删除时的过渡动画
 - 使用 CSS transitions
5. 列出目录确认

注意：使用 pnpm，功能要完整，样式要美观，要有动画效果

去掉 main.tsx 里的 index.css 导入

之后在 react-todo-app 项目中：
1. 使用 pnpm install 安装依赖
2. 使用 pnpm run dev 启动服务器
`;

try {
  await runAgentWithTools(case1);
} catch (error) {
  console.error(`\n❌ 错误: ${error.message}\n`);
}
