<div align="center">

# TokoMart E2E Testing (Playwright)

Web UI and API tests for TokoMart in one Playwright project.

  <img src="../docs/images/toko-mart-playwright-read-me-v2.png" alt="TokoMart-Playwright" width="1000" />

</div>

<br />

<div align="center">
  <img src="../docs/images/toko-mart-playwright-run-read-me-v1.gif" alt="TokoMart-Playwright-gif" width="1000" />
</div>

---

## Best Practices

### Storage State (auth setup)

Auth is handled once per run via setup projects — never log in through the UI inside individual tests.

- **`buyer.setup.ts`** logs in via API, injects token into `localStorage`, then saves `.auth/buyer.json`.
- **`seller.setup.ts`** does the same for the seller account, promoting to seller role if needed.
- Tests in `web-buyer` and `web-seller` projects receive the saved state automatically via `storageState` in `playwright.config.ts` — no login step needed in those test files.
- **`web-mixed` project has no `storageState`** — tests that switch between buyer and seller (e.g. cart isolation, order isolation) must manage auth themselves using `signupFreshUser()` or the API login helper.
- **Never call the login UI in a web E2E test.** Use the saved `storageState` or, for fresh accounts, `signupFreshUser()` from `helpers/api-client.ts`.
- **Do not share `storageState` files between CI jobs** without clearing server-side state first. `buyer.setup.ts` clears the cart via API before saving so the snapshot starts clean.
- **Product seeds in `beforeAll`** must include `shippingOptions` and `shippingFee` — the backend rejects product creation without them. Use `randomShipping()` (JSON body) or `randomShippingMultipart()` (multipart) from `helpers/test-data.ts`.

### Web E2E (`tests/web/`)

**Structure**
- TC-* ID in the file header comment on line 1.
- Self-contained: rely on `storageState` for auth; no shared mutable state between tests.
- Buyer specs share one buyer and one server-side cart, so `web-buyer` runs with a single worker. Clear the cart in `beforeEach` and never assume another spec left it untouched.
- No `test.only()` or `test.skip()` left in committed files.

**Locator priority — scope first, then pick the most stable locator inside the scope**
1. Structural anchor for repeated UI: `getByTestId('cart-seller-group-{sellerId}')`, `getByTestId('product-card-{id}')`, `getByTestId('order-card-{id}')`
2. Inside a scope: role + accessible name: `sellerGroup.getByRole('button', { name: 'Apply voucher' })`
3. Fallback: element testid when role/name is ambiguous: `getByTestId('select-voucher-btn-{sellerId}')`
4. Scoped stable text only: `paymentSection.getByText('Cash on Delivery')`
5. **Never:** XPath, CSS chains, `nth-child`, unscoped dynamic text (prices, order IDs, product names), `waitForTimeout`

**Multi-seller scoping**
Always anchor cart/checkout locators to `cart-seller-group-{sellerId}` before using role or text. Unscoped selectors in multi-seller UI are an [IMPORTANT] finding.

**Waits**
Never use `waitForTimeout`. Use `expect(locator).toBeVisible()` or Playwright's built-in auto-wait.

**Assertions (domain rules)**
- Use persisted `order.total` — not the sum of raw line prices.
- Assert `"Cash on Delivery"` label, not the `"cash-on-delivery"` slug.
- Per-seller tax and shipping lines must appear separately on multi-seller checkout.
- Sale items: assert discounted price + strikethrough original.

### API (`tests/api/`)

**Structure**
- File named `*.api.spec.ts`; uses `request` fixture only — no `page`.
- Auth via `helpers/api-client.ts`: `login()`, `authHeaders()`, `signupFreshUser()`.
- Each `test.describe` block maps to one or more `TC-*` IDs.

**Fresh accounts**
Use `signupFreshUser(request, 'prefix')` for tests that need a clean user. Never depend on shared seeded state changing between runs — use `beforeAll` to create what the test needs.

**Product creation — required shipping fields**
`shippingOptions` and `shippingFee` are required by the backend. All product creation calls must include them. Use the helpers from `helpers/test-data.ts`:
- JSON-body requests: spread `randomShipping()` into `data`
- Multipart requests: spread `randomShippingMultipart()` into `multipart` (arrays are pre-serialized to JSON strings)

When `shippingFee` is `buyer_pays`, `randomShipping()` also generates `shippingFeeAmounts` with a random fee per selected delivery option.

**Assertions**
Assert all three layers: status code + `body.success` + `body.message`. Check `backend/NOTES.md` for the exact error string from the backend source.

---

## Prerequisites

The tests run against a real stack: no mocks. Start it from the repository root, in separate terminals:

```bash
cd backend && npm run seed && npm run dev   # API on :5000
cd frontend && npm run dev                  # web on :5173 (web tests only)
```

