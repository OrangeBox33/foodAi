import "dotenv/config";
import {
  fetchNearbyPlacesApify,
  filterApifyPlaces,
  mapApifyPlaceToPlaceData,
} from "./apifyPlacesScraper.js";
import { mapReviewsForAI } from "./mapForAI.js";
import { analyzeReviews } from "./analyzeReviews.js";
import { DEFAULT_MIN_RATING, DEFAULT_MIN_REVIEW_COUNT } from "./constants.js";
import type { FindPlacesApifyInput, FindPlacesResult } from "./types.js";
import { parseIntentForApify } from "./parseIntentForApify.js";
import { calcCost, sumUsage, type TokenUsage } from "./usage.js";

export type {
  FindPlacesApifyInput,
  FindPlacesResult,
  PlaceData,
  PlaceType,
} from "./types.js";
export type { ApifyPlace } from "./types.js";
export { parseIntent } from "./google/parseIntent.js";
export type { ParseIntentResult, IntentParams } from "./google/parseIntent.js";

export async function findPlacesApify(
  input: FindPlacesApifyInput,
): Promise<FindPlacesResult> {
  const minRating = input.minRating ?? DEFAULT_MIN_RATING;
  const minReviewCount = input.minReviewCount ?? DEFAULT_MIN_REVIEW_COUNT;

  const { places: rawPlaces, apifyCostUsd } =
    await fetchNearbyPlacesApify(input);

  const filteredRaw = filterApifyPlaces(rawPlaces, {
    minRating,
    minReviewCount,
  });

  const places = filteredRaw.map(mapApifyPlaceToPlaceData);

  const placesForAI = mapReviewsForAI(filteredRaw);

  const userPrompt = input.userPrompt ?? "";
  const analysis = await analyzeReviews(placesForAI, places, userPrompt);

  return { places, placesForAI, analysis, apifyCostUsd };
}

function fmtUsageLine(label: string, usage: TokenUsage, note = ""): string {
  const n = (v: number) => v.toLocaleString("ru-RU");
  const cost = calcCost(usage);
  const parts = [
    label.padEnd(18),
    `вход ${n(usage.inputTokens).padStart(7)}`,
    `выход ${n(usage.outputTokens).padStart(5)}`,
    cost > 0 ? `$${cost.toFixed(4)}` : "$0.0000",
  ];
  if (note) parts.push(note);
  return parts.join("  ");
}

function printUsageReport(
  parseUsage: TokenUsage,
  extractUsage: TokenUsage,
  rankUsage: TokenUsage,
  placesCount: number,
  apifyCostUsd: number,
): void {
  const total = sumUsage([parseUsage, extractUsage, rankUsage]);
  const totalCostUsd = calcCost(total) + apifyCostUsd;
  const divider = "─".repeat(62);

  console.log("\n=== ТОКЕНЫ И СТОИМОСТЬ ===");
  console.log(fmtUsageLine("parseIntent:", parseUsage));
  console.log(
    fmtUsageLine("extractSignals:", extractUsage, `(${placesCount} завед.)`),
  );
  console.log(fmtUsageLine("rankPlaces:", rankUsage));
  console.log(`${"Apify scraper:".padEnd(18)}  $${apifyCostUsd.toFixed(4)}`);
  console.log(divider);
  console.log(fmtUsageLine("Claude (итого):", total));
  console.log(`${"Всего:".padEnd(18)}  $${totalCostUsd.toFixed(4)}`);
}

// Запуск напрямую: tsx src/index.ts
const isMain =
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js");
if (isMain) {
  const userPrompt =
    'тестовый запуск url="https://www.google.com/maps/search/cafe/@11.9480696,108.4301579,15z" поиск по 3 заведениям, по 15 отзывов в каждом.';
  // Хочу посидеть с друзьями и поесть хорошей вьетнамской кухни. Качество и вкус еды важны. рис с курицей или карри. красивое местечко. уют, ламповость. цены средние или даже выше url="https://www.google.com/maps/search/cafe/@11.9480696,108.4301579,15z" поиск по 70 заведениям, по 15 отзывов в каждом.
  console.log(`Запрос: "${userPrompt}"\n`);

  const {
    params,
    reasoning,
    usage: parseUsage,
  } = await parseIntentForApify(userPrompt);
  console.log("Параметры от Claude:", params);
  console.log("Reasoning:", reasoning, "\n");

  const result = await findPlacesApify({
    userPrompt,
    ...params,
  });

  console.log(`Найдено заведений: ${result.places.length}`);

  console.log("\n=== РЕКОМЕНДАЦИИ ===");
  console.log(result.analysis.summary);
  console.log();
  for (const rec of result.analysis.recommendations) {
    console.log(
      `#${result.analysis.recommendations.indexOf(rec) + 1} ${rec.name}`,
    );
    console.log(`   ${rec.whyItFits}`);
    console.log(`   → ${rec.verdict}\n`);
  }

  printUsageReport(
    parseUsage,
    result.analysis.usage.extractSignals,
    result.analysis.usage.rankPlaces,
    result.placesForAI.length,
    result.apifyCostUsd,
  );
}
