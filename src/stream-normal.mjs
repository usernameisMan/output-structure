import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

// 初始化大语言模型
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const prompt = `详细介绍莫扎特的信息。`;

console.log("🌊 普通流式输出演示（无结构化）\n");

try {
  // 1. 调用 stream 方法获取一个异步可迭代流 (Async Iterable Stream)
  // 相较于 invoke，stream 会立即返回该流对象，而不是等待模型全部生成完毕
  const stream = await model.stream(prompt);

  let fullContent = "";
  let chunkCount = 0;

  console.log("📡 接收流式数据:\n");

  // 2. 使用 ES9 的 for await...of 语法异步循环消费流式数据块
  // 每次大模型产生新的字词时，循环便会前进一步，获取到新的 chunk
  for await (const chunk of stream) {
    chunkCount++;
    const content = chunk.content; // 获取当前数据块的文本内容
    fullContent += content;        // 累加完整文本，以便流结束时使用

    // 3. 实时显示流式文本
    // 注意：这里使用 process.stdout.write 替代 console.log，
    // 因为 console.log 会自动在每次输出后换行，而 stdout.write 可以实现像打字机一样的连续输出效果。
    process.stdout.write(content); 
  }

  console.log(`\n\n✅ 共接收 ${chunkCount} 个数据块\n`);
  console.log(`📝 完整内容长度: ${fullContent.length} 字符`);
} catch (error) {
  console.error("\n❌ 错误:", error.message);
}
