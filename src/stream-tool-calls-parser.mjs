import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";
import { z } from "zod";

// 初始化大语言模型
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 定义期望输出的数据结构
const scientistSchema = z.object({
  name: z.string().describe("科学家的全名"),
  birth_year: z.number().describe("出生年份"),
  death_year: z.number().optional().describe("去世年份，如果还在世则不填"),
  nationality: z.string().describe("国籍"),
  fields: z.array(z.string()).describe("研究领域列表"),
  achievements: z.array(z.string()).describe("主要成就"),
  biography: z.string().describe("简短传记"),
});

// 绑定工具定义
const modelWithTool = model.bindTools([
  {
    name: "extract_scientist_info",
    description: "提取和结构化科学家的详细信息",
    schema: scientistSchema,
  },
]);

// 1. 【实例化工具调用解析器并挂载】
// JsonOutputToolsParser 会自动捕获大模型输出中的 tool_calls，
// 并且在流式输出中，它会在底层自动合并每次产出的 tool_call 碎片，
// 生成一个个不断被补全的、处于“半解析状态”的 JSON 结构化对象（Partial JSON）。
const parser = new JsonOutputToolsParser();
const chain = modelWithTool.pipe(parser); // 使用管道链式挂载解析器

try {
  // 2. 开启流
  const stream = await chain.stream("详细介绍牛顿的生平和成就");

  let lastContent = "";   // 记录上一轮已经输出的完整字符串
  let finalResult = null; // 存储最终解析成功的完整对象

  console.log("📡 实时输出流式内容 (输出已解析的 Partial JSON 差异分片):\n");

  for await (const chunk of stream) {
    // 3. 【消费解析出的 Tool Call 数据块】
    // 这里的 chunk 通常是一个数组，包含当前已合并解析出来的工具调用列表
    if (chunk.length > 0) {
      const toolCall = chunk[0];
      finalResult = toolCall.args; // 记录最新、最全的参数对象

      // 4. 将当前解析出来的完整参数对象格式化为 JSON 字符串
      const currentContent = JSON.stringify(toolCall.args || {}, null, 2);

      // 5. 【实现打字机效果】
      // 由于 chunk 包含的是“从头累加到当前为止的完整 JSON 内容”，
      // 我们通过比对当前内容长度与上一轮长度，裁剪出“新增的文本分片”并输出到控制台。
      if (currentContent.length > lastContent.length) {
        const newText = currentContent.slice(lastContent.length);
        process.stdout.write(newText); // 实时输出新增片段到控制台
        lastContent = currentContent;  // 更新上一轮的进度
      }
    }
  }

  console.log("\n\n✅ 流式输出完成");
  console.log("📊 最终提取的结构化结果:", finalResult);
} catch (error) {
  console.error("\n❌ 错误:", error.message);
  console.error(error);
}
