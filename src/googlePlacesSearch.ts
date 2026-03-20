import type {
  GooglePlace,
  GooglePlacesResponse,
  LatLng,
  PlaceType,
} from "./common/types.js";
import {
  DEFAULT_SEARCH_RADIUS,
  PAGINATION_DELAY_MS,
} from "./common/constants.js";

const NEARBY_SEARCH_URL =
  "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

export interface GoogleNearbySearchParams {
  type: PlaceType;
  radius?: number;
  opennow?: boolean;
  minprice?: number;
  maxprice?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(
  params: URLSearchParams,
): Promise<GooglePlacesResponse> {
  const urlParams = new URLSearchParams(params);
  urlParams.delete("key"); // не логируем ключ
  const url = `${NEARBY_SEARCH_URL}?${params.toString()}`;
  console.log("[Google API] →", `${NEARBY_SEARCH_URL}?${urlParams.toString()}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Google Places API HTTP error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as GooglePlacesResponse;

  if (data.status === "ZERO_RESULTS") {
    console.log(
      "[Google API] ZERO_RESULTS — нет заведений по заданным параметрам",
    );
  } else if (data.status !== "OK") {
    throw new Error(
      `Google Places API error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`,
    );
  }

  return data;
}

export async function fetchNearbyPlaces(
  location: LatLng,
  params: GoogleNearbySearchParams,
  apiKey: string,
): Promise<GooglePlace[]> {
  console.log("fetchNearbyPlaces", { location, params });
  const results: GooglePlace[] = [];

  const baseParams: Record<string, string> = {
    key: apiKey,
    location: `${location.lat},${location.lng}`,
    radius: String(params.radius ?? DEFAULT_SEARCH_RADIUS),
    type: params.type,
    rankby: "prominence",
  };

  if (params.opennow) baseParams.opennow = "true";
  if (params.minprice !== undefined)
    baseParams.minprice = String(params.minprice);
  if (params.maxprice !== undefined)
    baseParams.maxprice = String(params.maxprice);

  let pagetoken: string | undefined;
  let pagesLoaded = 0;
  const maxPages = 3; // 3 страницы × 20 = 60 заведений максимум

  do {
    const urlParams = new URLSearchParams(baseParams);
    if (pagetoken) {
      urlParams.set("pagetoken", pagetoken);
    }

    const data = await fetchPage(urlParams);
    results.push(...data.results);
    pagetoken = data.next_page_token;
    pagesLoaded++;

    if (pagetoken && pagesLoaded < maxPages) {
      await sleep(PAGINATION_DELAY_MS);
    }
  } while (pagetoken && pagesLoaded < maxPages);

  return results;
}
