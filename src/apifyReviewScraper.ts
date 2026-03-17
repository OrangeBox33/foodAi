import { ApifyClient } from "apify-client";
import type { ApifyScraperInput, ApifyReview } from "./common/types.js";
import { DEFAULT_MAX_REVIEWS_PER_PLACE, DEFAULT_REVIEWS_SORT } from "./common/constants.js";

const ACTOR_ID = "web_wanderer/google-reviews-scraper";

function twoMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().split("T")[0];
}

export async function apifyReviewScraper(
  input: ApifyScraperInput,
): Promise<{ reviews: ApifyReview[]; apifyCostUsd: number }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN не задан в переменных окружения");
  }

  const client = new ApifyClient({ token });

  const actorInput = {
    place_ids: input.placeIds,
    limit: input.limit ?? DEFAULT_MAX_REVIEWS_PER_PLACE,
    order: input.order ?? DEFAULT_REVIEWS_SORT,
    anyDate: twoMonthsAgo(),
    include_personal: false,
  };

  const run = await client.actor(ACTOR_ID).call(actorInput);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return {
    reviews: items as unknown as ApifyReview[],
    apifyCostUsd: run.usageTotalUsd ?? 0,
  };
}
