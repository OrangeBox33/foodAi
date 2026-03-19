import type { LatLng } from "./common/types.js";

const apiKey = process.env.GOOGLE_PLACES_API_KEY;

// --- 1. Раскрыть редиректы ---
async function resolveUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      // форсим десктоп — чаще даёт координаты
      "User-Agent": "Mozilla/5.0",
    },
  });

  return res.url;
}

// --- 2. Извлечь place_id (ChIJ...) ---
function extractPlaceId(url: string): string | null {
  const match = url.match(/ChI[a-zA-Z0-9_-]+/);
  return match ? match[0] : null;
}

// --- 3. Извлечь координаты из URL ---
function extractLatLng(url: string): LatLng | null {
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!match) return null;

  return {
    lat: parseFloat(match[1]),
    lng: parseFloat(match[2]),
  };
}

// --- 4. Извлечь текст (название + адрес) ---
function extractTextQuery(url: string): string | null {
  try {
    const decoded = decodeURIComponent(url);

    const match = decoded.match(/\/place\/([^/]+)/);
    if (!match) return null;

    // "Mia house coffee, 135 Phạm Tứ, Đà Nẵng"
    return match[1].replace(/\+/g, " ");
  } catch {
    return null;
  }
}

// --- 5. Find Place ---
async function findPlaceLatLng(query: string): Promise<LatLng | null> {
  const url =
    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
    `?input=${encodeURIComponent(query)}` +
    "&inputtype=textquery" +
    "&fields=geometry" +
    `&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  const location = data?.candidates?.[0]?.geometry?.location;
  if (!location) return null;

  return {
    lat: location.lat,
    lng: location.lng,
  };
}

// --- 6. Place Details ---
async function getLatLngByPlaceId(placeId: string): Promise<LatLng | null> {
  const url =
    "https://maps.googleapis.com/maps/api/place/details/json" +
    `?place_id=${placeId}` +
    "&fields=geometry" +
    `&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  const location = data?.result?.geometry?.location;
  if (!location) return null;

  return {
    lat: location.lat,
    lng: location.lng,
  };
}

// --- MAIN ---
export async function getLatLngFromGoogleMapsUrl(
  inputUrl: string,
): Promise<LatLng> {
  // 1. раскрываем short link
  const finalUrl = await resolveUrl(inputUrl);

  // 2. пробуем вытащить координаты напрямую
  const LatLng = extractLatLng(finalUrl);
  if (LatLng) return LatLng;

  // 3. пробуем вытащить place_id
  const placeId = extractPlaceId(finalUrl);
  if (placeId) {
    const LatLng = await getLatLngByPlaceId(placeId);
    if (LatLng) return LatLng;
  }

  // 4. fallback → текстовый поиск
  const query = extractTextQuery(finalUrl);
  if (query) {
    const LatLng = await findPlaceLatLng(query);
    if (LatLng) return LatLng;
  }

  throw new Error(
    `Не удалось извлечь координаты из URL: ${finalUrl}\nИсходный URL: ${inputUrl}`,
  );
}
