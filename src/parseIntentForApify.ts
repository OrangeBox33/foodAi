import Anthropic from "@anthropic-ai/sdk";
import type { FindPlacesApifyInput } from "./types.js";
import { CLAUDE_MODEL, PARSE_INTENT_MAX_TOKENS } from "./constants.js";

const client = new Anthropic();

// ---------------------------------------------------------------------------
// Публичные типы
// ---------------------------------------------------------------------------

export type ApifyIntentParams = Pick<
  FindPlacesApifyInput,
  "url" | "maxPlaces" | "maxReviewsPerPlace" | "minRating" | "minReviewCount"
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
      url: {
        type: "string",
        description:
          "Google Maps search URL вида 'https://www.google.com/maps/search/KEYWORD/@lat,lng,zoom'. " +
          'Координаты и zoom извлекай точно из URL пользователя (формат url="..."), не меняй их. ' +
          "KEYWORD замени на подходящий поисковый запрос на английском, исходя из намерения пользователя " +
          "(например: restaurant, cafe, pizza, sushi, bar, bakery, street+food и т.п.). ",
      },
      maxPlaces: {
        type: "number",
        description:
          "Максимальное число заведений, которые вернёт scraper. " +
          "По умолчанию не указывай (система использует 30). " +
          "Уменьши до 10–20 для быстрого результата. Увеличь до 50+ для широкого охвата.",
      },
      maxReviewsPerPlace: {
        type: "number",
        description:
          "Число отзывов на заведение для анализа (по умолчанию 20). " +
          "50 для глубокого анализа, 10 для быстрой проверки.",
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
          "Минимальное число отзывов (по умолчанию 25). " +
          "Увеличь до 50–100 если важна проверенность места.",
      },
      reasoning: {
        type: "string",
        description:
          "Краткое объяснение выбранных параметров (2–4 предложения).",
      },
    },
    required: ["url", "reasoning"],
  },
};

const SYSTEM_PROMPT = `Ты — помощник для поиска заведений общественного питания через Google Maps. Пользователь описывает, что ищет, и передаёт Google Maps URL. Ты составляешь параметры для Apify Google Places scraper.

Принципы:
- Координаты и zoom из URL не меняй.
- Keyword в URL замени на подходящий английский запрос по намерению пользователя (restaurant, cafe, sushi, pizza, bar и т.п.). Если намерение неясно — оставь keyword из оригинального URL.
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
