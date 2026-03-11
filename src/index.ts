import "dotenv/config";
import {
  fetchNearbyPlacesApify,
  filterApifyPlaces,
  mapApifyPlaceToPlaceData,
} from "./apifyPlacesScraper.js";
import { mapReviewsForAI } from "./mapForAI.js";
import { analyzeReviews } from "./analyzeReviews.js";
import { DEFAULT_MIN_RATING, DEFAULT_MIN_REVIEW_COUNT } from "./constants.js";
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
  const minRating = input.minRating ?? DEFAULT_MIN_RATING;
  const minReviewCount = input.minReviewCount ?? DEFAULT_MIN_REVIEW_COUNT;

  const rawPlaces = await fetchNearbyPlacesApify(input);

  const filteredRaw = filterApifyPlaces(rawPlaces, {
    minRating,
    minReviewCount,
  });

  const places = filteredRaw.map(mapApifyPlaceToPlaceData);

  const placesForAI = mapReviewsForAI(filteredRaw);

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
    'Хочу посидеть с друзьями и поесть хорошей вьетнамской кухни. Качество и вкус еды важны. рис с курицей или карри. красивое местечко. уют, ламповость. цены средние или даже выше url="https://www.google.com/maps/search/cafe/@11.9480696,108.4301579,15z" поиск по 70 заведениям, по 15 отзывов в каждом.';

  console.log(`Запрос: "${userPrompt}"\n`);

  const { params, reasoning } = await parseIntentForApify(userPrompt);
  console.log("Параметры от Claude:", params);
  console.log("Reasoning:", reasoning, "\n");

  const result = await findPlacesApify({
    userPrompt,
    ...params,
  });

  console.log(`Найдено заведений: ${result.places.length}`);

  console.log("\n=== РЕКОМЕНДАЦИИ ===");
  console.log(result.analysis.summary);
  console.log();
  for (const rec of result.analysis.recommendations) {
    console.log(
      `#${result.analysis.recommendations.indexOf(rec) + 1} ${rec.name}`,
    );
    console.log(`   ${rec.whyItFits}`);
    console.log(`   → ${rec.verdict}\n`);
  }
}
