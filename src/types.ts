export type PlaceType =
  | "restaurant"
  | "cafe"
  | "bar"
  | "bakery"
  | "meal_takeaway"
  | "meal_delivery";

export interface FindPlacesInput {
  // Обязательные
  url: string;
  type: PlaceType;
  userPrompt?: string;

  // Основные необязательные
  keyword?: string;
  radius?: number;
  maxReviewsPerPlace?: number;
  maxPlaces?: number;

  // Фильтры
  minRating?: number;
  minReviewCount?: number;

  // Дополнительные параметры Google Places Nearby Search
  opennow?: boolean;
  minprice?: 0 | 1 | 2 | 3 | 4;
  maxprice?: 0 | 1 | 2 | 3 | 4;
  language?: string;
  pagetoken?: never; // управляется внутренне

  // Параметры Apify scraper
  reviewsSort?: ReviewsSort;
  reviewsOrigin?: ReviewsOrigin;
  personalData?: boolean;
  reviewsStartDate?: string;

  [key: string]: unknown;
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
  analysis: import("./analyzeReviews.js").AnalysisResult;
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

export type ReviewsSort = "newest" | "mostRelevant" | "highestRanking" | "lowestRanking";
export type ReviewsOrigin = "all" | "google";

export interface ApifyScraperInput {
  placeIds: string[];
  maxReviews: number;
  reviewsSort?: ReviewsSort;
  language?: string;
  reviewsOrigin?: ReviewsOrigin;
  personalData?: boolean;
  reviewsStartDate?: string; // "2024-05-03" или "3 months"
}

export interface ApifyReview {
  // Данные о заведении
  placeId: string;
  title: string;
  totalScore: number;
  reviewsCount: number;
  categoryName: string;
  categories: string[];
  price: string | null;
  url: string;
  location: LatLng;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  imageUrl: string | null;

  // Данные об отзыве
  reviewId: string;
  reviewUrl: string | null;
  reviewOrigin: string;
  stars: number;
  rating: number | null;
  text: string | null;
  textTranslated: string | null;
  originalLanguage: string | null;
  translatedLanguage: string | null;
  publishAt: string;
  publishedAtDate: string;
  likesCount: number;
  reviewImageUrls: string[];
  responseFromOwnerDate: string | null;
  responseFromOwnerText: string | null;
  visitedIn: string | null;
  isAdvertisement: boolean;

  // Данные о рецензенте (при personalData: true)
  reviewerId: string | null;
  reviewerUrl: string | null;
  name: string | null;
  reviewerNumberOfReviews: number | null;
  isLocalGuide: boolean | null;
  reviewerPhotoUrl: string | null;

  // Мета
  searchString: string;
  scrapedAt: string;
  language: string;
}
