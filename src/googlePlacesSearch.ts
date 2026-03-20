import type { GooglePlace, LatLng } from "./common/types.js";
import {
  DEFAULT_MIN_RATING,
  DEFAULT_SEARCH_RADIUS,
  PAGINATION_DELAY_MS,
  TEXT_SEARCH_FIELD_MASK,
} from "./common/constants.js";

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

export interface GoogleTextSearchParams {
  textQuery: string;
  includedType?: string;
  radius?: number;
  opennow?: boolean;
}

// ---------------------------------------------------------------------------
// Типы ответа Google Text Search (New)
// ---------------------------------------------------------------------------

interface TextSearchPlace {
  id: string;
  displayName?: { text: string; languageCode?: string };
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  primaryType?: string;
  priceLevel?: string;
  regularOpeningHours?: { openNow?: boolean };
  businessStatus?: string;
}

interface TextSearchResponse {
  places?: TextSearchPlace[];
  nextPageToken?: string;
}

// ---------------------------------------------------------------------------
// Маппинг priceLevel enum → число (совместимость с downstream)
// ---------------------------------------------------------------------------

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function mapToGooglePlace(place: TextSearchPlace): GooglePlace {
  return {
    place_id: place.id,
    name: place.displayName?.text ?? "",
    rating: place.rating,
    user_ratings_total: place.userRatingCount,
    price_level: place.priceLevel
      ? PRICE_LEVEL_MAP[place.priceLevel]
      : undefined,
    vicinity: place.shortFormattedAddress,
    types: place.types,
    geometry: place.location
      ? {
          location: {
            lat: place.location.latitude,
            lng: place.location.longitude,
          },
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRequestBody(
  params: GoogleTextSearchParams,
  location: LatLng,
  pageToken?: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    textQuery: params.textQuery,
    languageCode: "en",
    rankPreference: "RELEVANCE",
    pageSize: 20,
    minRating: DEFAULT_MIN_RATING,
    locationRestriction: {
      circle: {
        center: {
          latitude: location.lat,
          longitude: location.lng,
        },
        radius: params.radius ?? DEFAULT_SEARCH_RADIUS,
      },
    },
  };

  if (params.includedType) {
    body.includedType = params.includedType;
  }
  if (params.opennow) {
    body.openNow = true;
  }
  if (pageToken) {
    body.pageToken = pageToken;
  }

  return body;
}

// ---------------------------------------------------------------------------
// Запрос одной страницы
// ---------------------------------------------------------------------------

async function fetchPage(
  body: Record<string, unknown>,
  apiKey: string,
): Promise<TextSearchResponse> {
  const logBody = { ...body };
  console.log("[Google Text Search API] →", JSON.stringify(logBody, null, 2));

  const response = await fetch(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": TEXT_SEARCH_FIELD_MASK + ",nextPageToken",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Text Search API HTTP error: ${response.status} ${response.statusText} — ${errorText}`,
    );
  }

  const data = (await response.json()) as TextSearchResponse;
  return data;
}

// ---------------------------------------------------------------------------
// Основная функция — пагинированный поиск
// ---------------------------------------------------------------------------

export async function fetchNearbyPlaces(
  location: LatLng,
  params: GoogleTextSearchParams,
  apiKey: string,
): Promise<GooglePlace[]> {
  console.log("fetchNearbyPlaces (Text Search)", { location, params });
  const results: GooglePlace[] = [];

  let pageToken: string | undefined;
  let pagesLoaded = 0;
  const maxPages = 3; // 3 страницы × 20 = 60 заведений максимум

  do {
    const body = buildRequestBody(params, location, pageToken);
    const data = await fetchPage(body, apiKey);

    if (data.places) {
      results.push(...data.places.map(mapToGooglePlace));
    } else if (pagesLoaded === 0) {
      console.log(
        "[Google Text Search API] Нет результатов по заданным параметрам",
      );
    }

    pageToken = data.nextPageToken;
    pagesLoaded++;

    if (pageToken && pagesLoaded < maxPages) {
      await sleep(PAGINATION_DELAY_MS);
    }
  } while (pageToken && pagesLoaded < maxPages);

  return results;
}
