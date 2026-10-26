# MarketDash

Angular dashboard with page NgModules, standalone UI components, Tailwind v4 and
D3 daily historical charts. Stocks: AAPL, MSFT, TSLA. Forex: EUR/USD, GBP/USD,
USD/JPY. No demo mode or fabricated-price fallback.

## Architecture and key exposure

Angular HttpClient calls **https://www.alphavantage.co/query** directly. The URL is
`environment.apiUrl` in `src/environments/environment.ts`. There is no API proxy,
Netlify Function, Express server, or other backend. Development and production use
the same client integration.

**The API key is necessarily public in the browser JavaScript bundle and network
requests.** Git ignoring a file does not hide its value from site visitors. Anyone
with access to the deployed app can obtain and use the key against the same quota.
This architecture cannot keep a shared provider key confidential.

The configured key value stays out of tracked source files. A build helper reads
the existing `ALPHA_VANTAGE_API_KEY` from local `.env` or the process environment
and writes `src/environments/environment.local.ts`, which Git ignores. Never
commit this generated file, `.env`, or build output. The tracked `environment.ts`
imports the generated value. No key is printed by the helper. Tests override the
key with a test-only value and make no provider requests.

## Local development

Use Node 24.19.0 (pinned in `.nvmrc` and `netlify.toml`) and npm 11.2+:

```sh
npm ci
# Keep your existing .env, or copy .env.example and configure the key locally.
npm start
```

Open **http://localhost:4200**. `npm start` generates configuration and runs
`ng serve`. No Netlify process or port 8888 is needed.

For bare Angular CLI commands after changing `.env`:

```sh
npm run configure:env
ng serve
```

`postinstall` generates an empty configuration when no key is present, allowing
installation before local setup. `npm start` and `npm run build` require a key and
regenerate the ignored configuration before invoking Angular. Restart `npm start`
after changing `.env`. On PowerShell installations that block npm.ps1, use
`npm.cmd` and `npx.cmd`.

## Netlify production

`netlify.toml` defines a static build only:

- Build command: `npm run build`.
- Publish: `dist/stock-forex-dashboard/browser`.
- Node 24.19.0.
- SPA rewrite: `/*` to `/index.html` with status 200, supporting direct navigation
  to `/stocks` and `/forex`.

Configure **ALPHA_VANTAGE_API_KEY in Netlify's build environment** before deploying.
The helper embeds that value into the frontend build. A Functions-only variable
is insufficient because no functions are used. If using a parent repository,
set the base directory to the Angular project folder containing `package.json`.
Deploy again after changing the key. Do not upload `.env` or rely on runtime
server variables to configure an already-built static site.

Public Netlify deployment is not performed by the build/test commands below.
Local production preview can verify the bundle and SPA rewrite, but is not proof
of a publicly deployed site's configuration.

## Requests, normalization and precision

Stocks use `function=TIME_SERIES_DAILY`, `symbol`, `outputsize=compact`, `apikey`.
Forex uses `function=FX_DAILY`, `from_symbol`, `to_symbol`, `outputsize=compact`,
`apikey`. Only the supported free-tier daily endpoint families are requested.
No paid fallback or premium intraday request is made.

The parser accepts only valid calendar dates and finite positive daily closes,
sorts them chronologically, and calculates the change from the latest two valid
closes. Missing/zero/invalid closes are excluded; no valid observations shows an
empty state, and a single close shows no percentage change. Provider metadata is
checked to avoid displaying another instrument under the requested symbol.

The same normalized observations feed summaries, D3 charts and historical tables.
Dates are represented at UTC midnight. The latest available trading date and
Alpha Vantage source appear in the UI, labeled **daily historical data, not live
streaming prices**. Stock summaries use two decimals, forex four (three for JPY),
and chart inspection preserves additional provider decimals up to eight.

## Free-tier quota safeguards

- No polling and no automatic retry loops.
- A 200 ms selection delay collapses rapid switching; leaving an instrument
  cancels queued timers and obsolete HTTP subscriptions.
- In-flight requests for the same instrument are shared.
- Daily history is cached in memory and per-tab sessionStorage for six hours;
  empty history for five minutes. Refreshing the tab restores valid cached data.
  No key is stored in this market-data cache.
- Requests are spaced at least 1.2 seconds apart within each application instance.
- Rate-limit responses pause requests for 15 minutes (one minute for explicit
  short-term notices). The cooldown is retained within the browser tab.
- Invalid-key/access-denial errors are cached in memory for 15 minutes. Rebuild
  after changing the configured key. Close the tab to clear per-tab caches.

These are **client-local safeguards**, not a global quota guarantee. Other users,
other tabs/devices, cleared storage and unrelated uses of the exposed key can
consume the same 25-request daily allowance. Request cancellation cannot undo a
provider request that has already been sent. Cached data may lag the latest
available provider observation by the cache duration; always check the shown date.

## Errors, toasts and dialogs

