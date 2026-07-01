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

// 使用 Zod 定义工具调用所期望捕获的数据结构 (Schema)
const scientistSchema = z.object({
  name: z.string().describe("科学家的全名"),
  birth_year: z.number().describe("出生年份"),
  death_year: z.number().optional().describe("去世年份，如果还在世则不填"),
  nationality: z.string().describe("国籍"),
  fields: z.array(z.string()).describe("研究领域列表"),
  achievements: z.array(z.string()).describe("主要成就"),
  biography: z.string().describe("简短传记"),
});

// 1. 【绑定工具到模型】
// 使用 model.bindTools 方法，将我们定义的 schema 作为一个工具 (Tool) 声明传递给大模型。
// 大模型识别到该工具后，如果认为用户的意图与该工具相符，便会选择以调用该工具的形式回复（即以 JSON 格式输出该 schema 约定的参数）。
const modelWithTool = model.bindTools([
  {
    name: "extract_scientist_info",
    description: "提取和结构化科学家的详细信息",
    schema: scientistSchema,
  },
]);

console.log("🌊 流式 Tool Calls 演示 - 直接打印原始 tool_calls_chunk\n");

try {
  // 2. 开启带有工具的流式调用
  // 此时模型流式输出的内容并非普通的 chunk.content，而是 chunk.tool_call_chunks (工具调用片段)
  const stream = await modelWithTool.stream("详细介绍牛顿的生平和成就");

  console.log("📡 实时输出流式 tool_calls_chunk:\n");

  let chunkIndex = 0;

  for await (const chunk of stream) {
    chunkIndex++;
    
    // 3. 【解析原始工具调用分片】
    // 在流式 tool calls 过程中，模型以增量片段输出工具调用的参数内容，
    // 我们可以在每个 chunk 的 tool_call_chunks 中找到这些片段。
    if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
      // 提取第 0 个工具调用的增量参数字符串 (通常是一段段局部的 JSON 文本) 并输出
      process.stdout.write(chunk.tool_call_chunks[0].args || "");
    }
  }

  console.log("\n\n✅ 流式输出完成");
} catch (error) {
  console.error("\n❌ 错误:", error.message);
  console.error(error);
}
