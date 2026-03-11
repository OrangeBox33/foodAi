import type { GooglePlace, PlaceData } from "../types.js";

interface FilterOptions {
  minRating: number;
  minReviewCount: number;
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
  return rawPlaces
    .filter(
      (place) =>
        (place.rating ?? 0) >= options.minRating &&
        (place.user_ratings_total ?? 0) >= options.minReviewCount,
    )
    .map(mapToPlaceData);
}
