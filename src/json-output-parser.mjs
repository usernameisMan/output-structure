import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { JsonOutputParser } from "@langchain/core/output_parsers";

// 初始化大语言模型
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 创建 JsonOutputParser 实例
// 该解析器比原生 JSON.parse 更强大，它能够自动剔除大模型返回内容前后的 Markdown 标记 (如 ```json)
// 并且支持在流式输出中进行渐进式解析
const parser = new JsonOutputParser();

// 构造问题 Prompt，拼接解析器的格式说明
// 注意：对于 JsonOutputParser，由于它不强制绑定 Zod Schema，
// getFormatInstructions() 返回的是一个空字符串。因此具体的字段说明仍需在 Prompt 中人工写明。
const question = `请介绍一下爱因斯坦的信息。请以 JSON 格式返回，包含以下字段：name（姓名）、birth_year（出生年份）、nationality（国籍）、major_achievements（主要成就，数组）、famous_theory（著名理论）。

${parser.getFormatInstructions()}`;

console.log("question:", question);

try {
  console.log("🤔 正在调用大模型（使用 JsonOutputParser）...\n");

  const response = await model.invoke(question);

  console.log("📤 模型原始响应:\n");
  console.log(response.content);

  // 【使用 Parser 解析】调用 parser.parse 自动将原始文本解析并转换为 JavaScript 对象
  const result = await parser.parse(response.content);

  console.log("✅ JsonOutputParser 自动解析的结果:\n");
  console.log(result);
  console.log(`姓名: ${result.name}`);
  console.log(`出生年份: ${result.birth_year}`);
  console.log(`国籍: ${result.nationality}`);
  console.log(`著名理论: ${result.famous_theory}`);
  console.log(`主要成就:`, result.major_achievements);
} catch (error) {
  console.error("❌ 错误:", error.message);
}
