import type { GooglePlace, PlaceData } from "../types.js";

interface FilterOptions {
  minRating: number;
  minReviewCount?: number;
  keyword?: string;
}

function mapToPlaceData(place: GooglePlace): PlaceData {
  return {
    place_id: place.place_id,
    name: place.name,
    rating: place.rating ?? 0,
    user_ratings_total: place.user_ratings_total ?? 0,
    price_level: place.price_level,
    vicinity: place.vicinity ?? "",
    types: place.types ?? [],
    geometry: {
      location: place.geometry?.location ?? { lat: 0, lng: 0 },
    },
  };
}

export function filterPlaces(
  rawPlaces: GooglePlace[],
  options: FilterOptions,
): PlaceData[] {
  const kw = options.keyword?.toLowerCase().trim();
  return rawPlaces
    .filter((place) => {
      if ((place.rating ?? 0) < options.minRating) return false;
      if (options.minReviewCount !== undefined && (place.user_ratings_total ?? 0) < options.minReviewCount)
        return false;
      // if (kw) {
      //   const inName = place.name?.toLowerCase().includes(kw) ?? false;
      //   const inVicinity = place.vicinity?.toLowerCase().includes(kw) ?? false;
      //   if (!inName && !inVicinity) return false;
      // }
      return true;
    })
    .map(mapToPlaceData);
}

/**
 * Выбирает топ-N заведений по взвешенной оценке: rating × log(reviewsCount + 1).
 * Балансирует качество (рейтинг) и доверие (число отзывов).
 */
export function selectTopPlaces(places: PlaceData[], n: number): PlaceData[] {
  return places
    .sort((a, b) => {
      const scoreA = a.rating * Math.log(a.user_ratings_total + 1);
      const scoreB = b.rating * Math.log(b.user_ratings_total + 1);
      return scoreB - scoreA;
    })
    .slice(0, n);
}
