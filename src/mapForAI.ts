import type { ApifyReview, PlaceForAI, ReviewForAI } from "./types.js";

function mapReview(review: ApifyReview): ReviewForAI {
  return {
    stars: review.stars,
    text: review.textTranslated ?? review.text ?? "",
    publishedAtDate: review.publishedAtDate,
    visitedIn: review.visitedIn,
    isLocalGuide: review.isLocalGuide,
    reviewerNumberOfReviews: review.reviewerNumberOfReviews,
    likesCount: review.likesCount,
    responseFromOwnerText: review.responseFromOwnerText,
  };
}

export function mapReviewsForAI(reviews: ApifyReview[]): PlaceForAI[] {
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

    place.reviews.push(mapReview(review));
  }

  return Array.from(placesMap.values());
}
