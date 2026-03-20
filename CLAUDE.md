# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Run the pipeline directly via tsx (no build needed)
npm run build      # Compile TypeScript to dist/
```

Run a specific file directly:

```bash
npx tsx src/someFile.ts
```

There is no test suite.

## Environment Variables

Requires a `.env` file in the project root:

```
GOOGLE_PLACES_API_KEY=...
APIFY_API_TOKEN=...
```

## Architecture

This is a TypeScript Node.js library that finds and recommends nearby food venues.

### Pipeline: `src/index.ts` → `mainGoogle`

1. **`parseIntentForGoogle`** (`src/parseIntentForGoogle.ts`) — converts a free-text user query (in Russian) into structured `IntentParams` using `claude-haiku-4-5` and the `set_search_params` tool. Produces: `type`, `radius`, `minReviewCount`, `maxReviewsPerPlace`.

2. **`getLatLngFromGoogleMapsUrl`** (`src/resolveLocation.ts`) — takes a Google Maps short URL, follows redirects, and extracts `{lat, lng}`.

3. **`fetchNearbyPlaces`** (`src/googlePlacesSearch.ts`) — calls Google Places Nearby Search API (paginated, 3 pages × 20 = max 60 results, 2s delay between pages). Returns raw `GooglePlace[]`. Requires `GOOGLE_PLACES_API_KEY`. `maxPlaces` is hardcoded to 60 and not configurable.

4. **`filterPlaces` / `selectTopPlaces`** (`src/common/helpers/filter.ts`) — filters by and `minReviewCount`, then selects top N places by score.

5. **`apifyReviewScraper`** (`src/apifyReviewScraper.ts`) — calls Apify actor `web_wanderer/google-reviews-scraper` with the filtered `place_id` list. Returns `ApifyReview[]`. Requires `APIFY_API_TOKEN`. `include_personal` is hardcoded to `false`.

6. **`mapFlatReviewsForAI`** (`src/common/helpers/mapForAI.ts`) — groups flat `ApifyReview[]` by `placeId` into `PlaceForAI[]`, strips ads and reviews without text.

7. **`analyzeReviews`** (`src/analyzeReviews.ts`) — two-stage AI pipeline:
   - **Stage 1** (`extractPlaceSignals`): parallel calls to `claude-haiku-4-5` per place, using tool `extract_place_signals` to produce a `PlaceSignals` card (matchScore, confirmedSignals, redFlags, freshnessTrend, bestEvidence). Places with fewer than 3 text reviews are skipped (`insufficientData: true`). Failed calls don't abort the pipeline.
   - **Stage 2** (`rankPlaces`): single call to `claude-haiku-4-5` with all signal cards, using tool `give_recommendations`. Returns top-3 `PlaceRecommendation[]` and a `summary`.

### Module System

- ESM (`"type": "module"` in package.json), NodeNext module resolution
- All internal imports must use `.js` extensions (e.g. `import { foo } from "./foo.js"`)
- `src/index.ts` both exports the library API and can run as a CLI script (detected via `process.argv[1]`)

### Supporting modules

- `src/common/constants.ts` — all defaults (`DEFAULT_MAX_PLACES_FOR_REVIEWS`, `DEFAULT_MIN_RATING`, `CLAUDE_MODEL`, token limits, etc.). Change defaults here, not at call sites.
- `src/common/helpers/usage.ts` — token tracking (`TokenUsage`) and cost calculation (`calcCost`) for `claude-haiku-4-5` pricing. The CLI prints a full cost report after each run.
- `src/common/helpers/filter.ts` — `filterPlaces` and `selectTopPlaces` logic.

### Key Types (`src/common/types.ts`)

- `FindPlacesGoogleInput` — main input to `mainGoogle()`. Key fields: `url`, `type`, `radius`, `opennow`, `maxForReviews`, `maxReviewsPerPlace`, `minReviewCount`, `reviewsSort`, `reviewsStartDate`. No `keyword`, `language`, `maxPlaces`, or `personalData` — these are either removed or hardcoded.
- `PlaceData` — normalized Google Places result
- `PlaceForAI` / `ReviewForAI` — trimmed structures passed to Claude
- `ApifyReview` — raw Apify actor output shape
