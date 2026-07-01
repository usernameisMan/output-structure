import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";

// 初始化大语言模型
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 1. 【根据名称和描述定义输出结构】
// 使用 StructuredOutputParser.fromNamesAndDescriptions 传入扁平的“字段名-字段中文描述”映射。
// 它适用于结构相对简单、无需进行深层嵌套或复杂类型（如数组、嵌套对象等）验证的场景。
const parser = StructuredOutputParser.fromNamesAndDescriptions({
  name: "姓名",
  birth_year: "出生年份",
  nationality: "国籍",
  major_achievements: "主要成就，用逗号分隔的字符串",
  famous_theory: "著名理论",
});

// 2. 将自动生成的格式化规则注入到 Prompt 中
// parser.getFormatInstructions() 会输出一段详细指示词，告知模型以何种 JSON schema 回复
const question = `请介绍一下爱因斯坦的信息。

${parser.getFormatInstructions()}`;

console.log("question:", question);

try {
  console.log("🤔 正在调用大模型（使用 StructuredOutputParser）...\n");

  const response = await model.invoke(question);

  console.log("📤 模型原始响应:\n");
  console.log(response.content);

  // 3. 【客户端解析与校验】
  // 使用 parser.parse 自动提取模型响应中的 JSON 部分并转化为 JS 对象。
  // 注意：这个简单的解析器底层基于正则表达式和简单 JSON.parse，
  // 仅校验返回的字段键名是否存在，但不对其数据类型进行严格强转换（比如 Zod 能强制将数字字符串转为真正的 Number）。
  const result = await parser.parse(response.content);

  console.log("\n✅ StructuredOutputParser 自动解析的结果:\n");
  console.log(result);
  console.log(`姓名: ${result.name}`);
  console.log(`出生年份: ${result.birth_year}`);
  console.log(`国籍: ${result.nationality}`);
  console.log(`著名理论: ${result.famous_theory}`);
  console.log(`主要成就: ${result.major_achievements}`);
} catch (error) {
  console.error("❌ 错误:", error.message);
}
