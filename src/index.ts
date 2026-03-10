import "dotenv/config";
import { resolveLocation } from "./resolveLocation.js";
import { fetchNearbyPlaces } from "./placesSearch.js";
import { filterPlaces } from "./filter.js";
import { fetchPlacesViaApify, filterApifyPlaces } from "./apifyPlacesSearch.js";
import { scrapeReviews } from "./apifyScraper.js";
import { mapReviewsForAI } from "./mapForAI.js";
import { parseIntent } from "./parseIntent.js";
import { analyzeReviews } from "./analyzeReviews.js";
import type {
  FindPlacesInput,
  FindPlacesApifyInput,
  FindPlacesResult,
} from "./types.js";

export type {
  FindPlacesInput,
  FindPlacesApifyInput,
  FindPlacesResult,
  PlaceData,
  PlaceType,
} from "./types.js";
export type { ApifyPlace } from "./types.js";
export { parseIntent } from "./parseIntent.js";
export type { ParseIntentResult, IntentParams } from "./parseIntent.js";

export async function findPlaces(
  input: FindPlacesInput,
): Promise<FindPlacesResult> {
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

export async function findPlacesApify(
  input: FindPlacesApifyInput,
): Promise<FindPlacesResult> {
  const maxReviewsPerPlace = input.maxReviewsPerPlace ?? 20;
  const minRating = Math.min(input.minRating ?? 4.0, 4.3);
  const minReviewCount = input.minReviewCount ?? 25;

  const rawPlaces = await fetchPlacesViaApify(input);

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

  const { params, reasoning } = await parseIntent(userPrompt);
  console.log("Параметры от Claude:", params);
  console.log("Reasoning:", reasoning, "\n");

  let result: FindPlacesResult;

  if (useApify) {
    if (!params.lat || !params.lng) {
      throw new Error(
        "Укажи координаты в запросе, например: '...координаты 11.945639, 108.436421'",
      );
    }
    result = await findPlacesApify({
      query: params.query ?? params.type ?? "cafe",
      lat: params.lat,
      lng: params.lng,
      userPrompt,
      ...params,
    });
  } else {
    const url = "https://maps.app.goo.gl/Y1iWGCsNDk5cGuaJA";
    result = await findPlaces({ url, userPrompt, ...params });
  }

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
