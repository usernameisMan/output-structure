# LangChain 结构化输出与解析器教程 (LangChain Structured Outputs & Output Parsers)

这是一个针对 LangChain (JavaScript/TypeScript) 结构化输出与输出解析器的教学演示项目。本项目展示了如何从大语言模型（LLM）中获取可预测、强类型的结构化数据（如 JSON、XML），并针对国产大模型（如通义千问 Qwen、DeepSeek）进行了兼容性最佳实践总结。

---

## 💡 核心概念

在 LangChain 中，获取结构化输出主要有以下四种途径，本项目对这四种途径均有详细的代码演示：

| 途径 | 实现方式 | 兼容性 (国产模型) | 优缺点 |
| :--- | :--- | :--- | :--- |
| **1. 提示词解析器 (Prompt-based)** | 使用 `StructuredOutputParser` 或 `XMLOutputParser` 拼接格式化指令到 Prompt。 | **100% 完美兼容** | 🟢 兼容所有模型，支持流式。<br>🔴 依赖模型遵循 Prompt 的能力，偶尔会跑偏。 |
| **2. API 级 JSON 模式 (jsonMode)** | 配置 `withStructuredOutput(schema, { method: "jsonMode" })`。 | **极高**（需微调 Prompt） | 🟢 强制模型输出合法 JSON 语法。<br>🔴 接口校验严格，Prompt 必须包含 `"json"` 单词，且不限字段名。 |
| **3. 工具调用 (Tool Calling)** | 使用 `bindTools([schema])` 或 `withStructuredOutput(schema, { method: "functionCalling" })`。 | **中等**（受制于思考模式） | 🟢 格式化精度最高，不易跑偏。<br>🔴 推理/思考模型（如 R1、Qwen 思考版）在思考时无法指定 `tool_choice`。 |
| **4. 原生 JSON Schema** | `withStructuredOutput(schema)` 默认方式（即 `jsonSchema` 方式）。 | **极低** | 🟢 最完美的 OpenAI 原生体验。<br>🔴 目前国产模型兼容接口基本都不支持。 |

---

## 📂 文件目录与学习路线

项目中的所有演示文件均存放在 `src/` 目录下，并附有极其详尽的步骤注释。推荐学习顺序如下：

### 基础入门篇
*   [normal.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/normal.mjs) **(普通调用与原生解析)**：展示最基础的 LLM 调用，并演示手工 `JSON.parse` 面对 Markdown 代码块时的局限。
*   [json-output-parser.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/json-output-parser.mjs) **(通用 JSON 解析器)**：使用 `JsonOutputParser` 自动清洗大模型返回文本首尾的 Markdown 标记。

### 解析器深度篇 (Output Parsers)
*   [structured-output-parser.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/structured-output-parser.mjs) **(简单字段解析)**：使用 `fromNamesAndDescriptions` 进行扁平结构的数据反序列化。
*   [structured-output-parser2.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/structured-output-parser2.mjs) **(复杂 Schema 校验)**：结合 `zod` 定义支持**嵌套对象、数组、可选字段**的复杂 Schema，并进行强类型断言及 `ZodError` 捕获。
*   [xml-output-parser.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/xml-output-parser.mjs) **(XML 解析器)**：演示如何在非 JSON 优先或文档抽取场景中，利用大模型对 XML 标签的高敏感度完成结构化数据解析。

### 工具调用篇 (Tool Calling)
*   [tool-calls-args.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/tool-calls-args.mjs) **(原始 Tool Calls 提取)**：利用 API 的 `bindTools` 机制，直接从 `response.tool_calls[0].args` 读取已解析的 JS 对象。
*   [with-structured-output.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/with-structured-output.mjs) **(高阶封装调用)**：介绍 LangChain 官方的 `withStructuredOutput` 捷径，并展示如何使用 `jsonMode` 兼容国产大模型。
*   [smart-import.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/smart-import.mjs) **(实战：好友信息提取与批量入库)**：利用 `withStructuredOutput` 结合 `functionCalling` 模式抽取文本中多个人物的好友信息，并自动写入 MySQL 数据库。