- `npm run seed` replaces the users and products in the database it points at. Use a development or test database, never data you want to keep. It creates the accounts the tests log in with (`b1@test.com`, `b2@test.com`, `s1@ex.com`, `s2@ex.com`, `x@x.com`).
- Card checkout needs a MongoDB **replica set** (transactions) and Stripe **test-mode** keys in the backend and web `.env` files.
- The web projects drive Google Chrome (`channel: 'chrome'` in `playwright.config.ts`), so Chrome must be installed.
- Match the checkout flow on all three sides. The default is `legacy`. For the authorization flow set `CHECKOUT_FLOW=manual_capture` on the backend, `VITE_CHECKOUT_FLOW=manual_capture` when the web app starts or builds, and `CHECKOUT_FLOW=manual_capture` for the test run. Specs that only apply to that flow skip themselves otherwise (see [Environment](#environment)).
- Rate limits: the backend allows 10 auth requests and 100 API requests per minute per IP by default. The API specs sign up many users, so run them against a backend started with `RATE_LIMIT_AUTH_MAX=0 RATE_LIMIT_API_MAX=0`. `rate-limit.api.spec.ts` needs the opposite, small limits (for example `3` and `5`), and runs on its own.

## Setup

```bash
cd e2e-testing
cp .env.example .env     # URLs, buyer and seller accounts, checkout flow; edit if yours differ
npm install
npx playwright install chrome   # only if Chrome is not already installed (web tests)
```

`playwright.config.ts` reads `e2e-testing/.env`. Keep real values out of commits.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `API_URL` | `http://localhost:5000` | Backend base URL (API tests, and API calls made by web tests) |
| `WEB_URL` | `http://localhost:5173` | Web app base URL. Keep it on `localhost`: the backend's CORS allows only `http://localhost:<port>` in development |
| `BUYER_EMAIL`, `SELLER_EMAIL`, `TEST_PASSWORD` | seeded accounts | Accounts used by the setup projects and helpers |
| `CHECKOUT_FLOW` | `legacy` | Must match the backend. `manual_capture` also enables the authorization-flow specs |
| `LOCAL_PAYMENT_VERIFICATION` | unset | Set to `true` to run the opt-in `local-payment-settlement.spec.ts` (otherwise skipped) |

## Run

```bash
npm test                  # every project
npm run test:api          # API only (backend required)
npm run test:web          # web buyer, seller and mixed (backend + frontend required)
npm run test:web:buyer    # one web project
npm run test:web:seller
npm run test:web:mixed
npm run test:ui           # interactive UI mode
npm run report            # open the HTML report
```

Run one test by its tag:

```bash
npx playwright test --project=web-buyer --grep @TC-024
```

Projects, in `playwright.config.ts`:

| Project | What it runs | Notes |
|---------|--------------|-------|
| `buyer-setup`, `seller-setup` | `tests/auth/*.setup.ts` | Log in through the API and save `.auth/buyer.json` and `.auth/seller.json`. Other web projects depend on them |
| `api` | `tests/api/*.api.spec.ts` | HTTP only, no browser |
| `web-buyer` | `tests/web/buyer/` | **One worker.** The buyer specs share one buyer and its server-side cart and each clears it before every test, so they cannot run in parallel. Also depends on `seller-setup` (`product-detail.spec.ts` creates products as the seller) |
| `web-seller` | `tests/web/seller/` | Uses the saved seller state |
| `web-mixed` | `tests/web/mixed/` | No saved state; each spec switches roles itself |

Run the web projects one after another, not at the same time: the buyer and mixed specs use the same accounts and carts.

## Continuous integration

`.github/workflows/e2e.yml` runs these suites against a fresh stack started inside the GitHub runner (MongoDB replica set, seeded database, backend and, for web specs, the web app). It does not touch a hosted environment.

| Job | Runs on | Covers |
|-----|---------|--------|
| API specs | every pull request, push to `main`, nightly | `--project=api`, rate limits off, without TC-114 to TC-119 |
| API rate-limit spec | same | `rate-limit.api.spec.ts` alone, limits `3` and `5` |
| Web specs | push to `main`, nightly, manual run (not pull requests) | `web-buyer`, then `web-seller`, then `web-mixed` |

- The web job needs the repository secrets `STRIPE_SECRET_KEY` (a `sk_test_` key) and `STRIPE_PUBLISHABLE_KEY`; `STRIPE_WEBHOOK_SECRET` is optional. The API jobs run without them.
- Reports, traces and the backend log are uploaded as artifacts for 7 days, even when tests fail.
- `CI` is set on the runner, so Playwright retries each failing test twice and forbids a stray `test.only`.
- A manual run is under Actions → E2E (Playwright) → Run workflow. The stack setup is the composite action `.github/actions/e2e-stack`.

## QA pipeline

```
/create-scenarios → /test-strategy → /generate-tests → /review-tests
```

| Stage | Output |
|-------|--------|
| create-scenarios | `docs/test-cases/test-scenarios*.md` |
| test-strategy | `docs/test-strategies/test-strategy*.md` |

Generated tests land here; map each file to `TC-*` IDs in comments and tags. More detail per folder: [`tests/api/README.md`](tests/api/README.md), [`tests/web/README.md`](tests/web/README.md), and the `NOTES.md` file in each test folder.

## Test coverage

IDs are the `@TC-*` tags on each test. The scenario and strategy docs hold the full steps and current status of every `TC-*`.

### API (`tests/api/`)

| File | TC IDs | Description |
|------|--------|-------------|
| `auth.api.spec.ts` | TC-132, TC-232, TC-233, TC-234 | Login, GET /me, invalid credentials |
| `health.api.spec.ts` | TC-298 | API server health smoke |
| `orders.api.spec.ts` | TC-025, TC-026, TC-033, TC-056, TC-257 | Order totals and coupons, seller-configured shipping, multi-seller split, cancel guard, stock validation |
| `security.api.spec.ts` | TC-053, TC-132, TC-133, TC-134, TC-135, TC-136 | Protected routes return 401, tampered JWT rejected, seller order scoping (IDOR), buyer blocked from seller routes, weak password rejected |
| `seller-access.api.spec.ts` | TC-048, TC-053, TC-054 | Buyer blocked from seller routes, cross-seller edit/delete blocked, invalid status transition |
| `seller-products.api.spec.ts` | TC-058, TC-303 to TC-311 | Seller product create and update validation |
| `reviews.api.spec.ts` | TC-035, TC-036 | Duplicate review blocked, review before delivery blocked |
| `coupons.api.spec.ts` | TC-057 | Coupon below minimum order amount |
| `cart.api.spec.ts` | TC-107, TC-108, TC-132 | Cart returns buyer's own items, cart isolation between buyers |
| `order-isolation.api.spec.ts` | TC-110, TC-111 | Order list isolation, order detail ownership (403) |
| `rate-limit.api.spec.ts` | TC-114 to TC-119 | Rate limiting across auth, orders, and review endpoints. Needs small limits; runs alone |
| `stripe-webhook.api.spec.ts` | TC-193, TC-229, TC-295 | Stripe webhook endpoint and card orders without a payment intent |
| `users.api.spec.ts` | TC-113 | User profile read and update |

### Web E2E (`tests/web/`)

| File | TC IDs | Description |
|------|--------|-------------|
| `buyer/login.spec.ts` | TC-001 | Buyer login, authenticated navbar |
| `buyer/product-browse.spec.ts` | TC-010, TC-011 | Search by keyword, filter by category |
| `buyer/product-detail.spec.ts` | TC-012, TC-013, TC-014 | Sale price display, variant selection, add-to-cart guard |
| `buyer/checkout.spec.ts` | TC-022, TC-023, TC-024, TC-025, TC-029, TC-500 | Checkout with COD, saved card and new card; multi-seller orders; missing address fields; Stripe card field |
| `buyer/card-checkout-authorization.spec.ts` | TC-143, TC-144, TC-146, TC-147, TC-148, TC-151, TC-400 | Authorization checkout: payment reserved, declined card, 3DS cancel and resume, expired checkout. Runs only with `CHECKOUT_FLOW=manual_capture` |
| `buyer/variant-checkout.spec.ts` | TC-098, TC-105, TC-106 | Checkout with variant product across payment methods |
| `buyer/local-payment-settlement.spec.ts` | none yet | Opt-in local verification of acceptance, cancellation and expiry. Skipped unless `LOCAL_PAYMENT_VERIFICATION=true` |
| `seller/seller-product-wizard.spec.ts` | TC-064 | Seller creates variant product via wizard, verifies on detail page |
| `seller/seller-simple-product-crud.spec.ts` | TC-042, TC-044, TC-045, TC-046, TC-122 | Simple product CRUD: create, edit, preview, delete, My Products list |
| `seller/seller-variant-product-crud.spec.ts` | TC-046, TC-120, TC-121 | Variant product edit, buyer preview, delete |
| `seller/seller-access.spec.ts` | TC-054 | Seller dashboard shows only own products |
| `mixed/cart-isolation.spec.ts` | TC-109 | Buyer2 sees own empty cart, not buyer1's items |
| `mixed/order-isolation.spec.ts` | TC-112 | Buyer2 sees only own order history, not buyer1's orders |
| `mixed/product-catalog-visibility.spec.ts` | TC-008, TC-065 | Guest browse, seller listing visible to buyer in catalog |
| `mixed/role-switch.smoke.spec.ts` | none | Auth state switching smoke test |

| Folder | Type | Pattern |
|--------|------|---------|
| `tests/web/` | Browser E2E | `*.spec.ts` |
| `tests/api/` | HTTP API | `*.api.spec.ts` |

Mobile tests remain in `frontend-mobile/patrol_test/` (Patrol).
