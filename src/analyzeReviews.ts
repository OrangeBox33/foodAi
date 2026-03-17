import Anthropic from "@anthropic-ai/sdk";
import type { PlaceForAI, PlaceData } from "./common/types.js";
import {
  CLAUDE_MODEL,
  EXTRACT_MAX_TOKENS,
  ANALYZE_MAX_TOKENS,
} from "./common/constants.js";
import {
  fromApiUsage,
  sumUsage,
  type TokenUsage,
} from "./common/helpers/usage.js";

const client = new Anthropic();

/** Минимум отзывов с текстом для надёжного анализа */
const MIN_REVIEWS_FOR_EXTRACTION = 3;

// ---------------------------------------------------------------------------
// Публичные типы
// ---------------------------------------------------------------------------

export interface PlaceRecommendation {
  placeId: string;
  name: string;
  whyItFits: string;
  verdict: string;
}

export interface AnalysisUsage {
  extractSignals: TokenUsage; // сумма по всем параллельным вызовам Stage 1
  rankPlaces: TokenUsage;
}

export interface AnalysisResult {
  recommendations: PlaceRecommendation[];
  summary: string;
  usage: AnalysisUsage;
}

// ---------------------------------------------------------------------------
// Stage 1 — внутренний тип сигналов
// ---------------------------------------------------------------------------

interface PlaceSignals {
  placeId: string;
  name: string;
  insufficientData: boolean;
  matchScore?: number;
  confirmedSignals?: string[];
  redFlags?: string[];
  freshnessTrend?: "improving" | "stable" | "declining";
  bestEvidence?: string;
  queryVerdict?: string;
}

// ---------------------------------------------------------------------------
// Stage 1 — инструмент извлечения сигналов
// ---------------------------------------------------------------------------

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_place_signals",
  description:
    "Извлекает ключевые сигналы из отзывов одного заведения применительно к запросу пользователя",
  input_schema: {
    type: "object",
    properties: {
      placeId: { type: "string", description: "place_id заведения" },
      name: { type: "string", description: "Название заведения" },
      insufficientData: {
        type: "boolean",
        description: "true если отзывов недостаточно для надёжного анализа",
      },
      matchScore: {
        type: "integer",
        description: "1–5: насколько отзывы подтверждают соответствие запросу",
      },
      confirmedSignals: {
        type: "array",
        items: { type: "string" },
        description:
          "Факты, подтверждённые ≥2 независимыми отзывами (например: «тихая атмосфера», «медленный сервис»)",
      },
      redFlags: {
        type: "array",
        items: { type: "string" },
        description:
          "Проблемы из свежих отзывов (последние 3–6 мес.) с указанием дат",
      },
      freshnessTrend: {
        type: "string",
        enum: ["improving", "stable", "declining"],
        description:
          "Тренд качества по свежим vs старым отзывам: improving / stable / declining",
      },
      bestEvidence: {
        type: "string",
        description:
          "Лучшая цитата по теме запроса с контекстом автора (LocalGuide? кол-во отзывов? лайки?)",
      },
      queryVerdict: {
        type: "string",
        description:
          "1–2 предложения: подходит ли заведение под запрос пользователя и почему",
      },
    },
    required: ["placeId", "name", "insufficientData"],
  },
};

const EXTRACT_SYSTEM_PROMPT = `Ты — аналитик отзывов. Твоя задача — извлечь объективные сигналы из отзывов одного заведения применительно к запросу пользователя.

Правила:
- В confirmedSignals включай только то, что упомянули ≥2 разных автора независимо
- Свежие отзывы (3–6 мес.) важнее старых — они определяют freshnessTrend
- Local Guide и авторы с большим числом отзывов — более надёжный источник
- Отзывы с высоким likesCount подтверждены сообществом
- Если отзывов с текстом меньше ${MIN_REVIEWS_FOR_EXTRACTION} — верни insufficientData: true, остальные поля не заполняй
- Не ранжируй и не сравнивай с другими заведениями — только извлекай факты`;

