import Anthropic from "@anthropic-ai/sdk";
import type { PlaceType } from "../common/types.js";
import { CLAUDE_MODEL, PARSE_INTENT_MAX_TOKENS } from "../common/constants.js";

const client = new Anthropic();

// ---------------------------------------------------------------------------
// Публичные типы
// ---------------------------------------------------------------------------

export interface IntentParams {
  type: PlaceType;
  keyword?: string;
  radius?: number;
  minprice?: 0 | 1 | 2 | 3 | 4;
  maxprice?: 0 | 1 | 2 | 3 | 4;
  minRating?: number;
  minReviewCount?: number;
  maxPlaces?: number;
  maxReviewsPerPlace?: number;
}

export interface ParseIntentResult {
  params: IntentParams;
  reasoning: string;
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
      type: {
        type: "string",
        enum: [
          "restaurant",
          "cafe",
          "bar",
          "bakery",
          "meal_takeaway",
          "meal_delivery",
        ],
        description: "Тип заведения",
      },
      keyword: {
        type: "string",
        description:
          "Ключевое слово на английском для уточнения поиска: кухня (sushi, pizza), " +
          "атмосфера (romantic, cozy, rooftop), концепция (brunch, wine bar). " +
          "Не указывай если нет конкретного уточнения.",
      },
      radius: {
        type: "number",
        description:
          "Радиус поиска в метрах. Не указывай если пользователь не уточнял. ",
      },
      minprice: {
        type: "number",
        enum: [0, 1, 2, 3, 4],
        description:
          "Минимальный ценовой уровень. Указывай только если пользователь хочет именно дорогое место.",
      },
      maxprice: {
        type: "number",
        enum: [0, 1, 2, 3, 4],
        description:
          "Максимальный ценовой уровень. " +
          "'бюджетное'→1, 'средняя цена'→2, 'дорого'→3. 'очень дорого'→4. Не указывай если цена не важна. " +
          "По умолчанию maxprice=3",
      },
      minRating: {
        type: "number",
        description:
          "Минимальный рейтинг (по умолчанию 4.2). " +
          "4.5+ для особых случаев (романтический ужин, деловая встреча). " +
          "4.0 для быстрой еды.",
      },
      minReviewCount: {
        type: "number",
        description:
          "Минимум отзывов (по умолчанию 15). Увеличь до 50–100 если важна проверенность места.",
      },
      maxPlaces: {
        type: "number",
        enum: [20, 40, 60],
        description:
          "Количество заведений для обработки. Не указывай без причины (по умолчанию 20).",
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
    required: ["type", "reasoning"],
  },
};

const SYSTEM_PROMPT = `Ты — помощник для поиска заведений общественного питания. Пользователь описывает, что ищет, а ты переводишь это в параметры поиска по Google Maps.

Принципы:
- Устанавливай только те параметры, которые явно следуют из запроса. Лишние параметры ухудшают результат.
- Если запрос подразумевает недорогое место, то ставь maxprice=2. 
- Keyword должен быть конкретным и на английском: "pizza", "romantic", "rooftop terrace", "vegan". Не пиши абстрактное вроде "good food".
- Если запрос подразумевает особое место (романтический ужин, деловая встреча, день рождения) — повышай minRating до 4.5.`;

// ---------------------------------------------------------------------------
// Основная функция
// ---------------------------------------------------------------------------

export async function parseIntent(prompt: string): Promise<ParseIntentResult> {
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

  return { params, reasoning };
}
