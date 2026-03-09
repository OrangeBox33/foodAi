import { ApifyClient } from "apify-client";
import type { ApifyScraperInput, ApifyReview } from "./types.js";

const ACTOR_ID = "compass/google-maps-reviews-scraper";

export async function scrapeReviews(input: ApifyScraperInput): Promise<ApifyReview[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN не задан в переменных окружения");
  }

  const client = new ApifyClient({ token });

  const actorInput = {
    placeIds: input.placeIds,
    maxReviews: input.maxReviews,
    reviewsSort: input.reviewsSort ?? "newest",
    language: input.language ?? "en",
    reviewsOrigin: input.reviewsOrigin ?? "all",
    personalData: input.personalData ?? true,
    ...(input.reviewsStartDate && { reviewsStartDate: input.reviewsStartDate }),
  };

  const run = await client.actor(ACTOR_ID).call(actorInput);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return items as unknown as ApifyReview[];
}
