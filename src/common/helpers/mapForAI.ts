import type {
  ApifyReview,
  PlaceForAI,
  ReviewForAI,
} from "../types.js";

// Извлекает переведённый текст из content, если есть "(Translated by Google)"
// Иначе возвращает исходный контент с раскодированными HTML-сущностями
function extractContent(content: string): string {
  const match = content.match(/^\(Translated by Google\) ([\s\S]+?)\n\(Original\)/);
  const text = match ? match[1] : content;
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .trim();
}

// Mapper for flat ApifyReview[] from web_wanderer/google-reviews-scraper
export function mapFlatReviewsForAI(reviews: ApifyReview[]): PlaceForAI[] {
  const placesMap = new Map<string, PlaceForAI>();

  for (const review of reviews) {
    if (!review.content) continue;

    let place = placesMap.get(review.place_id);
    if (!place) {
      place = {
        placeId: review.place_id,
        title: "",
        totalScore: 0,
        reviewsCount: 0,
        categoryName: "",
        price: null,
        reviews: [],
      };
      placesMap.set(review.place_id, place);
    }

    place.reviews.push({
      stars: review.rating,
      text: extractContent(review.content),
      publishedAtDate: review.reviewed_at,
      visitedIn: null,
      isLocalGuide: review.is_local_guide,
      reviewerNumberOfReviews: null,
      likesCount: 0,
      responseFromOwnerText: null,
    });
  }

  return Array.from(placesMap.values());
}
