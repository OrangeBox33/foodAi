import Anthropic from "@anthropic-ai/sdk";
import type { PlaceForAI, PlaceData } from "./types.js";
import { CLAUDE_MODEL, ANALYZE_MAX_TOKENS } from "./constants.js";

const client = new Anthropic();

// ---------------------------------------------------------------------------
// Публичные типы
// ---------------------------------------------------------------------------

export interface PlaceRecommendation {
  placeId: string;
  name: string;
  whyItFits: string;
  verdict: string;
}

export interface AnalysisResult {
  recommendations: PlaceRecommendation[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Инструмент для структурированного вывода
// ---------------------------------------------------------------------------

const TOOL: Anthropic.Tool = {
  name: "give_recommendations",
  description:
    "Выдаёт финальные рекомендации заведений на основе анализа отзывов",
  input_schema: {
    type: "object",
    properties: {
      recommendations: {
        type: "array",
        description: "ТОП-3 заведения, отсортированные от лучшего к худшему",
        items: {
          type: "object",
          properties: {
            placeId: { type: "string", description: "place_id заведения" },
            name: { type: "string", description: "Название заведения" },
            whyItFits: {
              type: "string",
              description:
                "Коротко тегами почему именно это заведение подходит под запрос пользователя. Пример: #тихо #романтика #быстро",
            },
            verdict: {
              type: "string",
              description: "Одно финальное предложение-вывод для пользователя",
            },
          },
          required: ["placeId", "name", "whyItFits", "verdict"],
        },
      },
      summary: {
        type: "string",
        description:
          "2–3 предложения: общий вывод по всем найденным заведениям. " +
          "Если отзывов или мест недостаточно для толкового анализа, то укажи на это и не делай конечных выводов.",
      },
    },
    required: ["recommendations", "summary"],
  },
};

// ---------------------------------------------------------------------------
// Сериализация данных — компактный текстовый формат для экономии токенов
// ---------------------------------------------------------------------------

function serializePlaces(
  places: PlaceForAI[],
  placesData: PlaceData[],
): string {
  const dataMap = new Map(placesData.map((p) => [p.place_id, p]));

  return places
    .map((place) => {
      const data = dataMap.get(place.placeId);
      const priceLabel =
        data?.price_level !== undefined
          ? "$".repeat(data.price_level) || "бесплатно"
          : (place.price ?? "н/д");
      const address = data?.vicinity ?? "";

      const header = [
        `=== ${place.title} ===`,
        `Рейтинг: ${place.totalScore}/5 (${place.reviewsCount} отзывов всего)`,
        `Цена: ${priceLabel} | Категория: ${place.categoryName}`,
        address ? `Адрес: ${address}` : "",
        `Проанализировано отзывов: ${place.reviews.length}`,
      ]
        .filter(Boolean)
        .join("\n");

      const reviews = place.reviews
        .map((r) => {
          const badges = [
            r.isLocalGuide ? "LocalGuide" : "",
            r.reviewerNumberOfReviews
              ? `${r.reviewerNumberOfReviews} отз.`
              : "",
            r.likesCount > 0 ? `👍${r.likesCount}` : "",
          ]
            .filter(Boolean)
            .join(", ");

          const date = r.publishedAtDate.slice(0, 10);

          return `  ★${r.stars} [${badges || "—"}] (${date}): "${r.text}"`;
        })
        .join("\n");

      return `${header}\nОтзывы:\n${reviews}`;
    })
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Системный промт
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Ты — эксперт по ресторанам и кафе. Тебе передают отзывы о заведениях поблизости и запрос пользователя. Твоя задача — найти ТОП-3 заведения, которые лучше всего подходят именно под этот запрос.

Как анализировать отзывы:
- Свежие отзывы (последние 3–6 месяцев) важнее старых: ситуация в заведении могла измениться
- Local Guide и авторы с большим числом отзывов пишут более взвешенно и детально
- Отзывы с высоким likesCount подтверждены сообществом — им доверяй больше
- Ищи паттерны: если 5 разных людей хвалят атмосферу — это факт, если один — мнение
- Ответ заведения на негативный отзыв говорит о внимании к качеству

Что важно учитывать:
- Строго сопоставляй с запросом пользователя: если просят "романтику" — ищи упоминания атмосферы, свечей, тихого места; если "быстро поесть" — скорость обслуживания
- Не рекомендуй заведение если несколько свежих отзывов сигнализируют о проблемах (плохой сервис, грязь, неактуальное меню)
- Цитаты должны быть живыми и информативными, а не дежурными "всё хорошо"
- Будь критичен
- Если отзывов или мест недостаточно для толкового анализа, то укажи на это и не делай конечных выводов.`;

// ---------------------------------------------------------------------------
// Основная функция
// ---------------------------------------------------------------------------

export async function analyzeReviews(
  places: PlaceForAI[],
  placesData: PlaceData[],
  userPrompt: string,
): Promise<AnalysisResult> {
  const serialized = serializePlaces(places, placesData);

  const userMessage = `Запрос пользователя: "${userPrompt}"

Данные о заведениях и отзывы:

${serialized}`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: ANALYZE_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "give_recommendations" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Claude не вернул рекомендации");
  }

  return toolUse.input as AnalysisResult;
}
