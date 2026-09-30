# Kyoto–Osaka Trip Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a mobile-first, map-first six-day Kyoto–Osaka itinerary that remains usable when the map CDN is unavailable.

**Architecture:** A build-free static site keeps itinerary content in an ES module, pure view-model functions in a separately testable module, and browser bindings in a small DOM/Leaflet adapter. GitHub Pages serves the repository root; navigation and official links remain plain HTTPS anchors.

**Tech Stack:** HTML5, CSS, vanilla JavaScript ES modules, Leaflet 1.9.4 + OpenStreetMap tiles, Node.js built-in test runner, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-30-kyoto-osaka-trip-map-design.md`

## Global Constraints

- Mobile-first map occupies about 56% of the first viewport and the itinerary sheet about 44%.
- Use Kyoto green `#173F2C`, vermilion `#E45D3C`, true white surfaces, and no gradients.
- D1–D6 switch the map, route, summary, and timeline together.
- Keep locations and times in `itinerary-data.js`; future edits must not require UI rewrites.
- Do not expose home address, booking numbers, passport data, phone numbers, or room numbers.
- Day 1 fireworks must display as `备选・未购票`; Day 2 kimono return must display as tentative before 18:00.
- The textual itinerary and outbound links must work if Leaflet or map tiles fail.
- Touch targets are at least 44px and reduced-motion preferences are respected.

## Review Focus

- Leaflet CDN failure leaves all six textual itineraries and navigation links usable; Task 3 browser verification covers this.
- An itinerary day with no mapped location still renders its timeline and does not crash route fitting; Task 2 tests it.
- Repeated switching among D1–D6 does not duplicate markers, routes, or event listeners; Task 3 browser verification covers it.
- Long Chinese labels at 390px width do not overflow or obscure the day switcher; Task 3 viewport verification covers it.
- External links use valid HTTPS URLs and open safely without leaking private trip data; Task 1 tests the data contract.

---

### Task 1: Itinerary data and pure view model

**Files:**
- Create: `package.json`
- Create: `itinerary-data.js`
- Create: `trip-model.js`
- Create: `tests/trip-model.test.js`

**Interfaces:**
- Produces: `ITINERARY_DAYS: TripDay[]`, `getDayById(dayId): TripDay`, `buildDayView(day): DayView`, `getMappableStops(day): Stop[]`, `buildNavigationUrl(stop): string`.
- Consumes: approved six-day itinerary and privacy constraints from the spec.

- [ ] **Step 1: Write failing model tests**

Test literals assert six ordered days, HB340/UO863, Day 1 `备选・未购票`, Day 2 tentative 18:00 return, Day 4 Uji-before-Osaka order, Day 5 USJ, and valid HTTPS links. Include one synthetic day with no coordinates and assert `getMappableStops()` returns an empty array without throwing.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/trip-model.test.js`
Expected: FAIL because modules or exports do not exist.

- [ ] **Step 3: Implement the data contract and pure model functions**

Use stable string IDs, `[latitude, longitude]` coordinate tuples, route order arrays, explicit optional/fallback status, and public navigation/official URLs only.

- [ ] **Step 4: Run the suite and verify GREEN**

Run: `npm test`
Expected: all model tests pass with zero warnings.

- [ ] **Step 5: Commit**

Commit: `feat: add six-day itinerary data model`

### Task 2: Map-first page shell and itinerary interactions

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `app.js`
- Create: `tests/view-state.test.js`
- Modify: `trip-model.js`

**Interfaces:**
- Consumes: `ITINERARY_DAYS`, `getDayById`, `buildDayView`, `getMappableStops`, `buildNavigationUrl` from Task 1.
- Produces: `createInitialState(days): AppState`, `selectDay(state, dayId): AppState`, `selectStop(state, stopId): AppState`, semantic DOM hooks `[data-day-id]`, `[data-stop-id]`, `#map`, and `#itinerary-sheet`.

- [ ] **Step 1: Write failing view-state tests**

Assert the first day is selected initially, selecting D4 resets the selected stop to D4's first stop, selecting a missing day preserves the current state, and a no-coordinate day remains selectable.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/view-state.test.js`
Expected: FAIL because state functions are not exported.

- [ ] **Step 3: Implement state functions and the semantic page shell**

Build the D1–D6 switcher, hero header, map region, draggable/expandable itinerary sheet, route summary, stop timeline, status badges, details, and external navigation links. Keep map operations behind a `window.L` availability check.

- [ ] **Step 4: Implement the approved visual system**

Match the accepted map-first concept at 390×844 and 430×932; add desktop containment, safe-area padding, 44px controls, keyboard focus, and `prefers-reduced-motion` handling.

- [ ] **Step 5: Run the suite and verify GREEN**

Run: `npm test`
Expected: all model and view-state tests pass.

- [ ] **Step 6: Commit**

Commit: `feat: build mobile trip map interface`

### Task 3: Browser integration and resilient map behavior

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Create: `tests/static-server-smoke.test.js`

**Interfaces:**
- Consumes: semantic DOM hooks and app state from Task 2.
- Produces: synchronized Leaflet markers/polyline/fit bounds, marker-to-timeline selection, day-switch redraw, map-unavailable fallback message, and static-server smoke checks.

- [ ] **Step 1: Write failing static-server smoke test**

Start a local static server in the test, fetch `/`, `/styles.css`, `/app.js`, and `/itinerary-data.js`, and assert HTTP 200 plus the HTML accessibility landmark and module entry point.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/static-server-smoke.test.js`
Expected: FAIL before the smoke helper or required integration output exists.

- [ ] **Step 3: Implement resilient Leaflet synchronization**

On each day change clear the previous layer group, create numbered accessible markers, draw a route polyline when two or more coordinates exist, fit bounds, and leave the timeline fully active if Leaflet is absent.

- [ ] **Step 4: Run automated tests and verify GREEN**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Verify in a real browser**

At 390×844 and 430×932, exercise all six tabs, timeline selection, sheet expansion/collapse, marker selection, external links, no-horizontal-overflow, and simulated Leaflet failure. Compare screenshots to the approved visual concept.

- [ ] **Step 6: Commit**

Commit: `test: verify trip map browser integration`

### Task 4: Publishing documentation and GitHub Pages deployment

**Files:**
- Create: `README.md`
- Create: `.nojekyll`
- Modify: `package.json`

**Interfaces:**
- Consumes: verified static site from Tasks 1–3.
- Produces: local usage instructions, data-editing instructions, GitHub Pages-compatible root, and a public production URL.

- [ ] **Step 1: Add deployment and update instructions**

Document `npm test`, local serving, the `itinerary-data.js` edit workflow, privacy rules, and GitHub Pages root deployment.

- [ ] **Step 2: Run final local verification**

Run: `npm test`
Expected: all tests pass with zero failures.

- [ ] **Step 3: Publish the repository and enable GitHub Pages**

Create or reuse the public repository `kyoto-osaka-2026-trip-map`, push the branch, enable Pages from the default branch root, and wait for the published URL.

- [ ] **Step 4: Verify the production URL**

Open the GitHub Pages URL on a phone-sized viewport and repeat the core D1, D4, and D6 interaction checks.

- [ ] **Step 5: Commit any documentation-only corrections**

Commit: `docs: add trip map usage and deployment guide`
