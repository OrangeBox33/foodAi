const GOOGLE_MAPS_URL_RE = /https:\/\/(?:maps\.app\.goo\.gl\/[^\s]+|www\.google\.com\/maps\/[^\s]+)/;

export function extractGoogleMapsUrl(prompt: string): string {
  const match = prompt.match(GOOGLE_MAPS_URL_RE);
  if (!match) {
    throw new Error("В запросе не найдена ссылка на Google Maps");
  }
  return match[0];
}
