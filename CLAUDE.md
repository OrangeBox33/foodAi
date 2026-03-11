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

This is a TypeScript Node.js library that finds and recommends nearby food venues. There are two pipelines; the primary one uses Apify for both place discovery and review scraping.

### Primary pipeline: `findPlacesApify` (`src/index.ts`)

1. **`parseIntentForApify`** (`src/parseIntentForApify.ts`) — converts a free-text user query (in Russian) into structured `ApifyIntentParams` using `claude-haiku-4-5` and the `set_search_params` tool.

2. **`fetchNearbyPlacesApify`** (`src/apifyPlacesScraper.ts`) — calls Apify actor `compass/crawler-google-places` with `{lat, lng, query, maxItems, zoom}`. Returns raw `ApifyPlace[]`.

3. **`filterApifyPlaces`** — filters by `minRating` and `minReviewCount`, maps `ApifyPlace` → `PlaceData`. Price level is parsed from `$`/`$$`/`$$$` strings.

4. **`scrapeReviews`** (`src/apifyReviewScraper.ts`) — calls Apify actor `compass/google-maps-reviews-scraper` with the filtered `place_id` list. Blocking run, can take significant time.

5. **`mapReviewsForAI`** (`src/common/helpers/mapForAI.ts`) — groups flat `ApifyReview[]` by `placeId` into `PlaceForAI[]`, strips ads and reviews without text, prefers `textTranslated` over `text`.

6. **`analyzeReviews`** (`src/analyzeReviews.ts`) — two-stage AI pipeline:
   - **Stage 1** (`extractPlaceSignals`): parallel calls to `claude-haiku-4-5` per place, using tool `extract_place_signals` to produce a `PlaceSignals` card (matchScore, confirmedSignals, redFlags, freshnessTrend, bestEvidence). Places with fewer than 3 text reviews are skipped (`insufficientData: true`). Failed calls don't abort the pipeline.
   - **Stage 2** (`rankPlaces`): single call to `claude-haiku-4-5` with all signal cards, using tool `give_recommendations`. Returns top-3 `PlaceRecommendation[]` and a `summary`.

### Legacy pipeline: `findPlaces` (`src/google/`)

Uses a Google Maps short URL instead of coordinates. `resolveLocation` follows redirects and extracts `{lat, lng}`, then calls Google Places Nearby Search API (paginated, 2s delay between pages), and shares the same review scraping and AI analysis steps. Requires `GOOGLE_PLACES_API_KEY`.

### AI Integration

All AI calls use `@anthropic-ai/sdk` with forced tool use (`tool_choice: { type: "tool", name: "..." }`). The `parseIntent` in `src/google/parseIntent.ts` is the legacy variant for the Google Places pipeline; `parseIntentForApify` in `src/parseIntentForApify.ts` is used by the primary pipeline.

### Module System

- ESM (`"type": "module"` in package.json), NodeNext module resolution
- All internal imports must use `.js` extensions (e.g. `import { foo } from "./foo.js"`)
- `src/index.ts` both exports the library API and can run as a CLI script (detected via `process.argv[1]`)

### Supporting modules

- `src/common/constants.ts` — all defaults (`DEFAULT_MAX_PLACES`, `DEFAULT_MIN_RATING`, `CLAUDE_MODEL`, token limits, etc.). Change defaults here, not at call sites.
- `src/common/helpers/usage.ts` — token tracking (`TokenUsage`) and cost calculation (`calcCost`) for `claude-haiku-4-5` pricing. The CLI prints a full cost report after each run.
- `src/common/helpers/filter.ts` — `filterApifyPlaces` logic shared between pipelines.

### Key Types (`src/common/types.ts`)

- `FindPlacesInput` — main input to `findPlaces()`, includes Google Places params, filter thresholds, and Apify scraper options
- `PlaceData` — normalized Google Places result
- `PlaceForAI` / `ReviewForAI` — trimmed structures passed to Claude
- `ApifyReview` — raw Apify actor output shape
