import { writeFileSync } from "fs";
import { analyzeReviews } from "./analyzeReviews.js";
import { apifyReviewScraper } from "./apifyReviewScraper.js";
import {
  DEFAULT_MAX_REVIEWS_PER_PLACE,
  DEFAULT_MIN_RATING,
  DEFAULT_MAX_PLACES_FOR_REVIEWS,
  DEFAULT_OPENNOW,
} from "./common/constants.js";
import { filterPlaces, selectTopPlaces } from "./common/helpers/filter.js";
import { mapFlatReviewsForAI } from "./common/helpers/mapForAI.js";
import { FindPlacesGoogleInput, FindPlacesResult } from "./common/types.js";
import { fetchNearbyPlaces } from "./googlePlacesSearch.js";
import { getLatLngFromGoogleMapsUrl } from "./resolveLocation.js";

export async function mainGoogle(
  input: FindPlacesGoogleInput,
): Promise<FindPlacesResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY не задан в переменных окружения");
  }

  const maxReviewsPerPlace =
    input.maxReviewsPerPlace ?? DEFAULT_MAX_REVIEWS_PER_PLACE;
  const minRating = input.minRating ?? DEFAULT_MIN_RATING;
  const maxForReviews = input.maxForReviews ?? DEFAULT_MAX_PLACES_FOR_REVIEWS;

  const mergedInput: FindPlacesGoogleInput = {
    opennow: DEFAULT_OPENNOW,
    ...input,
  };

  const location = await getLatLngFromGoogleMapsUrl(input.url);

  const rawPlaces = await fetchNearbyPlaces(location, mergedInput, apiKey);
  writeFileSync(
    "fetchNearbyPlacesInput.json",
    JSON.stringify({ location, mergedInput }, null, 2),
  );
  writeFileSync("fetchNearbyPlaces.json", JSON.stringify(rawPlaces, null, 2));

  console.log(`[Поиск] Получено заведений от Google: ${rawPlaces.length}`);

  const filtered = filterPlaces(rawPlaces, {
    minRating,
    minReviewCount: input.minReviewCount,
    keyword: input.keyword,
  });
  writeFileSync(
    "fetchNearbyPlacesFiltered.json",
    JSON.stringify(filtered, null, 2),
  );
  const places = selectTopPlaces(filtered, maxForReviews);
  writeFileSync(
    "fetchNearbyPlacesTop.json",
    JSON.stringify({ maxForReviews, filtered }, null, 2),
  );

  console.log(`[Отбор] Выбрано для скрапинга отзывов: ${places.length}`);
  places.forEach((p, i) => {
    const score = (p.rating * Math.log(p.user_ratings_total + 1)).toFixed(2);
    console.log(
      `  ${i + 1}. ${p.name} — рейтинг: ${p.rating}, отзывов: ${p.user_ratings_total}, score: ${score}`,
    );
  });

  const userPrompt = input.userPrompt ?? "";

  if (places.length === 0) {
    const analysis = await analyzeReviews([], [], userPrompt);
    return { places: [], placesForAI: [], analysis, apifyCostUsd: 0 };
  }

  const { reviews, apifyCostUsd } = await apifyReviewScraper({
    placeIds: places.map((p) => p.place_id),
    limit: maxReviewsPerPlace,
    order: input.reviewsSort,
  });

  const placesForAI = mapFlatReviewsForAI(reviews);
  const analysis = await analyzeReviews(placesForAI, places, userPrompt);

  return { places, placesForAI, analysis, apifyCostUsd };
}
