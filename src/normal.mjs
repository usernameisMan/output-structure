import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

// 初始化大语言模型
// 这里使用 ChatOpenAI，它是 LangChain 提供的集成 OpenAI 接口规格的包装类
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME, // 从环境变量获取模型名称 (例如 qwen3.7-plus, deepseek-chat)
  apiKey: process.env.OPENAI_API_KEY, // API 密钥
  temperature: 0, // 温度设置为 0，保证模型输出具有最高的确定性与稳定性
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL, // 自定义的基础 API 地址，用于对接第三方或国产模型接口
  },
});

// 这是一个普通的问题，我们直接在 Prompt 中要求模型以 JSON 字符串形式返回数据
const question =
  "请介绍一下爱因斯坦的信息。请以 JSON 格式返回，包含以下字段：name（姓名）、birth_year（出生年份）、nationality（国籍）、major_achievements（主要成就，数组）、famous_theory（著名理论）。";

try {
  console.log("🤔 正在调用大模型...\n");

  // 使用 invoke 发起阻塞式调用
  const response = await model.invoke(question);

  console.log("✅ 收到响应:\n");
  // 模型返回的是 AIMessage 对象，其中的 content 是模型生成的原始字符串
  console.log(response.content);

  // 【普通方式解析】由于没有使用 LangChain 的 Parser，我们需要手动使用原生的 JSON.parse 进行解析
  // 注意：如果模型返回的字符串中包含 Markdown 标记 (如 ```json ... ```)，普通的 JSON.parse 可能会报错
  const jsonResult = JSON.parse(response.content);
  console.log("\n📋 解析后的 JSON 对象:");
  console.log(jsonResult);
} catch (error) {
  console.error("❌ 错误:", error.message);
}
