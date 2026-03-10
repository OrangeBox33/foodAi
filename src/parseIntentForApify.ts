import Anthropic from "@anthropic-ai/sdk";
import type { ReviewsSort, FindPlacesApifyInput } from "./types.js";
import { CLAUDE_MODEL, PARSE_INTENT_MAX_TOKENS } from "./constants.js";

const client = new Anthropic();

// ---------------------------------------------------------------------------
// Публичные типы
// ---------------------------------------------------------------------------

export type ApifyIntentParams = Pick<
  FindPlacesApifyInput,
  | "query"
  | "lat"
  | "lng"
  | "maxItems"
  | "zoom"
  | "country"
  | "minRating"
  | "minReviewCount"
  | "maxReviewsPerPlace"
  | "reviewsSort"
>;

export interface ParseIntentResult {
  params: ApifyIntentParams;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Инструмент — заставляет Claude вернуть строго структурированный JSON
// ---------------------------------------------------------------------------

const TOOL: Anthropic.Tool = {
  name: "set_search_params",
  description:
    "Устанавливает параметры поиска заведений через Apify Google Places scraper на основе запроса пользователя",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Поисковая строка на английском для Google Maps. " +
          "Составляй из типа заведения и уточнений: 'cozy cafe', 'sushi restaurant', 'budget bakery', 'rooftop bar'. " +
          "Если нет уточнений — просто тип: 'cafe', 'restaurant'.",
      },
      lat: {
        type: "number",
        description:
          "Широта центра поиска. Извлекай только если координаты явно указаны в тексте пользователя.",
      },
      lng: {
        type: "number",
        description:
          "Долгота центра поиска. Извлекай только если координаты явно указаны в тексте пользователя.",
      },
      maxItems: {
        type: "number",
        description:
          "Максимальное число заведений, которые вернёт scraper. " +
          "По умолчанию не указывай (система использует 150). " +
          "Уменьши до 30–50 если нужен быстрый результат. Увеличь до 200+ для широкого охвата.",
      },
      zoom: {
        type: "number",
        description:
          "Уровень зума карты (12 по умолчанию). " +
          "14–15 — 'рядом/в шаговой доступности'. 10–11 — 'по всему городу'.",
      },
      country: {
        type: "string",
        description:
          "Код страны ISO 3166-1 alpha-2 (например 'VN', 'RU', 'US'). " +
          "Указывай только если страна явно следует из запроса.",
      },
      minRating: {
        type: "number",
        description:
          "Минимальный рейтинг заведения (по умолчанию 4.2). " +
          "4.5+ для особых случаев (романтический ужин, деловая встреча). " +
          "4.0 для быстрой еды или бюджетных мест.",
      },
      minReviewCount: {
        type: "number",
        description:
          "Минимальное число отзывов (по умолчанию 15). " +
          "Увеличь до 50–100 если важна проверенность места.",
      },
      maxReviewsPerPlace: {
        type: "number",
        description:
          "Число отзывов на заведение для анализа (по умолчанию 20). " +
          "50 для глубокого анализа, 10 для быстрой проверки.",
      },
      reviewsSort: {
        type: "string",
        enum: ["newest", "mostRelevant", "highestRanking", "lowestRanking"],
        description:
          "'newest' — самые новые (по умолчанию). 'highestRanking' — только лучшие. " +
          "'lowestRanking' — анализ недостатков. Указывай только если пользователь просит явно.",
      },
      reasoning: {
        type: "string",
        description:
          "Краткое объяснение выбранных параметров (2–4 предложения).",
      },
    },
    required: ["query", "reasoning"],
  },
};

const SYSTEM_PROMPT = `Ты — помощник для поиска заведений общественного питания через Google Maps. Пользователь описывает, что ищет, а ты составляешь параметры для Apify Google Places scraper.

Принципы:
- Главное — поисковая строка (query). Она должна быть конкретной и на английском: 'sushi restaurant', 'cozy wine bar', 'vegan cafe', 'cheap ramen'. Не используй абстракции вроде 'good food'.
- Тип заведения (restaurant, cafe, bar, bakery и т.д.) всегда включай в query как основу.
- Добавляй в query уточнения по кухне, атмосфере или концепции только если они явно есть в запросе.
- Не указывай параметры без необходимости — лишние ограничения ухудшают результат.
- Для особых случаев (романтический ужин, деловая встреча) повышай minRating до 4.5.`;

// ---------------------------------------------------------------------------
// Основная функция
// ---------------------------------------------------------------------------

export async function parseIntentForApify(
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

  const { reasoning, ...params } = toolUse.input as ApifyIntentParams & {
    reasoning: string;
  };

  return { params, reasoning };
}
