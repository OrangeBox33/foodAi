import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL, PARSE_INTENT_MAX_TOKENS } from "./common/constants.js";
import { fromApiUsage, type TokenUsage } from "./common/helpers/usage.js";

const client = new Anthropic();

// ---------------------------------------------------------------------------
// Публичные типы
// ---------------------------------------------------------------------------

export interface IntentParams {
  textQuery: string;
  includedType?: string;
  radius?: number;
  minReviewCount?: number;
  maxReviewsPerPlace?: number;
}

export interface ParseIntentResult {
  params: IntentParams;
  reasoning: string;
  usage: TokenUsage;
}

// ---------------------------------------------------------------------------
// Инструмент — заставляет Claude вернуть строго структурированный JSON
// ---------------------------------------------------------------------------

const TOOL: Anthropic.Tool = {
  name: "set_search_params",
  description:
    "Устанавливает параметры поиска заведений на основе запроса пользователя",
  input_schema: {
    type: "object",
    properties: {
      textQuery: {
        type: "string",
        description:
          "МАКСИМУМ 2 слова на английском. Только самое главное: блюдо или тип заведения. " +
          'Примеры: "pho", "ramen", "Vietnamese food", "rice restaurant", "sushi bar". ' +
          "Больше 2 слов — ЗАПРЕЩЕНО.",
      },
      includedType: {
        type: "string",
        enum: [
          "restaurant",
          "cafe",
          "bar",
          "bakery",
          "meal_takeaway",
          "meal_delivery",
        ],
        description:
          "Тип заведения. ПРАВИЛО: оставляй поле ПОЛНОСТЬЮ ПУСТЫМ (не передавай его вообще) если пользователь не сказал одно из точных слов: ресторан/restaurant, кафе/cafe, бар/bar, пекарня/bakery, доставка/delivery, навынос/takeaway. " +
          "Примеры когда НЕ указывать: 'где поесть фо', 'хочу суши', 'найди рамен', 'вкусная еда рядом' — ВО ВСЕХ ЭТИХ СЛУЧАЯХ НЕ УКАЗЫВАЙ ЭТОТ ПАРАМЕТР ВООБЩЕ. " +
          "Пример когда указывать: 'найди бар', 'хочу в ресторан'.",
      },
      radius: {
        type: "number",
        description:
          "Радиус поиска в метрах. Не указывай если пользователь не уточнял.",
      },
      minReviewCount: {
        type: "number",
        description:
          "Минимум отзывов (по умолчанию 15). Увеличь до 50–100 если важна проверенность места.",
      },
      maxReviewsPerPlace: {
        type: "number",
        description:
          "Количество отзывов на заведение (по умолчанию 20). " +
          "50 для глубокого анализа, 10-20 для быстрой проверки.",
      },
      reasoning: {
        type: "string",
        description:
          "Краткое объяснение выбранных параметров (1-2 предложения).",
      },
    },
    required: ["textQuery", "reasoning"],
  },
};

const SYSTEM_PROMPT = `Ты — помощник для поиска заведений общественного питания. Пользователь описывает, что ищет, а ты переводишь это в параметры поиска по Google Maps.

Правила:

1. textQuery — МАКСИМУМ 2 слова на английском. Только самое важное. Примеры: "pho", "ramen", "Vietnamese food", "rice restaurant". Больше 2 слов — НЕЛЬЗЯ.

2. includedType — НЕ УКАЗЫВАЙ этот параметр, если пользователь не произнёс явно слово-тип: ресторан, кафе, бар, пекарня, доставка, навынос. Название еды (фо, рамен, суши, пицца и т.д.) — это НЕ тип заведения. Запрос про еду = includedType пустой. Только "хочу в бар" или "найди ресторан" = указывай тип.

3. Не добавляй лишних параметров — только те, что явно следуют из запроса.`;

// ---------------------------------------------------------------------------
// Основная функция
// ---------------------------------------------------------------------------

export async function parseIntentForGoogle(
  prompt: string,
): Promise<ParseIntentResult> {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: PARSE_INTENT_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "set_search_params" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Claude не вернул параметры поиска");
  }

  const { reasoning, ...params } = toolUse.input as IntentParams & {
    reasoning: string;
  };

  return { params, reasoning, usage: fromApiUsage(response.usage) };
}
