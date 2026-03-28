import "dotenv/config";
import { parseIntentForGoogle } from "./parseIntentForGoogle.js";
import { printUsageReport } from "./common/helpers/usage.js";
import { extractGoogleMapsUrl } from "./common/helpers/urlMatch.js";
import { mainGoogle } from "./mainGoogle.js";
import { FindPlacesGoogleInput, GridSplit } from "./common/types.js";

// ---------------------------------------------------------------------------
// Запуск напрямую: tsx src/index.ts
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js");

if (isMain) {
  const gridSplit: GridSplit = 4;

  const userPrompt =
    "Ищу типа столовку, куда можно зайти и поесть побыстрому. Еда должна быть здоровая, типа риса с курицей (или мясом) с овощами. Обычная домашняя еда. Если можешь, то выбери недорогое место. https://maps.app.goo.gl/UwU2KdidD8R1bcK28 поиск по 10 заведениям, по 1 отзывов в каждом. радиус 1000м.";
  // Хочу поесть вьетнамской или азиатской еды. Быстрая еда. Блюда из риса желательно. формат столовки - пришёл, наложили, поел!
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
    gridSplit,
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
