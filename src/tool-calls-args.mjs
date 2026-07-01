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

// 定义期望提取的数据结构
const scientistSchema = z.object({
  name: z.string().describe("科学家的全名"),
  birth_year: z.number().describe("出生年份"),
  nationality: z.string().describe("国籍"),
  fields: z.array(z.string()).describe("研究领域列表"),
});

// 1. 【绑定工具 (Tool Calling) 声明结构化数据格式】
// 我们将 scientistSchema 转换成工具定义的参数格式，并绑定到大模型上。
// 与传统的 JSON 解析不同，这是在 API 协议级别告知模型有这样一个可调用的“结构化提取工具”。
const modelWithTool = model.bindTools([
  {
    name: "extract_scientist_info",
    description: "提取和结构化科学家的详细信息",
    schema: scientistSchema,
  },
]);

// 2. 直接调用模型
const response = await modelWithTool.invoke("介绍一下爱因斯坦");

// 3. 【从 tool_calls 属性中提取提取的参数结果】
// 如果模型判断出要使用该工具，它会在返回结果的 tool_calls 数组中写入对应的工具调用信息，
// 其中的 args 属性正是大模型将提取信息按照我们的 scientistSchema 序列化后的键值对对象。
console.log("response.tool_calls:", response.tool_calls);

// 获取第一个工具调用的参数
const result = response.tool_calls[0].args;

console.log("结构化结果:", JSON.stringify(result, null, 2));
console.log(`\n姓名: ${result.name}`);
console.log(`出生年份: ${result.birth_year}`);
console.log(`国籍: ${result.nationality}`);
console.log(`研究领域: ${result.fields.join(", ")}`);
