import { analyzeReviews } from "./analyzeReviews.js";
import {
  fetchNearbyPlacesApify,
  filterApifyPlaces,
  mapApifyPlaceToPlaceData,
} from "./apifyPlacesScraper.js";
import {
  DEFAULT_MIN_RATING,
  DEFAULT_MIN_REVIEW_COUNT,
} from "./common/constants.js";
import { mapReviewsForAI } from "./common/helpers/mapForAI.js";
import { FindPlacesApifyInput, FindPlacesResult } from "./common/types.js";

export async function mainApify(
  input: FindPlacesApifyInput,
): Promise<FindPlacesResult> {
  const minRating = input.minRating ?? DEFAULT_MIN_RATING;
  const minReviewCount = input.minReviewCount ?? DEFAULT_MIN_REVIEW_COUNT;

  const { places: rawPlaces, apifyCostUsd } =
    await fetchNearbyPlacesApify(input);

  const filteredRaw = filterApifyPlaces(rawPlaces, {
    minRating,
    minReviewCount,
  });

  const places = filteredRaw.map(mapApifyPlaceToPlaceData);

  const placesForAI = mapReviewsForAI(filteredRaw);

  const userPrompt = input.userPrompt ?? "";
  const analysis = await analyzeReviews(placesForAI, places, userPrompt);

  return { places, placesForAI, analysis, apifyCostUsd };
}
