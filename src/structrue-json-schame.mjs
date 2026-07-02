import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import chalk from "chalk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const scientistSchema = z
  .object({
    name: z.string().describe("科学家的全名"),
    birth_year: z.number().describe("出生年份"),
    field: z.string().describe("主要研究领域"),
    achievements: z.array(z.string()).describe("主要成就列表"),
  })
  .strict();

// 将 Zod 转换为原生的 JSON Schema 格式
const nativeJsonSchema = zodToJsonSchema(scientistSchema);

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  modelKwargs: {
    thinking: { type: "disabled" },
    // 【国产模型避坑提示】：
    // 1. 如果此处设为 "json_schema"，绝大多数国产大模型网关会直接报 400 Bad Request (This response_format type is unavailable now)。
    // 2. 如果退而求其次，像下面这样降级设为 "json_object" (即普通的 JSON Mode)：
    //    虽然能跑通，但是 API 会直接丢弃/忽略你在下面配置的 json_schema 字段！
    //    大模型在生成时完全感知不到你定义的 Schema 字段结构，输出的 JSON key 会随机编造，从而无法通过 Zod 的严密校验。
    // 即便现在 structrue-json-schame.mjs输出正确了,没有propmt 也是不稳定的
    response_format: {
      type: "json_object",
      json_schema: {
        name: "scientist_info",
        strict: true,
        schema: nativeJsonSchema,
      },
    },
  },
});

async function testNativeJsonSchema() {
  console.log(chalk.bgMagenta("🧪 测试原生 JSON Schema 模式...\n"));

  const res = await model.invoke([
    new SystemMessage("你是一个信息提取助手，请直接返回 JSON 数据。"),
    new HumanMessage("介绍一下杨振宁"),
  ]);

  console.log(chalk.green("\n✅ 收到响应 (纯净 JSON):"));
  console.log(res.content);

  const data = JSON.parse(res.content);
  console.log(chalk.cyan("\n📋 JSON 解析成功:"));
  console.log(data);

  // 【测试 Zod 校验】
  try {
    console.log(chalk.yellow("\n🔍 正在尝试使用 Zod Schema 进行强类型验证..."));
    const validatedData = scientistSchema.parse(data);
    console.log(chalk.green("🎉 校验成功！"));
    console.log(validatedData);
  } catch (err) {
    console.error(
      chalk.red(
        "\n❌ 校验失败！在 json_object 模式下模型由于无法感知 schema，生成了不匹配的 keys。错误信息：\n",
      ),
      err.errors || err.message,
    );
  }
}

testNativeJsonSchema().catch(console.error);
