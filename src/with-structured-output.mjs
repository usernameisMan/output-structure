import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
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

// 定义结构化输出的 Zod Schema
const scientistSchema = z.object({
  name: z.string().describe("科学家的全名"),
  birth_year: z.number().describe("出生年份"),
  nationality: z.string().describe("国籍"),
  fields: z.array(z.string()).describe("研究领域列表"),
});

// 1. 【高阶封装：使用 withStructuredOutput 方法】
// withStructuredOutput 是 LangChain 对结构化输出的官方高阶封装方法。
// 它可以隐藏底层的工具声明、Prompt 拼接和反序列化细节，让你可以直接调用并获取格式化后的对象。
// 注意：由于国产大模型（如 Qwen, DeepSeek）大多数不支持 OpenAI 专有的 json_schema，
// 对接国产大模型时主要有两种选择：
//
// 方式 A：使用 JSON 模式 ({ method: "jsonMode" })
// - 优点：极具通用性，基本所有模型都支持。
// - 缺点：API 只管输出合法 JSON，并不知晓具体的 Schema。
// - 踩坑点：必须在 Prompt 中显式明示英文 Key（如：- name (姓名)），否则模型极易输出中文 Key 导致本地校验报错。
//
// 方式 B：使用工具调用 ({ method: "functionCalling" })
// - 优点：强约束，API 层面会把 Schema 以 tools 参数传给大模型，模型完全知晓 Schema，输出极稳定。
// - 踩坑点 1：大模型若开启了深度思考/推理模式（Thinking），可能会由于 tool_choice 冲突报错，需显式关闭思考模式（如 `modelKwargs: { thinking: { type: "disabled" } }`）。
// - 踩坑点 2：API 规范限制工具参数顶层必须是 object，不能是 array。如果定义了批量数组 Schema (z.array)，必须用 z.object({ list: z.array(...) }) 进行包裹，否则会报 type: "array" 错误。
const structuredModel = model.withStructuredOutput(scientistSchema, {
  method: "jsonMode",
});

// 2. 调用模型
// 注意：因为上面开启了 jsonMode 方式，为了避免大模型网关的前置安全拦截，
// 传入的 Prompt 中必须包含 "json" 或 "JSON" 关键字。
const result =
  await structuredModel.invoke(`介绍一下爱因斯坦。请以 JSON 格式返回，并必须包含以下字段：
- name (姓名, string)
- birth_year (出生年份, number)
- nationality (国籍, string)
- fields (研究领域列表, array of strings)
`);

console.log("结构化结果:", JSON.stringify(result, null, 2));
console.log(`\n姓名: ${result.name}`);
console.log(`出生年份: ${result.birth_year}`);
console.log(`国籍: ${result.nationality}`);
console.log(`研究领域: ${result.fields.join(", ")}`);
