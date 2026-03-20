export type PlaceType =
  | "restaurant"
  | "cafe"
  | "bar"
  | "bakery"
  | "meal_takeaway"
  | "meal_delivery";

export interface FindPlacesGoogleInput {
  // Обязательные
  url: string;
  type: PlaceType;
  userPrompt?: string;

  // Google Places Nearby Search
  radius?: number;
  opennow?: boolean;
  minprice?: 0 | 1 | 2 | 3 | 4;
  maxprice?: 0 | 1 | 2 | 3 | 4;

  // Лимиты
  maxForReviews?: number;
  maxReviewsPerPlace?: number;

  // Фильтры
  minRating?: number;
  minReviewCount?: number;

  // Параметры Apify reviews scraper
  reviewsSort?: ReviewsSort;
  reviewsOrigin?: ReviewsOrigin;
  reviewsStartDate?: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceData {
  place_id: string;
  name: string;
  rating: number;
  user_ratings_total: number;
  price_level?: number;
  vicinity: string;
  types: string[];
  geometry: {
    location: LatLng;
  };
}

export interface FindPlacesResult {
  places: PlaceData[];
  placesForAI: PlaceForAI[];
  analysis: import("../analyzeReviews.js").AnalysisResult;
  apifyCostUsd: number;
}

// Сырой объект заведения из Google Places API
export interface GooglePlace {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  vicinity?: string;
  types?: string[];
  geometry?: {
    location: LatLng;
  };
}

export interface GooglePlacesResponse {
  results: GooglePlace[];
  status: string;
  next_page_token?: string;
  error_message?: string;
}

// --- AI payload ---

export interface ReviewForAI {
  stars: number;
  text: string;
  publishedAtDate: string;
  visitedIn: string | null;
  isLocalGuide: boolean | null;
  reviewerNumberOfReviews: number | null;
  likesCount: number;
  responseFromOwnerText: string | null;
}

export interface PlaceForAI {
  placeId: string;
  title: string;
  totalScore: number;
  reviewsCount: number;
  categoryName: string;
  price: string | null;
  reviews: ReviewForAI[];
}

// --- Apify: compass/google-maps-reviews-scraper ---

export type ReviewsSort =
  | "newest"
  | "mostRelevant"
  | "highestRanking"
  | "lowestRanking";
export type ReviewsOrigin = "all" | "google";

export interface ApifyScraperInput {
  placeIds: string[];
  limit?: number;
  order?: string; // "newest" | "relevant" | "highest_rating" | "lowest_rating"
}

// Сырой отзыв из web_wanderer/google-reviews-scraper
export interface ApifyReview {
  is_local_guide: boolean;
  source: string;
  rating: number;
  content: string;
  reviewed_at: string; // relative string, e.g. "2 days ago"
  place_id: string;
}