Network/CORS failures, malformed responses, key rejection and unavailable/premium
endpoints show safe error messages, persistent error toasts and inline Retry.
Provider HTTP 200 rate-limit notices are recognized as errors and show a warning
with a persistent inline explanation. No failure silently substitutes prices.
Successful background loads do not produce success toasts. Repeated messages are
deduplicated; at most three toasts are visible. Noncritical notices expire in five
seconds, pausing while hovered/focused. Rate warnings last ten seconds.

The reusable modal opens only when the user chooses Error details and offers
Retry/Close, keyboard focus trapping/restoration, Escape and backdrop dismissal.
The application-level NotificationService API is `success`, `error`, `warning`
and `info`, with optional `{ durationMs }` (zero means persistent).

## Verification

```sh
npm run build
npm test -- --watch=false
```

Unit tests cover direct endpoint parameters, stock/FX parsing, chronological
normalization, metadata validation, empty/invalid data, caching, session restore,
cancellation, request pacing, cooldown, errors, selection, notifications, dialogs
and D3 behavior. Test responses are isolated from the running application.

On October 24, 2026, normal-security Edge browser fetches directly to Alpha
Vantage succeeded for AAPL and EUR/USD. Each returned 100 daily observations with
`Access-Control-Allow-Origin: *`, without a proxy or disabled browser security.
CORS must continue to be permitted by the provider; a future provider policy
change may block this direct-browser architecture. Do not use public CORS-bypass
services or disable browser security as a workaround.

The production bundle was also checked in a local Netlify static preview: direct
AAPL/EUR/USD requests each populated 100 D3 points and matching summaries/tables,
reloads reused session caches without additional provider calls, and both SPA
routes returned the Angular shell. `npm start` was verified to launch Angular
alone. A public Netlify deployment remains unverified; configure its build-time
key and deploy before treating public-host compatibility as tested.

## GitHub handoff

The configured origin is https://github.com/emmaofori20/stock-forex-dashboard.git.
If using another repository, change origin before pushing. From this folder:

```sh
git status --short
git add .
git diff --cached --stat
git diff --cached --name-only
# Review the staged changes locally; do not paste credential values into logs.
git commit -m "Prepare MarketDash for static Netlify deployment"
git push -u origin HEAD
```

Before committing, confirm the staged filenames contain no `.env`, local environment
files, `environment.local.ts`, `node_modules`, `dist`, or `.netlify` artifacts.
The placeholder-only `.env.example` should be committed. Keep `package-lock.json`.

## Connect GitHub to Netlify

1. In Netlify choose **Add new project / Import an existing project**, then GitHub.
2. Authorize access to the repository and select `stock-forex-dashboard`.
3. Choose the production branch you pushed. Leave the base directory empty when
   this Angular project is the repository root.
4. Confirm build command `npm run build` and publish directory
   `dist/stock-forex-dashboard/browser`. These are defined by `netlify.toml`;
   do not accept a detected SSR/server build command. No Functions are needed.
5. Before starting the production build, add `ALPHA_VANTAGE_API_KEY` through the
   environment-variable settings. Include the **Builds** scope (if scopes are
   offered) and the production deploy context. Add other contexts only if you
   intend previews/branch deploys to expose and consume this key too. Never put
   the value in GitHub source or `netlify.toml`.
6. Deploy. If the import flow deployed before the variable was configured, set
   the variable and trigger a new deploy. Missing/blank keys intentionally fail
   before Angular builds. Changing the key always requires a new build/deploy.
7. Inspect the build log for success and confirm the deployed file browser has
   `index.html` at its root. Open the generated HTTPS site URL.

Netlify's Angular SPA fallback is documented at
https://docs.netlify.com/build/frameworks/framework-setup-guides/angular/.

## Acceptance checks on the deployed URL

- Open `/`, then open `/stocks` and `/forex` directly in new tabs and refresh
  each. Confirm the correct page, navigation state, charts, and tables appear.
- In browser DevTools Network, confirm market requests go directly to
  `https://www.alphavantage.co/query` with the intended stock/forex parameters.
  Do not share request URLs or screenshots containing the key.
- Check one stock and one forex pair, instrument switching, matching chart/table
  data, mobile navigation, and browser console errors. Reuse cached data where
  possible to conserve the shared provider quota.
- Verify CORS and key access from the actual public origin. If the provider
  returns a quota or entitlement notice, verify the error UI and retry after the
  allowance resets; a static build cannot establish provider access.

A successful local test/build is not a successful public deployment. Record the
actual URL and these results after deployment; until then public hosting, CORS,
and provider access from that origin remain unverified.

## Dependency audit at deployment preparation

The clean installation and final verification on October 26, 2026 passed all
54 tests and the production build. `npm audit --omit=dev` reported no production
dependency vulnerabilities. The full audit reported two development-tool entries
(one low, one high) involving `@angular/build` and its nested Vite 8.3.2.
These tools are not shipped as a server on Netlify. Review a compatible patched
Angular build-tool release before exposing the local development server; the
suggested forced audit fix changes the Angular build-tool release and was not
applied as part of deployment configuration.