// ---------------------------------------------------------------------------
// Stage 2 — инструмент финального ранжирования
// ---------------------------------------------------------------------------

const RECOMMEND_TOOL: Anthropic.Tool = {
  name: "give_recommendations",
  description:
    "Выдаёт финальные рекомендации на основе аналитических карточек заведений",
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
                "Коротко тегами почему подходит. Пример: #тихо #романтика #быстро",
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
          "2–3 предложения: общий вывод по всем заведениям. " +
          "Если данных недостаточно для толкового анализа — укажи на это.",
      },
    },
    required: ["recommendations", "summary"],
  },
};

const RECOMMEND_SYSTEM_PROMPT = `Ты — эксперт по ресторанам и кафе. Тебе передают готовые аналитические карточки заведений с уже извлечёнными сигналами из отзывов. Твоя задача — выбрать ТОП-3, которые лучше всего подходят под запрос пользователя.

Как ранжировать:
- Приоритет: высокий matchScore + отсутствие redFlags + позитивный freshnessTrend
- Заведения с insufficientData попадают в рекомендации только если все остальные тоже без данных
- Если у лидера есть свежие redFlags — понизь его в списке
- Используй bestEvidence и confirmedSignals для обоснования выбора
- Будь критичен`;

// ---------------------------------------------------------------------------
// Сериализация одного заведения для Stage 1
// ---------------------------------------------------------------------------

function serializeOnePlace(
  place: PlaceForAI,
  placeData: PlaceData | undefined,
): string {
  const priceLabel =
    placeData?.price_level !== undefined
      ? "$".repeat(placeData.price_level) || "бесплатно"
      : (place.price ?? "н/д");
  const address = placeData?.vicinity ?? "";

  const header = [
    `Заведение: ${place.title}`,
    `Рейтинг: ${place.totalScore}/5 (${place.reviewsCount} отзывов всего)`,
    `Цена: ${priceLabel} | Категория: ${place.categoryName}`,
    address ? `Адрес: ${address}` : "",
    `Отзывов для анализа: ${place.reviews.length}`,
  ]
    .filter(Boolean)
    .join("\n");

  const reviews = place.reviews
    .map((r) => {
      const badges = [
        r.isLocalGuide ? "LocalGuide" : "",
        r.reviewerNumberOfReviews ? `${r.reviewerNumberOfReviews} отз.` : "",
        r.likesCount > 0 ? `👍${r.likesCount}` : "",
      ]
        .filter(Boolean)
        .join(", ");

      const date = r.publishedAtDate.slice(0, 10);
      return `  ★${r.stars} [${badges || "—"}] (${date}): "${r.text}"`;
    })
    .join("\n");

  return `${header}\nОтзывы:\n${reviews}`;
}

// ---------------------------------------------------------------------------
// Сериализация карточек сигналов для Stage 2
// ---------------------------------------------------------------------------

function serializeSignals(signals: PlaceSignals[]): string {
  return signals
    .map((s) => {
      if (s.insufficientData) {
        return `=== ${s.name} (placeId: ${s.placeId}) ===\nНЕДОСТАТОЧНО ДАННЫХ для анализа.`;
      }

      return [
        `=== ${s.name} (placeId: ${s.placeId}) ===`,
        `matchScore: ${s.matchScore}/5 | Тренд: ${s.freshnessTrend}`,
        `Подтверждённые сигналы: ${s.confirmedSignals?.join(", ") || "—"}`,
        s.redFlags?.length
          ? `Красные флаги: ${s.redFlags.join("; ")}`
          : "Красных флагов нет",
        `Лучшая цитата: ${s.bestEvidence || "—"}`,
        `Вывод: ${s.queryVerdict || "—"}`,
      ].join("\n");
    })
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Stage 1: извлечение сигналов одного заведения
// ---------------------------------------------------------------------------

interface ExtractResult {
  signals: PlaceSignals;
  usage: TokenUsage;
}

const ZERO_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

async function extractPlaceSignals(
  place: PlaceForAI,
  placeData: PlaceData | undefined,
  userPrompt: string,
): Promise<ExtractResult> {
  const reviewsWithText = place.reviews.filter((r) => r.text.trim().length > 0);

  const name = placeData?.name ?? place.title;

  if (reviewsWithText.length < MIN_REVIEWS_FOR_EXTRACTION) {
    return {
      signals: { placeId: place.placeId, name, insufficientData: true },
      usage: ZERO_USAGE,
    };
  }

  const serialized = serializeOnePlace(place, placeData);
  const userMessage = `Запрос пользователя: "${userPrompt}"\n\n${serialized}`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: EXTRACT_MAX_TOKENS,
    system: EXTRACT_SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "extract_place_signals" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    return {
      signals: { placeId: place.placeId, name, insufficientData: true },
      usage: fromApiUsage(response.usage),
    };
  }

  // placeId и name берём из реальных данных — Claude может вернуть неверные значения
  return {
    signals: { ...(toolUse.input as PlaceSignals), placeId: place.placeId, name },
    usage: fromApiUsage(response.usage),
  };
}

