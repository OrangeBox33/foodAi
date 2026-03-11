import type { LatLng } from "./common/types.js";

// Паттерны для извлечения координат из URL
const COORD_PATTERNS = [
  /@(-?\d+\.\d+),(-?\d+\.\d+)/, // @lat,lng (Google Maps стандарт)
  /\/search\/(-?\d+\.\d+)[,+\s]+(-?\d+\.\d+)/, // /search/lat,+lng
  /[?&]query=(-?\d+\.\d+)[,+\s]+(-?\d+\.\d+)/, // query=lat,+lng
  /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/, // ll=lat,lng
  /\/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/, // /place/Name/@lat,lng
];

function extractCoordsFromUrl(url: string): LatLng | null {
  for (const pattern of COORD_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
  }
  return null;
}

async function followRedirects(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
  });
  return response.url;
}

export async function resolveLocation(shortUrl: string): Promise<LatLng> {
  const finalUrl = await followRedirects(shortUrl);

  const coords = extractCoordsFromUrl(finalUrl);
  if (coords) {
    return coords;
  }

  // Если координаты не найдены в URL — пробуем исходную ссылку
  const coordsFromInput = extractCoordsFromUrl(shortUrl);
  if (coordsFromInput) {
    return coordsFromInput;
  }

  throw new Error(
    `Не удалось извлечь координаты из URL: ${finalUrl}\nИсходный URL: ${shortUrl}`,
  );
}
