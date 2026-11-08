<div align="center">

# TokoMart Mobile E2E Tests (Patrol)

Patrol tests for the TokoMart Flutter mobile app.

  <img src="../../docs/images/toko-mart-patrol-read-me-v2.png" alt="TokoMart-Patrol" width="1000" />

</div>

<br />

<div align="center">
  <img src="../../docs/images/toko-mart-patrol-run-read-me-v3.gif" alt="TokoMart-Patrol" width="1000" />
</div>

&ensp;

---

## Best Practices

### Structure

- **One test per file.** Each `*_test.dart` contains exactly one `testApp()` call.
- **Always use `testApp()`.** Never call `patrolTest()` directly — `testApp()` handles app boot, storage clear, and notification init.
- **TC-* ID in the file header and in the test title.** First line is a comment: `// TC coverage: TC-XXX`; the `testApp()` title starts with `TC-XXX:`.
- **A unique tag per test.** Add `tc-xxx` next to any shared tag (see [Tags](#tags)).
- **Write actions in the test file first.** Only extract to modules after the test passes. Rerun after every refactor to confirm it still passes.

### Locators

- **Always use `$(keys.feature.element)`.** Never hardcode strings or widget types.
- **Parameterized keys for list items.** Use `keys.feature.element(value)` when widgets are generated from dynamic data (variant rows, cart items, category options).
- **`find.text` only for assertions, never for taps.** If you need to tap something, it must have a key.
- **Keys live in `lib/features/<feature>/keys.dart`**, alphabetically sorted, registered in `lib/keys.dart`.

### Actions

- **No waits before or after `tap`, `enterText`, `scrollTo`.** Patrol auto-waits — adding `waitUntilVisible` before these is redundant and slows the suite.
- **Scroll before interacting with offscreen widgets.** Use `.scrollTo()` (or `.scrollTo(scrollDirection: AxisDirection.down)`) before tapping items below the fold.
- **Handle native dialogs immediately** after the action that triggers them. Use `$.platform.mobile.grantPermissionWhenInUse()` over manual native taps.

### Assertions

- **Assert only at the end of the test.** Do not assert after every action.
- **Prefer `waitUntilVisible` as the final assertion.** Use `expect()` only when visibility alone is not enough.
- **Shipping cost** is seller-configured — do not assert a flat `$9.99` or a free-over-$50 threshold. Assert `Free` when the seller chose free shipping, or the seller's configured fee amount when buyer pays. If the seller's config is unknown at assertion time, assert that a shipping line is visible rather than its value.

### Modules

- **Write to modules only after the test passes.** Premature extraction before a passing test adds risk.
- **Use descriptive method names, not comments.** A well-named method documents itself.
- **Name parameters.** Prefer named parameters (`acceptOrderAndStartPreparing(orderId: id)`), and log one step line with `$.log(...)` at the start of each module method that a test calls.
- **Split long module methods** when they represent multiple distinct logical steps that can each be named clearly.

---

## Prerequisites

- Flutter SDK installed
- Patrol CLI installed (`dart pub global activate patrol_cli`). The app depends on the `patrol` package (`^4.11.0`); Patrol CLI 4.7.0 or newer works with it. If `patrol` is not recognised, run it from the Pub cache: `%LOCALAPPDATA%\Pub\Cache\bin\patrol.bat` on Windows.
- JDK 17 (Patrol builds the Android app with Gradle)
- Android emulator or physical device connected (`adb devices`), with at least about 1 GB free (the app and Patrol test APKs fail to install with `INSTALL_FAILED_INSUFFICIENT_STORAGE` when the emulator is nearly full)
- Backend running on `:5000` with seed data (the default `BASE_URL` is `http://10.0.2.2:5000`)

```bash
cd backend && npm run seed && npm run dev
```

The tests marked **local Stripe** below need a different setup; see [Local Stripe tests](#local-stripe-tests).

## Run

Single test by file:
```bash
cd frontend-mobile
patrol test --target patrol_test/<folder>/<file>_test.dart
```

Single test, or a group, by tag (no `--target` needed; Patrol builds all tests and runs the matching ones):
```bash
patrol test --tags smoke
patrol test --tags tc-182
patrol test --tags 'tc-179 || tc-180'
```

All tests:
```bash
cd frontend-mobile
patrol test
```

With explicit credentials (if not set in `test_credentials.dart`):
```bash
patrol test --target patrol_test/0_auth/login_test.dart \
  --dart-define=BUYER_EMAIL=b1@test.com \
  --dart-define=TEST_PASSWORD=<test password>
```

Notes:
- On Windows PowerShell, put the whole command on one line (no `\` continuation).
- Patrol rewrites the tracked `patrol_test/test_bundle.dart` on every run. Restore it before committing (`git restore patrol_test/test_bundle.dart`).
- Each module method that a test calls writes a step line to the Patrol output with `$.log(...)`, for example "Logging in as x@x.com" or "Accepting order <id> and starting preparation".

## Tags

- A tag is a lowercase identifier with optional hyphens, listed right after the description in `testApp(...)` and in the file header (`// Tags: ...`). Never use `@`; an invalid tag can break Patrol's test explorer.
- Every test that needs its own run has a **unique tag**, `tc-<id>` (for example `tc-182`), so it can be selected alone. Shared tags (`smoke`, `checkout`, `seller`, `local-stripe-verification`) select groups. Do not select by `local-stripe-verification` unless you mean to run every local Stripe test.

## Structure

```
patrol_test/
├── test_app.dart           # testApp() wrapper — required by all tests
├── test_credentials.dart   # seed account credentials (buyer b1@test.com, seller x@x.com)
├── test_bundle.dart        # generated by Patrol; restore it after a run
├── modules/
│   ├── module.dart         # base Module class
│   ├── modules.dart        # Modules aggregator
│   ├── auth.dart           # login, signup
│   ├── products.dart       # search, add to cart, open the cart
│   ├── checkout.dart       # address, payment method, Stripe card sheet, saved card, submit
│   ├── orders.dart         # orders list, order details, cancel, payment notices
│   ├── seller.dart         # dashboard, product wizard, accept an order
│   ├── api_clients.dart    # SellerApiClient: create and delete products through the API
│   └── local_payment_api.dart # API fixtures and checks for the local Stripe tests
├── 0_auth/                 # Authentication tests
├── 1_seller/               # Seller flow tests
└── 2_buyer/                # Buyer flow tests
```

`test_bundle.dart` and `integration_test/patrol_test_bundle.dart` are generated
by Patrol. Keep run-specific generated changes out of feature diffs. The checked-in
bundle is currently referenced by the integration entrypoint, so do not delete it
without updating that entrypoint and its generation workflow together.

## Local Stripe tests

These tests place real card orders in **Stripe test mode** against an isolated backend, so they are opt-in. They run only with `LOCAL_PAYMENT_VERIFICATION=true`; otherwise their `main()` returns and they register no test.

Requirements:
- The isolated backend on `http://10.0.2.2:5001` (from the emulator), started with `CHECKOUT_FLOW=manual_capture`, a MongoDB replica set, Stripe **test** keys, and a seeded database.
- The app and the backend use the same flow: `--dart-define=CHECKOUT_FLOW=manual_capture`.
- A Stripe test publishable key (`pk_test_...`) in `frontend-mobile/.env`.
- `API_BASE_URL=http://10.0.2.2:5001/api` and `BASE_URL=http://10.0.2.2:5001`.

```bash
patrol test --tags tc-182 --device emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:5001/api --dart-define=BASE_URL=http://10.0.2.2:5001 --dart-define=CHECKOUT_FLOW=manual_capture --dart-define=LOCAL_PAYMENT_VERIFICATION=true
```

How the data is prepared (`modules/local_payment_api.dart`):
- The tests create their own orders through the checkout session API (Stripe's published test card `tok_visa`), clear the buyer's cart, and save a test card for the buyer when there is none. Nothing needs to be set up by hand, except for TC-401.
- TC-401 needs an order whose acceptance deadline has passed. No API changes a deadline, so run `node --import tsx scripts/local-expired-order-fixture.mjs` from `backend` (the API must be running). It prints `LOCAL_EXPIRED_ORDER_ID=<id>`; pass that as a `--dart-define`.
- `LOCAL_ACCEPT_ORDER_ID` and `LOCAL_CANCEL_ORDER_ID` are optional overrides for TC-182/TC-179 and TC-180.
- The seller comes from `SELLER_EMAIL` (default `x@x.com`, owner of the seeded "The Art of Programming"). The multi-seller test creates a second seller's product as `s1@ex.com` (`SECOND_SELLER_EMAIL`) and deletes it at the end.

See [local payment verification](../../docs/local-payment-verification.md) for the full guide, the database and the backend settings.

## Test coverage

IDs map to `docs/test-cases/test-scenarios-mobile.md`; the title of each test starts with its ID. A test is **partial** when it checks only part of its scenario; the scenario file says which part.

### 0_auth — Authentication

| File | TC ID | Tags | Description |
|------|-------|------|-------------|
| `login_test.dart` | — | `smoke` | Logs in with seeded buyer account, verifies home screen |
| `signup_test.dart` | — | `smoke` | Signs up with valid data, lands on home screen |

### 1_seller — Seller Flows

| File | TC ID | Tags | Description |
|------|-------|------|-------------|
| `add_product_simple_test.dart` | TC-090 | `add-product-simple`, `seller`, `smoke` | Seller creates a simple product via 7-step wizard; shipping fee selection is required |
| `read_product_simple_test.dart` | TC-615 | `read-product-simple`, `seller`, `product-read` | Seller views simple product in seller dashboard |
| `edit_product_simple_test.dart` | TC-616 | `edit-product-simple`, `seller`, `product-update` | Seller edits simple product from dashboard |
| `delete_product_simple_test.dart` | TC-617 | `delete-product-simple`, `seller`, `product-delete` | Seller deletes simple product from dashboard |
| `add_product_variant_test.dart` | TC-091 | `add-product-variant`, `seller`, `smoke` | Seller creates a variant product via 7-step wizard; shipping fee selection is required |
| `read_product_variant_test.dart` | TC-618 | `read-product-variant`, `seller`, `product-read` | Seller views variant product in seller dashboard |
| `edit_product_variant_test.dart` | TC-619 | `edit-product-variant`, `seller`, `product-update` | Seller edits variant product from dashboard |
| `delete_product_variant_test.dart` | TC-620 | `delete-product-variant`, `seller`, `product-delete` | Seller deletes variant product from dashboard |
| `local_seller_accepts_order_test.dart` | TC-182 (partial) | `tc-182` | **Local Stripe.** Test creates a pending card order through the API; the seller accepts it; the API confirms capture |

### 2_buyer — Buyer Checkout Flows

| File | TC ID | Tags | Description |
|------|-------|------|-------------|
| `simple_cod_checkout_test.dart` | TC-095 | `checkout-cod`, `checkout`, `smoke` | Buyer places COD order (simple product) |
| `variant_cod_checkout_test.dart` | TC-101 | `checkout-variant-cod`, `smoke` | Buyer places COD order with variant product |
| `simple_saved_credit_checkout_test.dart` | TC-096 | `tc-096` | **Local Stripe.** Saved card, simple product; checks the order is `authorized` |
| `simple_new_credit_checkout_test.dart` | TC-097 | `tc-097` | **Local Stripe.** New card in the native Stripe sheet, simple product |
| `variant_new_credit_checkout_test.dart` | TC-103 | `tc-103` | **Local Stripe.** New card, variant product (size M); checks `Size: M` on the order item |
| `variant_saved_credit_checkout_test.dart` | TC-104 | `tc-104` | **Local Stripe.** Saved card, variant product (size M); checks `Size: M` on the order item |
| `multi_seller_card_checkout_test.dart` | TC-083 (card leg) | `tc-083` | **Local Stripe.** Two sellers' products, saved card; expects two authorized orders, one hold per seller |
| `local_buyer_cancels_order_test.dart` | TC-180 (partial) | `tc-180` | **Local Stripe.** Test creates a pending card order; the buyer cancels it and sees "Reservation released" |
| `local_charged_payment_notice_test.dart` | TC-179 (partial) | `tc-179` | **Local Stripe.** Test creates and accepts an order through the API; the buyer sees "Payment charged" |
| `local_expired_order_notice_test.dart` | TC-401 (partial) | `tc-401` | **Local Stripe.** The buyer sees "Reservation released" on an order that expired unaccepted (`LOCAL_EXPIRED_ORDER_ID`) |

The **local Stripe** tests all carry `local-stripe-verification` plus the unique tag shown; some also carry descriptive tags such as `checkout` (see the `// Tags:` line in each file).

## Architecture

Each test file contains exactly one `testApp()` call. Test actions are written directly in the test file first, then extracted into modules after the test passes. See `modules/` for reusable flows.

- **App flows** → `modules/*.dart` (`auth`, `products`, `checkout`, `orders`, `seller`); tests call module methods only
- **API setup and checks** → `modules/api_clients.dart` and `modules/local_payment_api.dart`
- **Native interactions** → `$.platform` APIs (not `flutter_test`)
- **Widget locators** → `keys.*` from `lib/keys.dart` (never hardcoded strings)

Full architecture guide: `.claude/skills/patrol-test-architecture/`
