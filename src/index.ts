import "dotenv/config";
import { parseIntentForApify } from "./parseIntentForApify.js";
import { parseIntentForGoogle } from "./parseIntentForGoogle.js";
import { printUsageReport } from "./common/helpers/usage.js";
import { mainApify } from "./mainApify.js";
import { mainGoogle } from "./mainGoogle.js";

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

  if (useApify) {
    const userPrompt =
      'тестовый запуск url="https://www.google.com/maps/search/cafe/@11.9480696,108.4301579,15z" поиск по 3 заведениям, по 15 отзывов в каждом.';
    console.log(`[Apify] Запрос: "${userPrompt}"\n`);

    const {
      params,
      reasoning,
      usage: parseUsage,
    } = await parseIntentForApify(userPrompt);
    console.log("Параметры от Claude:", params);
    console.log("Reasoning:", reasoning, "\n");

    const result = await mainApify({ userPrompt, ...params });

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
  } else {
    const url =
      "https://www.google.com/maps/search/cafe/@11.9480696,108.4301579,15z";
    const userPrompt =
      "тестовый запуск поиск по 3 заведениям, по 15 отзывов в каждом.";
    console.log(`[Google] Запрос: "${userPrompt}"\n`);

    const {
      params,
      reasoning,
      usage: parseUsage,
    } = await parseIntentForGoogle(userPrompt);
    console.log("Параметры от Claude:", params);
    console.log("Reasoning:", reasoning, "\n");

    const result = await mainGoogle({ url, userPrompt, ...params });

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
}
