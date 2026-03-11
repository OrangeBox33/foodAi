import type { ApifyPlace, ApifyPlaceReview, ApifyReview, PlaceForAI, ReviewForAI } from "./types.js";
import { extractPlaceId } from "./apifyPlacesScraper.js";

function mapEmbeddedReview(review: ApifyPlaceReview): ReviewForAI {
  return {
    stars: review.stars,
    text: review.textTranslated ?? review.text ?? "",
    publishedAtDate: review.publishedAtDate,
    visitedIn: null,
    isLocalGuide: review.isLocalGuide,
    reviewerNumberOfReviews: review.reviewerNumberOfReviews,
    likesCount: review.likesCount,
    responseFromOwnerText: null,
  };
}

// Legacy mapper for flat ApifyReview[] from compass/google-maps-reviews-scraper
export function mapFlatReviewsForAI(reviews: ApifyReview[]): PlaceForAI[] {
  const placesMap = new Map<string, PlaceForAI>();

  for (const review of reviews) {
    if (review.isAdvertisement) continue;
    if (!review.text && !review.textTranslated) continue;

    let place = placesMap.get(review.placeId);
    if (!place) {
      place = {
        placeId: review.placeId,
        title: review.title,
        totalScore: review.totalScore,
        reviewsCount: review.reviewsCount,
        categoryName: review.categoryName,
        price: review.price,
        reviews: [],
      };
      placesMap.set(review.placeId, place);
    }

    place.reviews.push({
      stars: review.stars,
      text: review.textTranslated ?? review.text ?? "",
      publishedAtDate: review.publishedAtDate,
      visitedIn: review.visitedIn,
      isLocalGuide: review.isLocalGuide,
      reviewerNumberOfReviews: review.reviewerNumberOfReviews,
      likesCount: review.likesCount,
      responseFromOwnerText: review.responseFromOwnerText,
    });
  }

  return Array.from(placesMap.values());
}

export function mapReviewsForAI(places: ApifyPlace[]): PlaceForAI[] {
  return places.map((place) => {
    const placeId = extractPlaceId(place.url);

    const reviews = place.reviews
      .filter((r) => r.text || r.textTranslated)
      .map(mapEmbeddedReview);

    return {
      placeId,
      title: place.title,
      totalScore: place.totalScore ?? 0,
      reviewsCount: place.reviewsCount ?? 0,
      categoryName: place.categoryName ?? place.categories[0] ?? "",
      price: place.price ?? null,
      reviews,
    };
  });
}
