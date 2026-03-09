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

This is a TypeScript Node.js library that finds and recommends nearby food venues from a Google Maps URL. The pipeline in `src/index.ts` runs these steps in sequence:

1. **`resolveLocation`** — follows redirects on a Google Maps short URL (e.g. `maps.app.goo.gl/...`) and extracts `{lat, lng}` coordinates via regex patterns.

2. **`fetchNearbyPlaces`** — calls Google Places Nearby Search API using the coordinates and `FindPlacesInput` parameters. Handles pagination (up to 3 pages / 60 results) with a 2s delay between pages (required by Google).

3. **`filterPlaces`** — filters raw Google API results by `minRating` and `minReviewCount`, maps `GooglePlace` → `PlaceData`.

4. **`scrapeReviews`** — calls Apify actor `compass/google-maps-reviews-scraper` with the filtered `place_id` list to fetch full review text. This is a blocking Apify run that can take significant time.

5. **`mapReviewsForAI`** — groups flat `ApifyReview[]` by `placeId` into `PlaceForAI[]`, strips ads and reviews without text, prefers `textTranslated` over `text`.

6. **`analyzeReviews`** — sends serialized place+review data to `claude-haiku-4-5` via tool use (`give_recommendations`), returns structured `AnalysisResult` with top-3 `PlaceRecommendation[]` and a `summary`.

### AI Integration

Both AI calls use `@anthropic-ai/sdk` with forced tool use (`tool_choice: { type: "tool", name: "..." }`):

- **`parseIntent`** (`parseIntent.ts`) — converts a free-text user query (in Russian) into structured `IntentParams` for the search pipeline using `claude-haiku-4-5` and the `set_search_params` tool.
- **`analyzeReviews`** (`analyzeReviews.ts`) — analyzes scraped reviews against user intent using `claude-haiku-4-5` and the `give_recommendations` tool.

### Module System

- ESM (`"type": "module"` in package.json), NodeNext module resolution
- All internal imports must use `.js` extensions (e.g. `import { foo } from "./foo.js"`)
- `src/index.ts` both exports the library API and can run as a CLI script (detected via `process.argv[1]`)

### Key Types (`src/types.ts`)

- `FindPlacesInput` — main input to `findPlaces()`, includes Google Places params, filter thresholds, and Apify scraper options
- `PlaceData` — normalized Google Places result
- `PlaceForAI` / `ReviewForAI` — trimmed structures passed to Claude
- `ApifyReview` — raw Apify actor output shape
