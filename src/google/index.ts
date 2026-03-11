import { analyzeReviews } from "../analyzeReviews.js";
import { scrapeReviews } from "../apifyReviewScraper.js";
import {
  DEFAULT_MAX_REVIEWS_PER_PLACE,
  DEFAULT_MIN_RATING,
  DEFAULT_MIN_REVIEW_COUNT,
  DEFAULT_OPENNOW,
  DEFAULT_MIN_PRICE,
  DEFAULT_MAX_PRICE,
} from "../constants.js";
import { filterPlaces } from "../filter.js";
import { mapFlatReviewsForAI } from "../mapForAI.js";
import { resolveLocation } from "../resolveLocation.js";
import { FindPlacesInput, FindPlacesResult } from "../types.js";
import { fetchNearbyPlaces } from "./placesSearch.js";

export async function findPlaces(
  input: FindPlacesInput,
): Promise<FindPlacesResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY не задан в переменных окружения");
  }

  const maxReviewsPerPlace =
    input.maxReviewsPerPlace ?? DEFAULT_MAX_REVIEWS_PER_PLACE;
  const minRating = input.minRating ?? DEFAULT_MIN_RATING;
  const minReviewCount = input.minReviewCount ?? DEFAULT_MIN_REVIEW_COUNT;

  const mergedInput: FindPlacesInput = {
    opennow: DEFAULT_OPENNOW,
    minprice: DEFAULT_MIN_PRICE,
    maxprice: DEFAULT_MAX_PRICE,
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

  const placesForAI = mapFlatReviewsForAI(reviews);

  const userPrompt = input.userPrompt ?? "";
  const analysis = await analyzeReviews(placesForAI, places, userPrompt);

  return { places, placesForAI, analysis };
}
