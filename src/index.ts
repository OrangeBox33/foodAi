import "dotenv/config";
import { parseIntentForApify } from "./parseIntentForApify.js";
import { parseIntentForGoogle } from "./parseIntentForGoogle.js";
import { printUsageReport } from "./common/helpers/usage.js";
import {
  extractGoogleMapsUrl,
  replaceGoogleMapsKeyword,
} from "./common/helpers/urlMatch.js";
import type { ApifyIntentParams } from "./parseIntentForApify.js";
import { mainApify } from "./mainApify.js";
import { mainGoogle } from "./mainGoogle.js";
import { FindPlacesGoogleInput } from "./common/types.js";

export type {
  FindPlacesApifyInput,
  FindPlacesGoogleInput,
  FindPlacesResult,
  PlaceData,
  PlaceType,
} from "./common/types.js";
export type { ApifyPlace } from "./common/types.js";
export type {
  ParseIntentResult,
  IntentParams,
} from "./parseIntentForGoogle.js";

// ---------------------------------------------------------------------------
// Запуск напрямую: tsx src/index.ts
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js");

if (isMain) {
  const useApify = process.env.USE_APIFY === "1";

  const userPrompt =
    "Хочу поесть ВКУСНОЙ вьетнамской или азиатской еды. Быстрая еда. Блюда из риса желательно. https://maps.app.goo.gl/GAXdoPfQB6yXbHKD6 поиск по 5 заведениям, по 1 отзывов в каждом. радиус 300м. keyword оставь пустым. type=restaurant. minRating=1";

  console.log(`[${useApify ? "Apify" : "Google"}] Запрос: "${userPrompt}"\n`);

  const baseUrl = extractGoogleMapsUrl(userPrompt);

  const {
    params,
    reasoning,
    usage: parseUsage,
  } = useApify
    ? await parseIntentForApify(userPrompt)
    : await parseIntentForGoogle(userPrompt);

  console.log("Параметры от Claude:", params);
  console.log("Reasoning:", reasoning, "\n");

  const url = useApify
    ? replaceGoogleMapsKeyword(baseUrl, (params as ApifyIntentParams).keyword)
    : baseUrl;

  const result = useApify
    ? await mainApify({ url, userPrompt, ...params })
    : await mainGoogle({ url, userPrompt, ...params } as FindPlacesGoogleInput);

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
