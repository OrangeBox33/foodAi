# Параметры Google path — куда что идёт

## Вход: `FindPlacesGoogleInput` (`src/common/types.ts`)

| Параметр | Тип | Дефолт | Где задан дефолт |
|---|---|---|---|
| `url` | string | — | обязательный |
| `type` | PlaceType | — | обязательный |
| `userPrompt` | string? | `""` | `mainGoogle.ts:68` |
| `radius` | number? | `500` | `googlePlacesSearch.ts` (`DEFAULT_SEARCH_RADIUS`) |
| `opennow` | boolean? | `false` | `mainGoogle.ts` (`DEFAULT_OPENNOW`) |
| `minprice` | 0–4? | — | нет дефолта |
| `maxprice` | 0–4? | — | нет дефолта |
| `maxForReviews` | number? | `30` | `mainGoogle.ts` (`DEFAULT_MAX_PLACES_FOR_REVIEWS`) |
| `maxReviewsPerPlace` | number? | `20` | `mainGoogle.ts` (`DEFAULT_MAX_REVIEWS_PER_PLACE`) |
| `minRating` | number? | `1` | `mainGoogle.ts` (`DEFAULT_MIN_RATING`) |
| `minReviewCount` | number? | нет ⚠️ | без дефолта — фильтр отключён если не передан |
| `reviewsSort` | ReviewsSort? | `"newest"` | `apifyReviewScraper.ts` (`DEFAULT_REVIEWS_SORT`) |
| `reviewsOrigin` | ReviewsOrigin? | — | нет дефолта |
| `reviewsStartDate` | string? | — | нет дефолта |

**Не прокидываются / захардкожены:**
- `maxPlaces` — всегда `60` (захардкожено через `Math.min(maxPlaces, 60)` в `googlePlacesSearch.ts:89`). Не экспонируется в input.
- `personalData` — всегда `false` (захардкожено как `include_personal: false` в `apifyReviewScraper.ts:28`). Не прокидывается никуда.
- `keyword` — не передаётся в Google API и не используется в фильтрации (код закомментирован в `filter.ts:35–38`).
- `language` — присутствует в типе и передаётся в Google API, но в документации не нужен.

---

## Поток параметров

```
FindPlacesGoogleInput
        │
        ├─► getLatLngFromGoogleMapsUrl(input.url)
        │       → LatLng
        │
        ├─► fetchNearbyPlaces(location, mergedInput, apiKey)   [googlePlacesSearch.ts]
        │       Передаёт: type, radius, opennow, minprice, maxprice
        │       maxPlaces = 60 (захардкожено)
        │       → GooglePlace[]  (rawPlaces)
        │
        ├─► filterPlaces(rawPlaces, { minRating, minReviewCount })   [filter.ts]
        │       Дефолт minRating применяется в mainGoogle.ts до этого вызова
        │       minReviewCount без дефолта — если undefined, фильтр пропускается
        │       → PlaceData[]  (filtered)
        │
        ├─► selectTopPlaces(filtered, maxForReviews)   [filter.ts]
        │       Сортирует по: rating × log(reviewsCount + 1)
        │       → PlaceData[]  (places, топ-N)
        │
        ├─► apifyReviewScraper({ placeIds, limit: maxReviewsPerPlace, order: reviewsSort })
        │       include_personal: false  (захардкожено)
        │       → { reviews, apifyCostUsd }
        │
        └─► analyzeReviews(placesForAI, places, userPrompt)
                → AnalysisResult
```

---

## Где задаются дефолты (по файлам)

### `src/common/constants.ts` — источник всех дефолтов
```ts
DEFAULT_MAX_PLACES_FOR_REVIEWS = 30 // сколько заведений скрапим
DEFAULT_MAX_REVIEWS_PER_PLACE  = 20 // отзывов на заведение
DEFAULT_MIN_RATING          = 1     // минимальный рейтинг
DEFAULT_SEARCH_RADIUS       = 500   // радиус поиска, метры
DEFAULT_OPENNOW             = false // только открытые
DEFAULT_REVIEWS_SORT        = "newest"
```

### `src/mainGoogle.ts` — применение дефолтов к input
```ts
const maxReviewsPerPlace = input.maxReviewsPerPlace ?? DEFAULT_MAX_REVIEWS_PER_PLACE;
const minRating          = input.minRating          ?? DEFAULT_MIN_RATING;
const maxForReviews      = input.maxForReviews      ?? DEFAULT_MAX_PLACES_FOR_REVIEWS;

const mergedInput = { opennow: DEFAULT_OPENNOW, ...input };
```

### `src/googlePlacesSearch.ts` — лимит страниц
```ts
const maxPages = Math.ceil(Math.min(maxPlaces, 60) / 20);
// → всегда 3 страницы × 20 = максимум 60 заведений
```

---

## Проблема с `minReviewCount`

В `mainGoogle.ts:47` передаётся напрямую как `input.minReviewCount` — **без дефолта**.
В `filter.ts:32`: если `undefined`, фильтр пропускается, все заведения проходят.

Итог: сейчас заведения с 0 отзывов могут попасть в выдачу.

Чтобы исправить — добавь дефолт в `src/common/constants.ts`:
```ts
export const DEFAULT_MIN_REVIEW_COUNT = 50;
```
И примени в `mainGoogle.ts`:
```ts
const minReviewCount = input.minReviewCount ?? DEFAULT_MIN_REVIEW_COUNT;
```
Затем передай в `filterPlaces`:
```ts
filterPlaces(rawPlaces, { minRating, minReviewCount })
```
