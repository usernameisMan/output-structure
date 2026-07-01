import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
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

// 使用 zod 定义结构化输出格式
const schema = z.object({
  name: z.string().describe("姓名"),
  birth_year: z.number().describe("出生年份"),
  death_year: z.number().describe("去世年份"),
  nationality: z.string().describe("国籍"),
  occupation: z.string().describe("职业"),
  famous_works: z.array(z.string()).describe("著名作品列表"),
  biography: z.string().describe("简短传记"),
});

// 1. 根据 Zod Schema 创建 StructuredOutputParser
// 该解析器会自动将 Zod 定义的字段结构和中文描述翻译成大模型容易理解的英文 Prompt 约束模板。
const parser = StructuredOutputParser.fromZodSchema(schema);

// 2. 将字段解析指令拼接进 Prompt
// parser.getFormatInstructions() 会输出一段详细的英文提示词，指导模型必须输出符合 Zod 格式的 JSON 字符串。
// 因为是在 Prompt 中进行文本规约，大模型调用时不需要设置 API 级别的 response_format 属性，所以该方案在国产模型上具有 100% 的兼容性。
const prompt = `详细介绍莫扎特的信息。\n\n${parser.getFormatInstructions()}`;

console.log("🌊 流式结构化输出演示\n");

try {
  // 3. 开启文本流输出
  const stream = await model.stream(prompt);

  let fullContent = "";
  let chunkCount = 0;

  console.log("📡 接收流式数据:\n");

  // 4. 流式接收最原始的非结构化 JSON 文本片段
  for await (const chunk of stream) {
    chunkCount++;
    const content = chunk.content;
    fullContent += content;

    process.stdout.write(content); // 实时显示流式文本
  }

  console.log(`\n\n✅ 共接收 ${chunkCount} 个数据块\n`);

  // 5. 【客户端解析】在流式传输全部结束后，我们将累加起来的完整文本传递给 parser.parse 方法
  // 解析器不仅会对 JSON 格式进行反序列化，还会使用 Zod 对字段类型和必填性进行严格的断言验证，
  // 最终输出合规的 JavaScript 对象。如果校验失败（比如类型不对或缺少必填项）会抛出验证错误。
  const result = await parser.parse(fullContent);

  console.log("📊 解析后的结构化结果:\n");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n📝 格式化输出:");
  console.log(`姓名: ${result.name}`);
  console.log(`出生年份: ${result.birth_year}`);
  console.log(`去世年份: ${result.death_year}`);
  console.log(`国籍: ${result.nationality}`);
  console.log(`职业: ${result.occupation}`);
  console.log(`著名作品: ${result.famous_works.join(", ")}`);
  console.log(`传记: ${result.biography}`);
} catch (error) {
  console.error("\n❌ 错误:", error.message);
}
