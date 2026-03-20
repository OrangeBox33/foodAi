# Параметры Google path — куда что идёт

## Вход: `FindPlacesGoogleInput` (`src/common/types.ts`)

| Параметр | Тип | Дефолт | Где задан дефолт |
|---|---|---|---|
| `url` | string | — | обязательный |
| `type` | PlaceType | — | обязательный |
| `userPrompt` | string? | `""` | `mainGoogle.ts:70` |
| `keyword` | string? | — | нет дефолта |
| `radius` | number? | `500` | `googlePlacesSearch.ts:73` (константа `DEFAULT_SEARCH_RADIUS`) |
| `opennow` | boolean? | `false` | `mainGoogle.ts:32` (константа `DEFAULT_OPENNOW`) |
| `minprice` | 0–4? | — | нет дефолта |
| `maxprice` | 0–4? | — | нет дефолта |
| `language` | string? | — | нет дефолта |
| `maxPlaces` | number? | `100` | `googlePlacesSearch.ts:67` (константа `DEFAULT_MAX_PLACES`) |
| `maxForReviews` | number? | `30` | `mainGoogle.ts:29` (константа `DEFAULT_MAX_PLACES_FOR_REVIEWS`) |
| `maxReviewsPerPlace` | number? | `20` | `mainGoogle.ts:25` (константа `DEFAULT_MAX_REVIEWS_PER_PLACE`) |
| `minRating` | number? | `1` | `mainGoogle.ts:27` (константа `DEFAULT_MIN_RATING`) |
| `minReviewCount` | number? | `0` ⚠️ | `mainGoogle.ts:28` (константа `DEFAULT_MIN_REVIEW_COUNT`) |
| `reviewsSort` | ReviewsSort? | — | нет дефолта |
| `reviewsOrigin` | ReviewsOrigin? | — | нет дефолта |
| `personalData` | boolean? | — | нет дефолта |
| `reviewsStartDate` | string? | — | нет дефолта |

---

## Поток параметров

```
FindPlacesGoogleInput
        │
        ├─► getLatLngFromGoogleMapsUrl(input.url)
        │       → LatLng
        │
        ├─► fetchNearbyPlaces(location, mergedInput, apiKey)   [googlePlacesSearch.ts]
        │       Передаёт: type, keyword*, radius, opennow, minprice, maxprice, language, maxPlaces
        │       * keyword намеренно НЕ передаётся в Google API (см. комментарий в коде)
        │       → GooglePlace[]  (rawPlaces)
        │
        ├─► filterPlaces(rawPlaces, { minRating, minReviewCount, keyword })   [filter.ts]
        │       Передаёт: minRating, minReviewCount, keyword
        │       Дефолты применяются в mainGoogle.ts до этого вызова (строки 27–28)
        │       → PlaceData[]  (filtered)
        │
        ├─► selectTopPlaces(filtered, maxForReviews)   [filter.ts]
        │       Сортирует по: rating × log(reviewsCount + 1)
        │       → PlaceData[]  (places, топ-N)
        │
        ├─► apifyReviewScraper({ placeIds, limit: maxReviewsPerPlace, order: reviewsSort })
        │       → { reviews, apifyCostUsd }
        │
        └─► analyzeReviews(placesForAI, places, userPrompt)
                → AnalysisResult
```

---

## Где задаются дефолты (по файлам)

### `src/common/constants.ts` — источник всех дефолтов
```ts
DEFAULT_MAX_PLACES          = 100   // лимит Google API
DEFAULT_MAX_PLACES_FOR_REVIEWS = 30 // сколько заведений скрапим
DEFAULT_MAX_REVIEWS_PER_PLACE  = 20 // отзывов на заведение
DEFAULT_MIN_RATING          = 1     // минимальный рейтинг
DEFAULT_MIN_REVIEW_COUNT    = 0  ⚠️  // минимум отзывов (0 = фильтр отключён)
DEFAULT_SEARCH_RADIUS       = 500   // радиус поиска, метры
DEFAULT_OPENNOW             = false // только открытые
```

### `src/mainGoogle.ts:25–34` — применение дефолтов к input
```ts
const maxReviewsPerPlace = input.maxReviewsPerPlace ?? DEFAULT_MAX_REVIEWS_PER_PLACE;
const minRating          = input.minRating          ?? DEFAULT_MIN_RATING;
const minReviewCount     = input.minReviewCount     ?? DEFAULT_MIN_REVIEW_COUNT;  // ← 0!
const maxForReviews      = input.maxForReviews      ?? DEFAULT_MAX_PLACES_FOR_REVIEWS;

const mergedInput = { opennow: DEFAULT_OPENNOW, ...input };  // opennow дефолт тут
```

### `src/googlePlacesSearch.ts:67–74` — дефолты для Google API запроса
```ts
const maxPlaces = params.maxPlaces ?? DEFAULT_MAX_PLACES;
radius: params.radius ?? DEFAULT_SEARCH_RADIUS
```

---

## Проблема с `minReviewCount`

`DEFAULT_MIN_REVIEW_COUNT = 0` → фильтр отключён по дефолту, все заведения проходят.

Чтобы исправить — поменяй в `src/common/constants.ts`:
```ts
export const DEFAULT_MIN_REVIEW_COUNT = 50; // или нужное значение
```

Либо передавай явно при вызове:
```ts
mainGoogle({ ..., minReviewCount: 50 })
```
