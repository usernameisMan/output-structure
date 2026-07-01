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

// 1. 【使用 Zod 定义复杂的、深层嵌套的结构化数据模式】
// Zod 是一个 TypeScript-first 的模式声明和数据校验库。
// 我们在 Zod Schema 中可以使用可选字段、对象嵌套以及嵌套数组等非常丰富的结构。
const scientistSchema = z.object({
  name: z.string().describe("科学家的全名"),
  birth_year: z.number().describe("出生年份"),
  death_year: z.number().optional().describe("去世年份，如果还在世则不填"), // optional() 声明此字段是可选的
  nationality: z.string().describe("国籍"),
  fields: z.array(z.string()).describe("研究领域列表"), // 字符串数组
  awards: z
    .array(
      z.object({
        name: z.string().describe("奖项名称"),
        year: z.number().describe("获奖年份"),
        reason: z.string().optional().describe("获奖原因"),
      }),
    )
    .describe("获得的重要奖项列表"), // 嵌套对象数组
  major_achievements: z.array(z.string()).describe("主要成就列表"),
  famous_theories: z
    .array(
      z.object({
        name: z.string().describe("理论名称"),
        year: z.number().optional().describe("提出年份"),
        description: z.string().describe("理论简要描述"),
      }),
    )
    .describe("著名理论列表"),
  education: z
    .object({
      university: z.string().describe("主要毕业院校"),
      degree: z.string().describe("学位"),
      graduation_year: z.number().optional().describe("毕业年份"),
    })
    .optional()
    .describe("教育背景"), // 嵌套对象
  biography: z.string().describe("简短传记，100字以内"),
});

// 2. 从复杂 Zod Schema 创建 StructuredOutputParser
// 解析器会利用 Zod 内建的描述与类型自动生成针对复杂 JSON 结构的 Prompt 指引。
const parser = StructuredOutputParser.fromZodSchema(scientistSchema);

const question = `请介绍一下居里夫人（Marie Curie）的详细信息，包括她的教育背景、研究领域、获得的奖项、主要成就和著名理论。

${parser.getFormatInstructions()}`;

console.log("📋 生成的提示词:\n");
console.log(question);

try {
  console.log("🤔 正在调用大模型（使用 Zod Schema）...\n");

  const response = await model.invoke(question);

  console.log("📤 模型原始响应:\n");
  console.log(response.content);

  // 3. 【强类型解析与严格模式校验】
  // parser.parse 会自动将字符串转化为 JSON，并使用 Zod 进行校验。
  // 它会将原本是数字但模型返回了字符串的数据做强制类型转换（Coercion），
  // 并且一旦模型返回了非法数据（如类型不对、缺少非 optional 字段），便会抛出 ZodError。
  const result = await parser.parse(response.content);

  console.log("✅ StructuredOutputParser 自动解析并验证的结果:\n");
  console.log(JSON.stringify(result, null, 2));

  console.log("📊 格式化展示:\n");
  console.log(`👤 姓名: ${result.name}`);
  console.log(`📅 出生年份: ${result.birth_year}`);
  if (result.death_year) {
    console.log(`⚰️  去世年份: ${result.death_year}`);
  }
  console.log(`🌍 国籍: ${result.nationality}`);
  console.log(`🔬 研究领域: ${result.fields.join(", ")}`);

  console.log(`\n🎓 教育背景:`);
  if (result.education) {
    console.log(`   院校: ${result.education.university}`);
    console.log(`   学位: ${result.education.degree}`);
    if (result.education.graduation_year) {
      console.log(`   毕业年份: ${result.education.graduation_year}`);
    }
  }

  console.log(`\n🏆 获得的奖项 (${result.awards.length}个):`);
  result.awards.forEach((award, index) => {
    console.log(`   ${index + 1}. ${award.name} (${award.year})`);
    if (award.reason) {
      console.log(`      原因: ${award.reason}`);
    }
  });

  console.log(`\n💡 著名理论 (${result.famous_theories.length}个):`);
  result.famous_theories.forEach((theory, index) => {
    console.log(
      `   ${index + 1}. ${theory.name}${theory.year ? ` (${theory.year})` : ""}`,
    );
    console.log(`      ${theory.description}`);
  });

  console.log(`\n🌟 主要成就 (${result.major_achievements.length}个):`);
  result.major_achievements.forEach((achievement, index) => {
    console.log(`   ${index + 1}. ${achievement}`);
  });

  console.log(`\n📖 传记:`);
  console.log(`   ${result.biography}`);
} catch (error) {
  console.error("❌ 错误:", error.message);
  // 如果是 Zod 校验失败抛出的错，我们可以打印更详细的字段验证错误细节
  if (error.name === "ZodError") {
    console.error("验证错误详情:", error.errors);
  }
}
