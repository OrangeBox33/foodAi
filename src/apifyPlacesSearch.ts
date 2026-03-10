import { ApifyClient } from "apify-client";
import type { ApifyPlace, FindPlacesApifyInput, PlaceData } from "./types.js";

const ACTOR_ID = "compass/crawler-google-places";

export async function fetchPlacesViaApify(
  input: FindPlacesApifyInput,
): Promise<ApifyPlace[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN не задан в переменных окружения");
  }

  const client = new ApifyClient({ token });

  const actorInput = {
    searchStringsArray: [input.query],
    lat: "11.945639",
    lng: "108.436421",
    maxCrawledPlacesPerSearch: 40,
    zoom: 12,
    language: "en",
  };

  const run = await client.actor(ACTOR_ID).call(actorInput);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return items as unknown as ApifyPlace[];
}

export function mapApifyPlaceToPlaceData(place: ApifyPlace): PlaceData {
  return {
    place_id: place.placeId,
    name: place.title,
    rating: place.totalScore ?? 0,
    user_ratings_total: place.reviewsCount ?? 0,
    price_level: parsePriceLevel(place.price),
    vicinity: place.address ?? "",
    types: place.categories ?? [],
    geometry: {
      location: {
        lat: place.location?.lat ?? 0,
        lng: place.location?.lng ?? 0,
      },
    },
  };
}

export function filterApifyPlaces(
  places: ApifyPlace[],
  options: { minRating: number; minReviewCount: number },
): PlaceData[] {
  return places
    .filter(
      (p) =>
        (p.totalScore ?? 0) >= options.minRating &&
        (p.reviewsCount ?? 0) >= options.minReviewCount,
    )
    .map(mapApifyPlaceToPlaceData);
}

function parsePriceLevel(priceLevel: string | null): number | undefined {
  if (!priceLevel) return undefined;
  // "$" → 1, "$$" → 2, "$$$" → 3, "$$$$" → 4
  const match = priceLevel.match(/^\$+$/);
  if (match) return priceLevel.length;
  // Если число
  const num = parseInt(priceLevel, 10);
  if (!isNaN(num)) return num;
  return undefined;
}
