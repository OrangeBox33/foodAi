// ---------------------------------------------------------------------------
// Учёт токенов и стоимости для haiku-4-5
// ---------------------------------------------------------------------------

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

// Цены haiku-4-5 за 1 токен (в долларах)
const PRICE = {
  input: 0.8 / 1_000_000,
  output: 4.0 / 1_000_000,
  cacheWrite: 1.0 / 1_000_000,
  cacheRead: 0.08 / 1_000_000,
};

export function calcCost(usage: TokenUsage): number {
  return (
    usage.inputTokens * PRICE.input +
    usage.outputTokens * PRICE.output +
    usage.cacheWriteTokens * PRICE.cacheWrite +
    usage.cacheReadTokens * PRICE.cacheRead
  );
}

export function sumUsage(usages: TokenUsage[]): TokenUsage {
  return usages.reduce(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + u.cacheReadTokens,
      cacheWriteTokens: acc.cacheWriteTokens + u.cacheWriteTokens,
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
  );
}

export function fromApiUsage(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): TokenUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
  };
}

export function fmtUsageLine(
  label: string,
  usage: TokenUsage,
  note = "",
): string {
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

export function printUsageReport(
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