### 进阶流式输出篇 (Streaming)
*   [stream-normal.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/stream-normal.mjs) **(基础流式传输)**：演示 `model.stream()`、`for await...of` 异步迭代器以及打字机实时输出效果。
*   [stream-structured-partial.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/stream-structured-partial.mjs) **(流式输出后置解析)**：展示一边以打字机模式输出原始文本，流结束后立即进行 Zod 强校验的经典流程。
*   [stream-with-structured-output.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/stream-with-structured-output.mjs) **(高阶封装流模式)**：结合 `withStructuredOutput` 消费解析完毕的流数据。
*   [stream-tool-calls-raw.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/stream-tool-calls-raw.mjs) **(工具流原始数据)**：流式接收并打印工具调用的原始参数增量片段 `tool_call_chunks`。
*   [stream-tool-calls-parser.mjs](file:///Users/aaxis/Documents/code/agent/output-parser-test/src/stream-tool-calls-parser.mjs) **(半解析 Partial JSON 流式输出)**：利用 `JsonOutputToolsParser` 配合字符串裁剪算法，实现**将解析后的 Partial JSON 结构体以打字机效果增量打印在控制台**的高级技巧。

---

## ⚠️ 国产模型 (Qwen / DeepSeek) 兼容踩坑与避坑指南

在对接国产大模型（如通义千问 `qwen3.7-plus`、`deepseek-chat`）的 OpenAI 兼容接口时，请牢记以下四条黄金准则：

### 1. 强制启用 `jsonMode` 并补齐 Prompt
国产模型大多不支持默认的 `json_schema` 格式参数。你必须显式指定 `method: "jsonMode"`：
```javascript
const structuredModel = model.withStructuredOutput(schema, {
  method: "jsonMode",
});
```
**关键**：一旦开启了 `jsonMode`，你的 Prompt 中**必须**包含 `"json"` 或 `"JSON"` 关键字（大小写不限），否则接口会直接返回 400 校验错误。

### 2. 在 `jsonMode` 模式下明示 Zod 字段约束
由于 `jsonMode` 仅能在 API 协议上限制“输出必须是合法 JSON 语法”，但**不约束 JSON 里面的具体字段名**。如果 Prompt 中没有列出所需字段，模型极易输出拼写不一致的 Key（例如将 `birth_year` 写成 `birthDate`），进而触发 Zod 校验失败。
*   **最佳实践**：在 Prompt 中明确写出你期望模型输出的字段名和类型。

### 3. 规避“思考/推理模式”下的 Tool Choice 冲突
如果模型（如 Qwen 3.7 / DeepSeek R1）开启了 Reasoning（深度思考/Thinking 模式）：
*   API 限制在思考期间不能强行指定特定的工具（即不能设置 `tool_choice` 参数为特定的工具或 `required`）。
*   此时如果使用 `method: "functionCalling"` 强行绑定工具，接口会报 400 错误。
*   **解决方案**：遇到此问题时，请降级回方案一（`JsonOutputParser`）或方案二（`jsonMode` 并明示 Prompt）。

### 4. 国产大模型（不支持 json_schema）下输出数组（Array）Schema 的三要素
如果你使用国产大模型并且需要让 `withStructuredOutput` 稳定输出数组 Schema（例如 `z.array(schema)`），必须满足以下三个核心要素才能成功复刻 `smart-import` 这种 demo：
1. **关闭思考模式 (Thinking)**：如果模型开启了思考模式，会导致 Tool Calling 报错。必须显式关闭思考模式（例如在配置 `ChatOpenAI` 初始化时，使用 `modelKwargs: { thinking: { type: "disabled" } }`）。
2. **必须使用 `z.object` 包裹顶层**：因为 Tool/Function Calling 规范限制工具参数的顶层必须是 object，不能是 array。因此不能直接传 `z.array(...)`，必须包裹成对象结构，如：`z.object({ friends: z.array(friendSchema).describe("好友信息数组") })`。
3. **设置 `method: "functionCalling"`**：显式指定为工具调用方式。

**💻 核心代码示例：**

```javascript
// 1. 初始化模型时关闭思考模式
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: { baseURL: process.env.OPENAI_BASE_URL },
  modelKwargs: {
    thinking: { type: "disabled" }, 
  },
});

// 2. 使用 z.object 顶层包裹数组 Schema
const friendsArraySchema = z.object({
  friends: z.array(friendSchema).describe("好友信息数组"),
});

// 3. 显式指定为 functionCalling 模式
const structuredModel = model.withStructuredOutput(friendsArraySchema, {
  method: "functionCalling",
});

// 调用并提取结果
const response = await structuredModel.invoke(prompt);
const results = response.friends; // 获得干净的数组结果
```

> [!IMPORTANT]
> **为什么要用 `functionCalling` 模式？**
> 因为如果继续降级使用 `jsonMode`（即 JSON 字符串模式），API 接口无法事先获知具体的 Schema 字段结构。此时如果你不在 Prompt 中将期望的 key 英文名称在列表中描述清楚，大模型极其容易输出中文的 `"姓名": "张总"`、`"性别": "女"` 这种格式，进而导致本地 Zod 校验失败抛出 `OUTPUT_PARSING_FAILURE` 异常。而 `functionCalling` 模式会在 API 请求中带上 Schema 参数，让大模型在生成数据前就感知到格式，确保 100% 的准确率。
