const GOOGLE_MAPS_URL_RE = /https:\/\/www\.google\.com\/maps\/[^\s]+/;

export function extractGoogleMapsUrl(prompt: string): string {
  const match = prompt.match(GOOGLE_MAPS_URL_RE);
  if (!match) {
    throw new Error("В запросе не найдена ссылка на Google Maps");
  }
  return match[0];
}

// Заменяет KEYWORD в URL вида /maps/search/KEYWORD/@lat,lng,zoom
export function replaceGoogleMapsKeyword(url: string, keyword: string): string {
  return url.replace(
    /(\/maps\/search\/)[^/@]+/,
    `$1${keyword.replace(/\s+/g, "+")}`,
  );
}
