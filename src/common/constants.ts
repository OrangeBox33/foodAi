/** Максимальное число заведений, возвращаемых из поиска */
export const DEFAULT_MAX_PLACES = 30;

/** Число отзывов на заведение, передаваемых в Apify reviews scraper */
export const DEFAULT_MAX_REVIEWS_PER_PLACE = 20;

// Минимальный рейтинг заведения для включения в выдачу
export const DEFAULT_MIN_RATING = 4.2;

// Минимальное число отзывов для включения в выдачу
export const DEFAULT_MIN_REVIEW_COUNT = 25;

// ---------------------------------------------------------------------------
// Apify Places scraper (compass/crawler-google-places)
// ---------------------------------------------------------------------------

/** Язык результатов поиска и отзывов */
export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_REVIEWS_SORT = "newest";
export const DEFAULT_REVIEWS_ORIGIN = "all";
export const DEFAULT_PERSONAL_DATA = false;

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
export const DEFAULT_OPENNOW = true;

/** Минимальный ценовой уровень (0 = бесплатно) */
export const DEFAULT_MIN_PRICE = 0;

/** Максимальный ценовой уровень (3 = $$$) */
export const DEFAULT_MAX_PRICE = 3;

/** Задержка между страницами Google Places API (мс) — требование Google */
export const PAGINATION_DELAY_MS = 2000;
