# web/buyer — Buyer Web E2E Tests

Playwright tests for buyer-facing flows on the TokoMart web app (`http://localhost:5173`).
All tests run under the `web-buyer` Playwright project, which injects pre-authenticated buyer storage state from `.auth/buyer.json`.

---

## Test Cases

### TC-001 — `login.spec.ts`
**Buyer can log in and see the authenticated navbar**

Navigates to `/login`, fills credentials, submits the form, and asserts the authenticated navbar is visible. Covers the S1 smoke baseline for web login.

| Assertion | Element |
|-----------|---------|
| Navbar visible after login | `navbar` testid |

---

### TC-022, TC-025, TC-029, TC-500 — `checkout.spec.ts`
**Buyer checkout: Cash on Delivery, multi-seller orders, address validation and the Stripe card field**

Every test creates its own in-stock product through the API (`createCheckoutProduct`; TC-025 uses `createProductsFromTwoSellers`), clears the buyer's cart in `beforeEach`, then drives the UI. The tests run one after another (serial mode), and the `web-buyer` project is limited to one worker, because all buyer specs share one buyer and one cart. Checks that only hold for the authorization flow run only when `CHECKOUT_FLOW=manual_capture`.

| TC | Scenario | What the test checks |
|----|----------|----------------------|
| TC-022 | Cash on Delivery | Finds the product in the list, pays on delivery with a new address; the order is `pending` / `not_required` with a seller and a 24-hour deadline, is listed in the history, and the cart is empty |
| TC-025 | Multi-seller checkout | A cart with two sellers paid on delivery gives one order per seller, each with 8% tax on its own subtotal. The split itself is an integration rule; the API leg was dropped on 2026-11-28 |
| TC-029 | Missing address fields | Empty fields are stopped by the browser, spaces show the app's messages; no payment step and no order |
| TC-500 | Stripe card field | Choosing Credit Card shows the Stripe frame with its Card number input (formerly TC-STRIPE-04) |

`TC-STRIPE-01` (successful card payment) and `TC-STRIPE-02` (declined card) were removed on 2026-11-05: they duplicated TC-024 and TC-143 and TC-146, which check more. The file they lived in, `stripe-checkout.spec.ts`, was folded into this one and deleted.

`TC-023` (saved card) and `TC-024` (new card) were removed on 2026-11-28 by the shift-left review: under `CHECKOUT_FLOW=manual_capture` they repeated TC-144 and TC-143 in `card-checkout-authorization.spec.ts`. If `legacy` is what ships, bring one of them back.

**Shared code:** `helpers/checkout-flow.ts` (orders, cart count, products), and the `CheckoutPage`, `MyOrdersPage` and `OrderDetailPage` page objects.
---

### TC-098 — `variant-checkout.spec.ts`
**Buyer checkout with a variant product, paid on delivery**

Same structure as `checkout.spec.ts` but the product has size variants. The test selects Size M before adding to cart and checks the variant line and the stock of size M.

`TC-105` (new card) and `TC-106` (saved card) were removed on 2026-11-28 by the shift-left review: a card order of a variant product is the card flow plus the variant line, and TC-143, TC-144 and TC-098 already check those.

**Shared setup:** `clearBuyerCart()`, `getBuyerToken()`, `loginSeller()` from `helpers/auth-state.ts`. Order total asserted via `fetchOrder()` from `helpers/product-assertions.ts`.

---

### TC-143, TC-144, TC-146, TC-147, TC-148, TC-400 — `card-checkout-authorization.spec.ts`
**Manual-capture card checkout (authorize now, capture on fulfilment)**

Runs only when the backend and the web app use `CHECKOUT_FLOW=manual_capture`; otherwise the whole describe is skipped.

| TC | Scenario |
|----|----------|
| TC-143 | Single seller, new card: payment is reserved and the order is pending (formerly TC-AUTH-01) |
| TC-144 | Single seller, saved card: payment is reserved and the order is pending (formerly TC-AUTH-02) |
| TC-148 | Two sellers: each payment is reserved and each seller gets its own order (formerly TC-AUTH-03) |
| TC-146 | Declined card: no order is placed and the buyer stays on review (formerly TC-AUTH-04) |
| TC-147 | 3DS challenge cancelled, then resumed from the same checkout session; also tagged TC-151 (formerly TC-AUTH-05) |
| TC-400 | An expired checkout is not resumed and its attempt is cleared (formerly TC-AUTH-06; a new scenario) |

3DS steps drive Stripe's challenge frames: `clickChallengeUntil()` clicks the Cancel or COMPLETE button until the result shows, because Stripe ignores a click made right after the button appears (the buttons are drawn before its challenge script is ready).

---

### TC-153 — `order-cancellation.spec.ts`
**A buyer cancels a pending Cash on Delivery order**

The one buyer-cancel journey on web. The test creates a product, places a Cash on Delivery order through the API (`placeCodOrderViaApi`), then the buyer cancels it from `/orders` without a reason. It checks the cancelled banner (no reason shown), the stored order (cancelled by the buyer), the detail page (no payment notice for a cash order), the stock (back to what it was), and that a second cancel request does not return the stock again. Needs no Stripe, runs under either `CHECKOUT_FLOW`. The rules underneath (who may cancel, when, the races) are backend integration tests.

---

## Structure

```
web/buyer/
├── NOTES.md                    ← this file
├── login.spec.ts               ← TC-001
├── checkout.spec.ts            ← TC-022, TC-025, TC-029, TC-500
├── variant-checkout.spec.ts    ← TC-098
├── order-cancellation.spec.ts  ← TC-153
└── card-checkout-authorization.spec.ts ← TC-143, TC-144, TC-146, TC-147 (also TC-151), TC-148, TC-400 (manual_capture only)
```

## Key notes

- Tests run under `web-buyer` project — buyer auth state is pre-loaded; no UI login needed except `login.spec.ts`.
- Cart is cleared via API before each checkout test to guarantee a clean state.
- Products are created fresh in `beforeAll` via the seller API to avoid dependency on seeded catalog. All product creation calls must include `shippingOptions` and `shippingFee` (use `randomShipping()` or `randomShippingMultipart()` from `helpers/test-data.ts`).
- Saved card tests require the buyer account to have a card on file (seeded via `npm run seed`).
- New card tab is conditionally tapped — only appears when the buyer already has saved cards.
