import "dotenv/config";
import {
  fetchNearbyPlacesApify,
  filterApifyPlaces,
} from "./apifyPlacesScraper.js";
import { scrapeReviews } from "./apifyReviewScraper.js";
import { mapReviewsForAI } from "./mapForAI.js";
import { analyzeReviews } from "./analyzeReviews.js";
import {
  DEFAULT_MAX_REVIEWS_PER_PLACE,
  DEFAULT_MIN_RATING,
  DEFAULT_MIN_REVIEW_COUNT,
} from "./constants.js";
import type { FindPlacesApifyInput, FindPlacesResult } from "./types.js";
import { parseIntentForApify } from "./parseIntentForApify.js";

export type {
  FindPlacesInput,
  FindPlacesApifyInput,
  FindPlacesResult,
  PlaceData,
  PlaceType,
} from "./types.js";
export type { ApifyPlace } from "./types.js";
export { parseIntent } from "./google/parseIntent.js";
export type { ParseIntentResult, IntentParams } from "./google/parseIntent.js";

export async function findPlacesApify(
  input: FindPlacesApifyInput,
): Promise<FindPlacesResult> {
  const maxReviewsPerPlace =
    input.maxReviewsPerPlace ?? DEFAULT_MAX_REVIEWS_PER_PLACE;
  const minRating = input.minRating ?? DEFAULT_MIN_RATING;
  const minReviewCount = input.minReviewCount ?? DEFAULT_MIN_REVIEW_COUNT;

  const rawPlaces = await fetchNearbyPlacesApify(input);

  const places = filterApifyPlaces(rawPlaces, { minRating, minReviewCount });

  const placeIds = places.map((p) => p.place_id);

  const reviews = await scrapeReviews({
    placeIds,
    maxReviews: maxReviewsPerPlace,
    reviewsSort: input.reviewsSort,
    reviewsOrigin: input.reviewsOrigin,
    personalData: input.personalData,
    reviewsStartDate: input.reviewsStartDate,
    language: input.lang,
  });

  const placesForAI = mapReviewsForAI(reviews);

  const userPrompt = input.userPrompt ?? "";
  const analysis = await analyzeReviews(placesForAI, places, userPrompt);

  return { places, placesForAI, analysis };
}

// Запуск напрямую: tsx src/index.ts
const isMain =
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js");
if (isMain) {
  const userPrompt =
    "Хочу посидеть с друзьями и поесть хорошей вьетнамской кухни. удобное место, приятое место, комфортное место, Минимальная цена 2. координаты 11.945639, 108.436421 ;; максимум заведений 60. максиммум отзывов 30.";

  // Переключение режима: USE_APIFY=1 npm start → Apify places scraper
  const useApify = process.env.USE_APIFY === "1";

  console.log(`Запрос: "${userPrompt}"`);
  console.log(
    `Режим: ${useApify ? "Apify places scraper" : "Google Places API"}\n`,
  );

  const { params, reasoning } = await parseIntentForApify(userPrompt);
  console.log("Параметры от Claude:", params);
  console.log("Reasoning:", reasoning, "\n");

  let result: FindPlacesResult;

  if (!params.lat || !params.lng) {
    throw new Error(
      "Укажи координаты в запросе, например: '...координаты 11.945639, 108.436421'",
    );
  }
  result = await findPlacesApify({
    userPrompt,
    ...params,
  });

  console.log(`Найдено заведений: ${result.places.length}`);
  for (const place of result.places) {
    console.log(
      `  ${place.name} | рейтинг: ${place.rating} | отзывов: ${place.user_ratings_total}` +
        `${place.price_level !== undefined ? ` | цена: ${"$".repeat(place.price_level)}` : ""}` +
        ` | ${place.vicinity}`,
    );
  }

  console.log("\n=== РЕКОМЕНДАЦИИ ===");
  console.log(result.analysis.summary);
  console.log();
  for (const rec of result.analysis.recommendations) {
    console.log(
      `#${result.analysis.recommendations.indexOf(rec) + 1} ${rec.name}`,
    );
    console.log(`   ${rec.whyItFits}`);
    console.log(`   Плюсы: ${rec.pros.join(" / ")}`);
    if (rec.cons.length) console.log(`   Минусы: ${rec.cons.join(" / ")}`);
    console.log(`   "${rec.notableQuote}"`);
    console.log(`   → ${rec.verdict}\n`);
  }
}
