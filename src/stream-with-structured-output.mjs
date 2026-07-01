import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// 初始化大语言模型实例
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 1. 使用 zod 定义结构化输出的 Schema (指定所需的字段名称和类型)
const schema = z.object({
  name: z.string().describe("姓名"),
  birth_year: z.number().describe("出生年份"),
  death_year: z.number().describe("去世年份"),
  nationality: z.string().describe("国籍"),
  occupation: z.string().describe("职业"),
  famous_works: z.array(z.string()).describe("著名作品列表"),
  biography: z.string().describe("简短传记"),
});

// 2. 绑定结构输出 Schema
// 注意：由于国产大模型（如 Qwen, DeepSeek）大多数不支持 OpenAI 的 json_schema 格式参数，
// 这里必须显式指定 method 为 "jsonMode" (对应底层的 response_format: { type: "json_object" })。
const structuredModel = model.withStructuredOutput(schema, {
  method: "jsonMode",
});

// 3. 定义提示词
// 注意：在 jsonMode 模式下：
// 1. 大模型 API 要求 Prompt 里必须包含 "json" 或 "JSON" 关键字，否则会报 400 校验错误。
// 2. 接口只保证输出的是合法 JSON，但不限制字段。因此我们必须在 Prompt 中写明具体的字段名和类型，
//    避免大模型自由发挥输出不匹配的 key 导致 Zod 最终校验失败。
const prompt = `详细介绍莫扎特的信息。请以 JSON 格式返回，包含以下字段：
- name (姓名, string)
- birth_year (出生年份, number)
- death_year (去世年份, number)
- nationality (国籍, string)
- occupation (职业, string)
- famous_works (著名作品列表, array of strings)
- biography (简短传记, string)
`;

console.log("🌊 流式结构化输出演示（withStructuredOutput）\n");

try {
  // 4. 调用 stream 方法获取异步迭代器流
  const stream = await structuredModel.stream(prompt);

  let chunkCount = 0;
  let result = null;

  console.log("📡 接收流式数据:\n");

  // 5. 通过 for await...of 异步迭代循环读取返回的流式块
  // 注意：在 withStructuredOutput 包装下，最终返回的 chunk 已经是合并并解析过的结构化对象
  for await (const chunk of stream) {
    chunkCount++;
    result = chunk;

    console.log(`[Chunk ${chunkCount}]`);
    console.log(JSON.stringify(chunk, null, 2));
  }

  console.log(`\n✅ 共接收 ${chunkCount} 个数据块\n`);

  // 6. 最终的结构化数据读取与格式化展示
  if (result) {
    console.log("📊 最终结构化结果:\n");
    console.log(JSON.stringify(result, null, 2));

    console.log("\n📝 格式化输出:");
    console.log(`姓名: ${result.name}`);
    console.log(`出生年份: ${result.birth_year}`);
    console.log(`去世年份: ${result.death_year}`);
    console.log(`国籍: ${result.nationality}`);
    console.log(`职业: ${result.occupation}`);
    console.log(`著名作品: ${result.famous_works.join(", ")}`);
    console.log(`传记: ${result.biography}`);
  }
} catch (error) {
  console.error("\n❌ 错误:", error.message);
}
