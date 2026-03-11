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

// --- Apify: places scraper (альтернатива Google Places API) ---

export interface FindPlacesApifyInput {
  // Google Maps search URL (e.g. "https://www.google.com/maps/search/cafe/@lat,lng,17z")
  url: string;

  userPrompt?: string;
  maxReviewsPerPlace?: number;
  maxPlaces?: number;

  // Фильтры
  minRating?: number;
  minReviewCount?: number;

  // Параметры Apify scraper
  reviewsSort?: ReviewsSort;
  reviewsOrigin?: ReviewsOrigin;
  personalData?: boolean;
  reviewsStartDate?: string;
  language?: string;

  [key: string]: unknown;
}

// Встроенный отзыв в выдаче compass/crawler-google-places
export interface ApifyPlaceReview {
  reviewerNumberOfReviews: number | null;
  isLocalGuide: boolean | null;
  text: string | null;
  textTranslated: string | null;
  publishAt: string;
  publishedAtDate: string;
  likesCount: number;
  reviewOrigin: string;
  stars: number;
}

// Сырой объект заведения из Apify compass/crawler-google-places (с вложенными отзывами)
export interface ApifyPlace {
  title: string;
  totalScore: number | null;
  reviewsCount: number | null;
  street: string | null;
  city: string | null;
  state: string | null;
  countryCode: string | null;
  website: string | null;
  phone: string | null;
  categories: string[];
  url: string;
  categoryName: string | null;
  price: string | null;
  reviews: ApifyPlaceReview[];
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
