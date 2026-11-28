# web/mixed — Mixed-Role Web E2E Tests

Playwright tests that involve more than one user account or role switching.
All tests run under the `web-mixed` Playwright project, which has **no pre-loaded storage state** — each test manages its own auth via localStorage injection.

---

## Test Cases

### `role-switch.smoke.spec.ts`
**Smoke test — switchRole applies the correct auth state**

Infrastructure-level smoke test that verifies the `switchRole` fixture correctly swaps localStorage between buyer and seller auth states. Not a business-flow test.

| Check | Assertion |
|-------|-----------|
| After `switchRole('buyer')` | Buyer-specific nav element visible |
| After `switchRole('seller')` | Seller-specific nav element visible |

---

### TC-109 — `cart-isolation.spec.ts`
**Buyer2 sees own empty cart in UI — not buyer1's items**

`beforeAll` uses a raw API context to: login as buyer1 (seeded account), add a product to buyer1's server-side cart, then create a fresh buyer2 account via signup.

The test injects buyer2's auth into localStorage via `injectAuth()`, reloads, navigates to `/cart`, and asserts buyer1's cart item is not visible and buyer2's cart is empty.

| Step | Detail |
|------|--------|
| Setup | Buyer1 adds product to cart via API; buyer2 created via `/api/auth/signup` |
| Auth injection | `injectAuth(page, buyer2Token, buyer2UserData)` from `helpers/auth-inject.ts` |
| Navigation | `page.goto('/cart')` after reload |
| Assertions | `cart-empty` visible; `cart-item-{buyer1ProductId}` not visible |

---

### TC-164 — `refund-journey.spec.ts` (opt-in)
**A delivered card order is refunded after the seller approves**

Skipped unless `DELIVERED_REFUND_VERIFICATION=true`. It pays in Stripe test mode, so it needs a backend started with `DELIVERED_REFUNDS_ENABLED=true`, `SELLER_SEES_MANUAL_CAPTURE=true` and `CHECKOUT_FLOW=manual_capture` on a replica-set database whose name ends in `_test` (port 27018), and `DELIVERED_REFUND_DB_URI` naming that same database. `backend/scripts/seed-delivered-card-order.mjs` makes the delivered, captured order. The buyer refunds one of two units ($10.80, no shipping), the seller approves in Return/Refund, and the test waits for "Refund completed and confirmed" and a partially refunded order. It runs in two browser contexts (buyer and seller storage states).

`TC-112` (the order history page shows only the buyer's own orders) was removed on 2026-11-28 by the shift-left review: API TC-110 proves the isolation rule, and the page only lists what the API returns.

---

### TC-008, TC-065 — `product-catalog-visibility.spec.ts`
**Product catalog visibility for guest and buyer**

| TC | Test | Key steps |
|----|------|-----------|
| TC-008 | Guest can browse products without logging in | Navigate to `/products` without auth → assert product cards visible |
| TC-065 | Seller listing visible to buyer in catalog | Seller creates product via API → buyer navigates to `/products` → asserts product card is visible |

**Note:** sellers do not see their own listings in the buyer-facing catalog — the Products page filters out the current user's own products server-side via `excludeSellerId`.

---

## Structure

```
web/mixed/
├── NOTES.md                            ← this file
├── role-switch.smoke.spec.ts           ← infra smoke
├── cart-isolation.spec.ts              ← TC-109
├── refund-journey.spec.ts              ← TC-164 (opt-in)
└── product-catalog-visibility.spec.ts  ← TC-008, TC-065
```

## Key notes

- `web-mixed` project has no `storageState` — tests must manage auth themselves.
- Auth injection uses `injectAuth()` from `helpers/auth-inject.ts` (sets `shopping_app_auth_token`, `shopping_app_user_data`, clears `shopping_app_cart_data`, reloads, waits for `user-menu-btn`).
- All API setup in `beforeAll` uses `pwRequest.newContext({ baseURL: API_URL })` — never the fixture `request` (scoped to `:5173`).
- Buyer2 is always a fresh account created via `/api/auth/signup` to guarantee a clean slate (no cart, no orders).
- POM used: `cartPage` (locators for cart items), `myOrdersPage` (locators for order cards + `open()` / `expectLoaded()`).
- Product seeds in `beforeAll` must use `randomShippingMultipart()` — `shippingOptions` and `shippingFee` are required by the backend.
- The Products page (`/products`) excludes the logged-in seller's own listings via the `excludeSellerId` query param — TC-065 verifies visibility from a buyer account, not the seller's own session.
