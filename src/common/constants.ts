/** Максимальное число заведений на этапе поиска */
export const DEFAULT_MAX_PLACES = 100;

/** Число заведений, по которым скрапим отзывы (выбираются из найденных) */
export const DEFAULT_MAX_PLACES_FOR_REVIEWS = 30;

/** Число отзывов на заведение, передаваемых в Apify reviews scraper */
export const DEFAULT_MAX_REVIEWS_PER_PLACE = 20;

// Минимальный рейтинг заведения для включения в выдачу (нежёсткий — основной отбор по взвешенной оценке)
export const DEFAULT_MIN_RATING = 1;

// ---------------------------------------------------------------------------
// Apify Places scraper (compass/crawler-google-places)
// ---------------------------------------------------------------------------

export const DEFAULT_REVIEWS_SORT = "newest";

// ---------------------------------------------------------------------------
// AI модель
// ---------------------------------------------------------------------------

/** Модель Claude для всех вызовов */
export const CLAUDE_MODEL = "claude-haiku-4-5";

/** Лимит токенов для parseIntent */
export const PARSE_INTENT_MAX_TOKENS = 1024;

/** Лимит токенов для Stage 1 — извлечение сигналов одного заведения */
export const EXTRACT_MAX_TOKENS = 1024;

/** Лимит токенов для Stage 2 — финальное ранжирование */
export const ANALYZE_MAX_TOKENS = 4096;

// ---------------------------------------------------------------------------
// Google Places Nearby Search
// ---------------------------------------------------------------------------

/** Радиус поиска в метрах */
export const DEFAULT_SEARCH_RADIUS = 500;

/** Показывать только открытые прямо сейчас */
export const DEFAULT_OPENNOW = false;

/** Задержка между страницами Google Places API (мс) — требование Google */
export const PAGINATION_DELAY_MS = 2000;