// ---------------------------------------------------------------------------
// Stage 2: финальное ранжирование по карточкам
// ---------------------------------------------------------------------------

interface RankResult {
  recommendations: PlaceRecommendation[];
  summary: string;
  usage: TokenUsage;
}

async function rankPlaces(
  signals: PlaceSignals[],
  userPrompt: string,
): Promise<RankResult> {
  const serialized = serializeSignals(signals);
  const userMessage = `Запрос пользователя: "${userPrompt}"\n\nАналитические карточки заведений:\n\n${serialized}`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: ANALYZE_MAX_TOKENS,
    system: RECOMMEND_SYSTEM_PROMPT,
    tools: [RECOMMEND_TOOL],
    tool_choice: { type: "tool", name: "give_recommendations" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Claude не вернул рекомендации");
  }

  const { recommendations, summary } = toolUse.input as {
    recommendations: PlaceRecommendation[];
    summary: string;
  };

  return { recommendations, summary, usage: fromApiUsage(response.usage) };
}

// ---------------------------------------------------------------------------
// Основная функция (публичный API без изменений)
// ---------------------------------------------------------------------------

export async function analyzeReviews(
  places: PlaceForAI[],
  placesData: PlaceData[],
  userPrompt: string,
): Promise<AnalysisResult> {
  if (places.length === 0) {
    return {
      recommendations: [],
      summary: "Заведения не найдены.",
      usage: { extractSignals: ZERO_USAGE, rankPlaces: ZERO_USAGE },
    };
  }

  const dataMap = new Map(placesData.map((p) => [p.place_id, p]));

  // Stage 1: параллельная экстракция сигналов по каждому заведению
  const settled = await Promise.allSettled(
    places.map((place) =>
      extractPlaceSignals(place, dataMap.get(place.placeId), userPrompt),
    ),
  );

  const signals: PlaceSignals[] = [];
  const extractUsages: TokenUsage[] = [];

  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      signals.push(result.value.signals);
      extractUsages.push(result.value.usage);
    } else {
      // Вызов упал — помечаем как insufficientData, не роняем весь пайплайн
      signals.push({
        placeId: places[i].placeId,
        name: places[i].title,
        insufficientData: true,
      });
    }
  });

  // Stage 2: финальное ранжирование по карточкам
  const {
    recommendations: rawRecs,
    summary,
    usage: rankUsage,
  } = await rankPlaces(signals, userPrompt);

  // Имена берём из signals по placeId — Claude в Stage 2 может вернуть неверное название
  const nameByPlaceId = new Map(signals.map((s) => [s.placeId, s.name]));
  const recommendations = rawRecs.map((rec) => ({
    ...rec,
    name: nameByPlaceId.get(rec.placeId) ?? rec.name,
  }));

  return {
    recommendations,
    summary,
    usage: {
      extractSignals: sumUsage(extractUsages),
      rankPlaces: rankUsage,
    },
  };
}
