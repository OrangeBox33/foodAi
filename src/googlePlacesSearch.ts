import type { GooglePlace, GridSplit, LatLng } from "./common/types.js";
import {
  DEFAULT_MIN_RATING,
  DEFAULT_SEARCH_RADIUS,
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

type Rectangle = {
  low: { latitude: number; longitude: number };
  high: { latitude: number; longitude: number };
};

function splitIntoGrid(
  lat: number,
  lng: number,
  radiusMeters: number,
  gridSplit: GridSplit,
): Rectangle[] {
  const deltaLat = radiusMeters / 111320;
  const deltaLng = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const n = Math.sqrt(gridSplit); // 2 для 4, 3 для 9
  const cellLat = (2 * deltaLat) / n;
  const cellLng = (2 * deltaLng) / n;
  const rects: Rectangle[] = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const lowLat = lat - deltaLat + row * cellLat;
      const lowLng = lng - deltaLng + col * cellLng;
      rects.push({
        low: { latitude: lowLat, longitude: lowLng },
        high: { latitude: lowLat + cellLat, longitude: lowLng + cellLng },
      });
    }
  }
  return rects;
}

function buildRequestBody(
  params: GoogleTextSearchParams,
  rectangle: Rectangle,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    textQuery: params.textQuery,
    languageCode: "en",
    rankPreference: "RELEVANCE",
    pageSize: 20,
    minRating: DEFAULT_MIN_RATING,
    locationRestriction: { rectangle },
  };

  if (params.includedType) {
    body.includedType = params.includedType;
  }
  if (params.opennow) {
    body.openNow = true;
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
  gridSplit: GridSplit = 4,
): Promise<GooglePlace[]> {
  console.log(`fetchNearbyPlaces (Text Search, ${gridSplit} cells)`, {
    location,
    params,
  });
  const radius = params.radius ?? DEFAULT_SEARCH_RADIUS;
  const cells = splitIntoGrid(location.lat, location.lng, radius, gridSplit);

  const responses = await Promise.all(
    cells.map((rect, i) => {
      const body = buildRequestBody(params, rect);
      console.log(`[Cell ${i + 1}/${gridSplit}]`);
      return fetchPage(body, apiKey);
    }),
  );

  // Объединяем результаты, дедуплицируем по place_id
  const seen = new Set<string>();
  const results: GooglePlace[] = [];
  for (const data of responses) {
    if (!data.places) continue;
    console.log("data.places.length", data.places.length);
    for (const place of data.places) {
      const mapped = mapToGooglePlace(place);
      if (!seen.has(mapped.place_id)) {
        seen.add(mapped.place_id);
        results.push(mapped);
      }
    }
  }

  console.log(
    `[fetchNearbyPlaces] Итого уникальных заведений: ${results.length}`,
  );
  return results;
}
