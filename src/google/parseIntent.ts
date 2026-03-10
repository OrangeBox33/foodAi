import Anthropic from "@anthropic-ai/sdk";
import type { PlaceType, ReviewsSort } from "../types.js";
import { CLAUDE_MODEL, PARSE_INTENT_MAX_TOKENS } from "../constants.js";

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
  reviewsSort?: ReviewsSort;
  // Только для Apify-пути
  lat?: number;
  lng?: number;
  query?: string;
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
          "Радиус поиска в метрах. Не указывай если пользователь не уточнял (по умолчанию 500). " +
          "300 — 'рядом/шаговая доступность', 1000–2000 — 'в районе/в городе'.",
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
          "Максимальный ценовой уровень. 0=бесплатно, 1=$, 2=$$, 3=$$$, 4=$$$$. " +
          "'бюджетное'→1, 'недорого'→2, 'умеренно'→3. Не указывай если цена не важна.",
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
      reviewsSort: {
        type: "string",
        enum: ["newest", "mostRelevant", "highestRanking", "lowestRanking"],
        description:
          "'newest' — самые новые, по умолчанию. 'mostRelevant' — наиболее актуальные. " +
          "'highestRanking' — только лучшие. 'lowestRanking' — анализ недостатков. " +
          "Отправляй только если пользователь просит явно",
      },
      lat: {
        type: "number",
        description:
          "Широта из запроса пользователя. Извлекай только если координаты явно указаны в тексте.",
      },
      lng: {
        type: "number",
        description:
          "Долгота из запроса пользователя. Извлекай только если координаты явно указаны в тексте.",
      },
      query: {
        type: "string",
        description:
          "Поисковая строка для Apify places scraper на английском. " +
          "Составляй из type + keyword: 'cozy cafe', 'sushi restaurant', 'budget bakery'. " +
          "Если keyword не задан — просто тип: 'cafe', 'restaurant'.",
      },
      reasoning: {
        type: "string",
        description:
          "Краткое объяснение выбранных параметров (2–4 предложения).",
      },
    },
    required: ["type", "reasoning"],
  },
};

const SYSTEM_PROMPT = `Ты — помощник для поиска заведений общественного питания. Пользователь описывает, что ищет, а ты переводишь это в параметры поиска по Google Maps.

Принципы:
- Устанавливай только те параметры, которые явно следуют из запроса. Лишние параметры ухудшают результат.
- Цена: "недорого" ≠ "дёшево". "Недорогое кафе" → maxprice 2. "Бюджетное" → maxprice 1. "Готов доплатить за атмосферу" → maxprice 3.
- Keyword должен быть конкретным и на английском: "pizza", "romantic", "rooftop terrace", "vegan". Не пиши абстрактное вроде "good food".
- Если запрос подразумевает особое место (романтический ужин, деловая встреча, день рождения) — повышай minRating до 4.5.
- reviewsSort не трогай без причины — по умолчанию система использует оптимальное значение.`;

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
