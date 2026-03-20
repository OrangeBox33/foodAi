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
          "Текстовый поисковый запрос для Google Places Text Search. " +
          "Составь КРАТКИЙ запрос на английском языке, отражающий суть того, что ищет пользователь. " +
          'Примеры: "pho", "rice restaurant", "bar".',
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
          "Тип заведения для фильтрации результатов. Указывай только если пользователь ЯВНО упоминает тип. Если сомневаешься - оставь пустым",
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

Принципы:
- textQuery — это главный параметр. Составь короткий, точный запрос, описывающий то, что ищет пользователь. 1-2 слова! 
- includedType — указывай только если из запроса явно следует конкретный тип заведения (ресторан, кафе, бар и т.д.). Если сомневаешься - оставь пустым. 
- Устанавливай только те параметры, которые явно следуют из запроса. Лишние параметры ухудшают результат.`;

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
