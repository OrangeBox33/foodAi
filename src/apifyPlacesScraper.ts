import { ApifyClient } from "apify-client";
import type {
  ApifyPlace,
  FindPlacesApifyInput,
  PlaceData,
} from "./common/types.js";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_MAX_PLACES,
  DEFAULT_MAX_REVIEWS_PER_PLACE,
} from "./common/constants.js";

const ACTOR_ID = "compass/crawler-google-places";

export function extractPlaceId(url: string): string {
  const match = url.match(/query_place_id=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : url;
}

export async function apifyPlacesScraper(
  input: FindPlacesApifyInput,
): Promise<{ places: ApifyPlace[]; apifyCostUsd: number }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN не задан в переменных окружения");
  }

  const client = new ApifyClient({ token });

  const actorInput = {
    startUrls: [{ url: input.url }],
    maxCrawledPlacesPerSearch: input.maxPlaces ?? DEFAULT_MAX_PLACES,
    maxReviews: input.maxReviewsPerPlace ?? DEFAULT_MAX_REVIEWS_PER_PLACE,
    language: input.language ?? DEFAULT_LANGUAGE,
    reviewsSort: input.reviewsSort ?? "newest",
    reviewsOrigin: input.reviewsOrigin ?? "all",
    skipClosedPlaces: true,
    apifyReviewScraperPersonalData: input.personalData ?? false,
    maxImages: 0,
    maxQuestions: 0,
  };

  const run = await client.actor(ACTOR_ID).call(actorInput);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return {
    places: items as unknown as ApifyPlace[],
    apifyCostUsd: run.usageTotalUsd ?? 0,
  };
}

export function mapApifyPlaceToPlaceData(place: ApifyPlace): PlaceData {
  const placeId = extractPlaceId(place.url);
  const vicinity = [place.street, place.city].filter(Boolean).join(", ");

  return {
    place_id: placeId,
    name: place.title,
    rating: place.totalScore ?? 0,
    user_ratings_total: place.reviewsCount ?? 0,
    price_level: parsePriceLevel(place.price),
    vicinity,
    types: place.categories ?? [],
    geometry: {
      location: { lat: 0, lng: 0 },
    },
  };
}

export function filterApifyPlaces(
  places: ApifyPlace[],
  options: { minRating: number; minReviewCount: number },
): ApifyPlace[] {
  return places.filter(
    (p) =>
      (p.totalScore ?? 0) >= options.minRating &&
      (p.reviewsCount ?? 0) >= options.minReviewCount,
  );
}

function parsePriceLevel(priceLevel: string | null): number | undefined {
  if (!priceLevel) return undefined;
  const match = priceLevel.match(/^\$+$/);
  if (match) return priceLevel.length;
  const num = parseInt(priceLevel, 10);
  if (!isNaN(num)) return num;
  return undefined;
}
