import type {
  FindPlacesInput,
  GooglePlace,
  GooglePlacesResponse,
  LatLng,
} from "../types.js";
import {
  DEFAULT_MAX_PLACES,
  DEFAULT_SEARCH_RADIUS,
  PAGINATION_DELAY_MS,
} from "../constants.js";

const NEARBY_SEARCH_URL =
  "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

// Внутренние параметры, не передаваемые напрямую в Google API
const INTERNAL_PARAMS = new Set([
  "url",
  "maxPlaces",
  "maxReviewsPerPlace",
  "minRating",
  "minReviewCount",
  "type",
  "radius",
  "keyword",
  "pagetoken",
  // Apify-параметры
  "reviewsSort",
  "reviewsOrigin",
  "personalData",
  "reviewsStartDate",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(
  params: URLSearchParams,
): Promise<GooglePlacesResponse> {
  const url = `${NEARBY_SEARCH_URL}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Google Places API HTTP error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as GooglePlacesResponse;

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(
      `Google Places API error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`,
    );
  }

  return data;
}

export async function fetchNearbyPlaces(
  location: LatLng,
  input: FindPlacesInput,
  apiKey: string,
): Promise<GooglePlace[]> {
  const maxPlaces = input.maxPlaces ?? DEFAULT_MAX_PLACES;
  const results: GooglePlace[] = [];

  // Базовые параметры запроса
  const baseParams: Record<string, string> = {
    key: apiKey,
    location: `${location.lat},${location.lng}`,
    radius: String(input.radius ?? DEFAULT_SEARCH_RADIUS),
    type: input.type,
    rankby: "prominence",
  };

  if (input.keyword) {
    baseParams.keyword = input.keyword;
  }

  // Прокидываем все остальные допустимые параметры из input
  for (const [key, value] of Object.entries(input)) {
    if (!INTERNAL_PARAMS.has(key) && value !== undefined && value !== null) {
      baseParams[key] = String(value);
    }
  }

  let pagetoken: string | undefined;
  let pagesLoaded = 0;
  const maxPages = Math.ceil(Math.min(maxPlaces, 60) / 20);

  do {
    const params = new URLSearchParams(baseParams);
    if (pagetoken) {
      params.set("pagetoken", pagetoken);
    }

    const data = await fetchPage(params);
    results.push(...data.results);
    pagetoken = data.next_page_token;
    pagesLoaded++;

    // Google требует задержку перед использованием pagetoken
    if (pagetoken && pagesLoaded < maxPages && results.length < maxPlaces) {
      await sleep(PAGINATION_DELAY_MS);
    }
  } while (pagetoken && pagesLoaded < maxPages && results.length < maxPlaces);

  return results.slice(0, maxPlaces);
}
