import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { XMLOutputParser } from "@langchain/core/output_parsers";

// 初始化大语言模型
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 创建 XMLOutputParser 实例
// XMLOutputParser 可以将大模型生成的 XML 标签字符串解析为嵌套的 JavaScript 对象结构。
// 由于大模型原生对 XML 标签的敏感度及闭合能力比 JSON 更好，在某些非 JSON 优先的模型或需要做复杂文档解析的场景中非常有用。
const parser = new XMLOutputParser();

// 构造提取 Prompt，拼接 XML 格式说明
// parser.getFormatInstructions() 会输出一段详细指示词，告知模型必须将数据嵌套在哪些 XML 标签中返回
const question = `请提取以下文本中的人物信息：阿尔伯特·爱因斯坦出生于 1879 年，是一位伟大的物理学家。

${parser.getFormatInstructions()}`;

console.log("question:", question);

try {
  console.log("🤔 正在调用大模型（使用 XMLOutputParser）...\n");

  const response = await model.invoke(question);

  console.log("📤 模型原始响应:\n");
  console.log(response.content);

  // 【使用 Parser 解析】调用 parser.parse 将 XML 标签文本解析并转换为结构化的 JavaScript 对象
  const result = await parser.parse(response.content);

  console.log("\n✅ XMLOutputParser 自动解析的结果:\n");
  console.log(result);
} catch (error) {
  console.error("❌ 错误:", error.message);
}
