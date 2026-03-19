import { writeFileSync } from "fs";
import { analyzeReviews } from "./analyzeReviews.js";
import { apifyReviewScraper } from "./apifyReviewScraper.js";
import {
  DEFAULT_MAX_REVIEWS_PER_PLACE,
  DEFAULT_MIN_RATING,
  DEFAULT_MIN_REVIEW_COUNT,
  DEFAULT_OPENNOW,
  DEFAULT_MIN_PRICE,
  DEFAULT_MAX_PRICE,
} from "./common/constants.js";
import { filterPlaces } from "./common/helpers/filter.js";
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
  const minReviewCount = input.minReviewCount ?? DEFAULT_MIN_REVIEW_COUNT;

  const mergedInput: FindPlacesGoogleInput = {
    opennow: DEFAULT_OPENNOW,
    minprice: DEFAULT_MIN_PRICE,
    maxprice: DEFAULT_MAX_PRICE,
    ...input,
  };

  const location = await getLatLngFromGoogleMapsUrl(input.url);

  const rawPlaces = await fetchNearbyPlaces(location, mergedInput, apiKey);
  writeFileSync("fetchNearbyPlaces.json", JSON.stringify(rawPlaces, null, 2));

  const places = filterPlaces(rawPlaces, { minRating, minReviewCount });
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
