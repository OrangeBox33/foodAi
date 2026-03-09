import "dotenv/config";
import { resolveLocation } from "./resolveLocation.js";
import { fetchNearbyPlaces } from "./placesSearch.js";
import { filterPlaces } from "./filter.js";
import { scrapeReviews } from "./apifyScraper.js";
import { mapReviewsForAI } from "./mapForAI.js";
import { parseIntent } from "./parseIntent.js";
import { analyzeReviews } from "./analyzeReviews.js";
import type { FindPlacesInput, FindPlacesResult } from "./types.js";

export type { FindPlacesInput, FindPlacesResult, PlaceData, PlaceType } from "./types.js";
export { parseIntent } from "./parseIntent.js";
export type { ParseIntentResult, IntentParams } from "./parseIntent.js";

export async function findPlaces(input: FindPlacesInput): Promise<FindPlacesResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY не задан в переменных окружения");
  }

  const maxReviewsPerPlace = input.maxReviewsPerPlace ?? 20;
  const minRating = input.minRating ?? 4.2;
  const minReviewCount = input.minReviewCount ?? 15;

  const mergedInput: FindPlacesInput = {
    opennow: true,
    minprice: 0,
    maxprice: 3,
    ...input,
  };

  const location = await resolveLocation(mergedInput.url);

  const rawPlaces = await fetchNearbyPlaces(location, mergedInput, apiKey);

  const places = filterPlaces(rawPlaces, { minRating, minReviewCount });

  const placeIds = places.map((p) => p.place_id);

  const reviews = await scrapeReviews({
    placeIds,
    maxReviews: maxReviewsPerPlace,
    reviewsSort: input.reviewsSort,
    reviewsOrigin: input.reviewsOrigin,
    personalData: input.personalData,
    reviewsStartDate: input.reviewsStartDate,
    language: input.language,
  });

  const placesForAI = mapReviewsForAI(reviews);

  const userPrompt = input.userPrompt ?? "";
  const analysis = await analyzeReviews(placesForAI, places, userPrompt);

  return { places, placesForAI, analysis };
}

// Запуск напрямую: tsx src/index.ts
const isMain = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isMain) {
  const userPrompt = "ищу заведение с быстрой домашней местной едой, не ресторан";
  const url = "https://maps.app.goo.gl/Y1iWGCsNDk5cGuaJA";

  console.log(`Запрос: "${userPrompt}"\n`);

  const { params, reasoning } = await parseIntent(userPrompt);
  console.log("Параметры от Claude:", params);
  console.log("Reasoning:", reasoning, "\n");

  const result = await findPlaces({ url, userPrompt, ...params });

  console.log(`Найдено заведений: ${result.places.length}`);
  for (const place of result.places) {
    console.log(
      `  ${place.name} | рейтинг: ${place.rating} | отзывов: ${place.user_ratings_total}` +
      `${place.price_level !== undefined ? ` | цена: ${"$".repeat(place.price_level)}` : ""}` +
      ` | ${place.vicinity}`
    );
  }

  console.log("\n=== РЕКОМЕНДАЦИИ ===");
  console.log(result.analysis.summary);
  console.log();
  for (const rec of result.analysis.recommendations) {
    console.log(`#${result.analysis.recommendations.indexOf(rec) + 1} ${rec.name}`);
    console.log(`   ${rec.whyItFits}`);
    console.log(`   Плюсы: ${rec.pros.join(" / ")}`);
    if (rec.cons.length) console.log(`   Минусы: ${rec.cons.join(" / ")}`);
    console.log(`   "${rec.notableQuote}"`);
    console.log(`   → ${rec.verdict}\n`);
  }
}
