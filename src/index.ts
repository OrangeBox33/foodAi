import "dotenv/config";
import { parseIntentForGoogle } from "./parseIntentForGoogle.js";
import { printUsageReport } from "./common/helpers/usage.js";
import { extractGoogleMapsUrl } from "./common/helpers/urlMatch.js";
import { mainGoogle } from "./mainGoogle.js";
import { FindPlacesGoogleInput } from "./common/types.js";

// ---------------------------------------------------------------------------
// Запуск напрямую: tsx src/index.ts
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js");

if (isMain) {
  const userPrompt =
    "Хочу поесть вьетнамской или азиатской еды. Быстрая еда. Блюда из риса желательно. формат столовки - пришёл, наложили, поел! https://maps.app.goo.gl/oh1uKVZkrqcsGvsx9 поиск по 10 заведениям, по 10 отзывов в каждом. радиус 300м.";

  console.log(`Запрос: "${userPrompt}"\n`);

  const baseUrl = extractGoogleMapsUrl(userPrompt);

  const {
    params,
    reasoning,
    usage: parseUsage,
  } = await parseIntentForGoogle(userPrompt);

  console.log("Параметры от Claude:", params);
  console.log("Reasoning:", reasoning, "\n");

  const result = await mainGoogle({
    url: baseUrl,
    userPrompt,
    ...params,
  } as FindPlacesGoogleInput);

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
