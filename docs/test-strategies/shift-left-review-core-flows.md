# Shift-left review: core flows (TC-001 to TC-066)

> **Date:** 2026-11-28. **Branch:** `feat/main-shift-left-testing-11282026` at `9905764` plus the uncommitted work of that day.
> **Scope:** the 66 oldest scenarios (66 records read from `test-scenarios-web.md`, `-api.md` and `-mobile.md`): login and signup, browsing, the cart, vouchers, order history, reviews, the first seller flows and the first parity cases. Checkout (TC-022 to TC-032, TC-143 and later) and cancellations and refunds were reviewed earlier (`shift-left-review-checkout.md`, `shift-left-review-refunds-cancellations.md`); their rows here only point to those.
> **How it was done:** the requirements (`tokomart-requirements`), `requirements-trace.md`, the scenario records, the strategy rows and the existing tests were read. Existing tests were found by name and topic, never run. Web, API and Patrol tests carry `@TC-` tags and were matched by tag; backend and web unit tests were matched by topic.
> **The review itself changed nothing.** The owner then asked for it to be applied to the strategy (see section 7) and for the three questions at the end to be settled; those changes are marked below.

## The finding that shapes this review

The web app has **no DOM test environment**: no `jsdom`, no `@testing-library/react`. Web component tests here render markup with `renderToStaticMarkup`, so they can test only components that take everything as props. A page that loads data, keeps state or reacts to a click (the login form, the signup form, the cart, the wizard, the product list) cannot be tested at the component layer today. That is why 53 of these 66 scenarios sit at E2E. Two ways down, in the order I recommend:

1. **Extract the rule, then unit test it.** Most of the rules here are small pure functions inside a page or a context: the password rule, the cart quantity cap, the stale-product filter, the selected-lines filter, the stored theme, the payment and delivery labels, the wizard's step checks. This needs no new dependency, and it is what was done on 2026-11-28 for the buyer cancel button and dialog and the seller's refund decision buttons.
2. **Add `jsdom` and `@testing-library/react` as dev dependencies.** This makes forms and pages testable (login error, signup rules, wizard validation, cart actions). **Done 2026-11-28 at the owner's word** (`jsdom`, `@testing-library/react`, `/dom`, `/jest-dom`, `/user-event`). A test opts in with `// @vitest-environment jsdom` on its first line and `import '../test/dom'` (see `src/test/dom.ts`); the existing static-render tests are unaffected. `src/pages/Signup.test.tsx` is the first one. **Rows below that say CMP for a page or form are now possible.**

## 1. Layer assignment

Codes: U unit, CMP component, I integration, API system API, E-WEB browser, Manual, trim (covered elsewhere), N/A.

| TC | Scenario | REQ | Platform | Current layer | Recommended layer | Rule used | Why this layer | Why not lower | Existing test |
|---|---|---|---|---|---|---|---|---|---|
| 001 | Successful login with valid credentials | AUTH-03 | Web | E-WEB | **E-WEB** | Q6, R7 | The one login journey; smoke S1 needs it | The login endpoint is API TC-232; the form and the redirect are what only a browser shows | `login.spec.ts` (@TC-001); API TC-232 |
| 002 | Login failure with invalid credentials | AUTH-04, AUTH-11 | Web | E-WEB | **E-WEB** | Q5, R2 | One failure message on the form. The rule (the same 401 for a wrong password and an unknown email, REQ-AUTH-04) is API; TC-233 covers the wrong password only, so add the unknown-email case there | The message text on the page needs the browser; the matrix of bad credentials does not | API TC-233 (`auth.api.spec.ts`, wrong password only) |
| 003 | Successful signup as new buyer | AUTH-01 | Web | E-WEB | **E-WEB** | Q6, R7 | The one signup journey: form, terms box, logged-in navbar | Server rules are `authValidators` (U) and API TC-289; the wiring needs a browser | `authValidators.test.ts` (topic); API TC-289 |
| 004 | Signup blocked by weak password (web rules) | AUTH-10 | Web | E-WEB | **U** | Q1, R3, R12 | The web password rule is a pure function. It lived inline in `Signup.tsx` next to an unused, weaker copy; it is now the single `validatePassword` in `utils/validators.ts`, tested there (2026-11-28) | — | `validators.test.ts` (the rule) and `Signup.test.tsx` (the form), both added 2026-11-28; the rule is now one function, `validatePassword`, used by `Signup.tsx` |
| 005 | Logout clears local session | AUTH-13 | Web | E-WEB | **E-WEB** | Q6 | Logout clears the token, the user and the cart storage, then the app shows the logged-out navbar | The storage clearing is inside `AuthContext` (needs React and a DOM); a browser is the cheapest proof today | none |
| 006 | Cart restored after re-login | CART-01, CART-08 | Web | E-WEB | **API** | Q5, R6 | The cart is stored per user on the server (`GET /api/cart`); a fresh login reads it back. The merge of the local and the server cart is client logic: extract it for a unit test | The persistence needs the running server and auth | `cart.api.spec.ts` (topic) |
| 007 | Checkout redirect when unauthenticated | PAR-01 | Web | E-WEB | **trim** | R7 | A subset of TC-055 (protected routes redirect an unauthenticated visitor to login) | — | TC-055 |
| 008 | Guest can browse products without login | PAR-01, CAT-01 | Web | E-WEB | **E-WEB** | Q6 | The one guest-browse journey (web only); TC-060 is its alias | The public endpoint is also proven by any API call without a token; what the guest sees is the page | `product-catalog-visibility.spec.ts` (@TC-008) |
| 009 | Guest can view cart page | PAR-01 | Web | E-WEB | **trim** | R7 | A guest opening `/cart` is one more route of TC-055; add it as a second assertion there | — | TC-055 |
| 010 | Search products by keyword | CAT-04 | Web | E-WEB | **I** | Q3, R1, R3 | Search is a MongoDB text-index search (`$text`) in `productController.getProducts`. The matrix (case, part of a word, empty, special characters) needs the real database and its index | A unit test would have to mock the query | `productController.list.integration.test.ts` (added 2026-11-28); the browser test `product-browse.spec.ts` was removed 2026-11-28 |
| 011 | Filter products by category | CAT-03 | Web | E-WEB | **I** | Q3, R1 | The category filter is a query condition in the same controller; test it with the search | Same as TC-010 | `productController.list.integration.test.ts` (added 2026-11-28); the browser test `product-browse.spec.ts` was removed 2026-11-28 |
| 012 | Product detail shows sale price with strikethrough | PRC-08 | Web | E-WEB | **CMP** | Q2, R12 | Strikethrough price and the discounted price are one props-driven block. The discount arithmetic is U (`priceLine` in `checkoutPricing.test.ts`) | No server is involved | `ProductDetails.test.tsx` (added 2026-11-28); the browser test `product-detail.spec.ts` was removed 2026-11-28; `checkoutPricing.test.ts` (topic) |
| 013 | Select variant before add to cart | PRC-02, SEL-03 | Web | E-WEB | **trim** | R7 | The first half of TC-098 (select variant M, add to cart, check out); TC-098 checks the variant price and stock as well | — | `variant-checkout.spec.ts` (@TC-098) |
| 014 | Add to cart blocked when variant not selected | None yet | Web | E-WEB | **CMP** | Q2, R12 | The disabled add-to-cart button and its message are one component state | No server is involved | `ProductDetails.test.tsx` (added 2026-11-28); the browser test `product-detail.spec.ts` was removed 2026-11-28 |
| 015 | Seller's own products hidden from public listing | CAT-10 | Web | E-WEB | **I** | Q3, R1 | A seller does not see their own products: the server applies `excludeSellerId` in the list query. The page only passes the parameter | The filter is a database condition | **none**; TC-065 (`product-catalog-visibility.spec.ts`) says the same from the other side |
| 016 | Add, update quantity, and remove cart item | CART-01 | Web | E-WEB | **E-WEB** | Q6, R7 | The one cart journey (add, change the quantity, remove); smoke S1 lists it | The cart API is `cart.api.spec.ts`; the cart page and its totals are what the user sees | `cart.api.spec.ts` (topic) |
| 017 | Cart quantity capped at available stock | INV-07 | Web | E-WEB | **U** | Q1, R3 | The cap is `Math.min(quantity, stock)` in `CartContext`. Extract it as a pure function and test the boundary: stock − 1, stock, stock + 1, a variant stock | — | **none** |
| 018 | Per-seller delivery option selection | CART-04, PRC-05 | Web | E-WEB | **U** | Q1, R11 | The fee for a chosen delivery option is U already (`checkoutPricing.test.ts`, `shipping.test.ts`) and API TC-257. One delivery choice can be asserted inside TC-025 | — | `checkoutPricing.test.ts`, `shipping.test.ts`; API TC-257 |
| 019 | Apply valid seller voucher at cart | CPN-03, CPN-05 | Web | E-WEB | **U** | Q1, R3 | The discount amount is arithmetic (`couponDiscountFor`). It has no test (Open item in the strategy). The validation reasons are API TC-238 to TC-241 | — | **none**; TC-050 covers one apply end to end |
| 020 | Invalid voucher shows validation error | CPN-04 | Web | E-WEB+API | **API** | Q5, R2 | The reasons (expired, below the minimum, not found, used up) are the API matrix TC-238 to TC-241. The page shows the server message once: assert it inside TC-050 | The reasons need the server and the database | API TC-057 only |
| 021 | Multi-seller cart displays separate seller groups | CART-01 | Web | E-WEB | **trim** | R7 | TC-025 adds one product from each seller and checks out; the cart groups are visible in that journey | — | `checkout.spec.ts` (@TC-025) |
| 022 | Complete checkout with Cash on Delivery | ORD-02, ORD-03 | Web | E-WEB | **E-WEB** | Q6, R7 | The money path for Cash on Delivery; smoke S1 (reviewed in the checkout review) | The order shape is `orderService.cod.integration` | `checkout.spec.ts` (@TC-022) |
| 023 | Checkout with saved credit card | ORD-10, PAY-02, PAY-08 | Web | E-WEB | **trim** | R13, R7 | Done in the checkout review (removed 2026-11-28) | — | TC-144 |
| 024 | Checkout with new card entry | ORD-10, PAY-02 | Web | E-WEB | **trim** | R13, R7 | Done in the checkout review (removed 2026-11-28) | — | TC-143 |
| 025 | Multi-seller checkout creates separate orders | ORD-01 | Web | E-WEB+API | **E-WEB** | Q6, R7 | Done in the checkout review: one UI journey, the split is an integration rule | — | `checkout.spec.ts` (@TC-025) |
| 026 | Order total matches pricing formula | PRC-04 | API | API | **U** | Q1 | The total is `computeSellerTotals`; keep one API case for the stored `order.total` (checkout review) | — | `checkoutPricing.test.ts`; `orders.api.spec.ts` (@TC-026) |
| 027 | Shipping is a flat $9.99 when the seller set no shipping fee | PRC-05 | API | U | **U** | Q1, R11 | Already unit-only: the API cannot create a product without shipping settings | — | `checkoutPricing.test.ts` |
| 028 | A large order still pays the flat shipping fee | PRC-05 | API | U | **U** | Q1, R11 | Already unit-only (same reason as TC-027) | — | `checkoutPricing.test.ts` |
| 029 | Checkout blocked with missing address fields | None yet | Web | E-WEB | **E-WEB** | Q6 | The browser's own required-field check and the app's messages for spaces only exist in the browser. The server refuses a bad address too (`createOrderRules`, U) | The native `required` check cannot run without a browser | `checkout.spec.ts` (@TC-029); `orderValidators.test.ts` |
| 030 | Order history tabs filter by status | ORD-12 | Web | E-WEB | **U** | Q1 | Tab filtering is `orderTabs` (web) and `order_tabs_test.dart` (mobile) | — | `orderTabs.test.ts` (topic) |
| 031 | Confirm receipt when order shipped | FUL-06 | Web | E-WEB | **I** | Q3, R1 | `confirmOrderReceived` moves shipped to delivered with a conditional update and sets the refund deadline | It depends on stored state | `orderDelivery.integration.test.ts` (topic) |
| 032 | Buyer cancel order in pending status | CAN-01, CAN-02 | Web | E-WEB+API | **trim** | R7 | Done in the refunds review: TC-153 is the buyer-cancel journey | — | TC-153; `orderController.cancel.integration.test.ts` |
| 033 | Buyer cannot cancel processing order | CAN-02 | API | API | **I** | Q3, R8 | The route refuses a buyer cancel once the seller took the order (409, or 400 for legacy orders). Keep this API case as the single route smoke | The rule is an atomic claim | `orderController.cancel.integration.test.ts`; API TC-033 |
| 034 | Leave review after order delivered | REV-01, REV-02 | Web | E-WEB | **E-WEB** | Q6, R7 | The one review journey: the modal, the stars, the saved review. The rules (delivered only, one per product) are integration tests | The review modal is a browser flow | `reviewController.integration.test.ts` |
| 035 | Duplicate review blocked | REV-03 | API | API | **I** | Q3, R1, R4 | A unique index on buyer and product | It is a database constraint | `reviewController.integration.test.ts`; API TC-035 |
| 036 | Review blocked before delivery | REV-02 | API | API | **I** | Q3, R1 | The delivered check reads the order from the database | It depends on stored state | `reviewController.integration.test.ts`; API TC-036 |
| 037 | Follow and unfollow seller from public profile | PRO-03 | Web | E-WEB | **API** | Q5 | Follow and unfollow are routes (TC-290 holds the matrix). One P2 browser check of the profile page is enough | It needs auth and the database | API TC-290 (scenario) |
| 038 | Toggle dark mode persists across navigation | PAR-08 | Web | E-WEB | **U** | Q1, R12 | The stored theme is read and written through `ThemeContext`; extract the read and write of the stored value for a unit test. Mobile has `theme_cubit_test.dart` | — | **none** on web |
| 039 | Order card displays persisted total not raw sum | PRC-04, PRC-06, PRC-09 | Web | E-WEB | **trim** | R7 | Assert the card total against the stored `order.total` inside TC-022 (it already lists the order). The rule is TC-026 | — | `checkout.spec.ts` (@TC-022); `checkoutPricing.test.ts` |
| 040 | Loading and empty states on products page | CAT-09 | Web | E-WEB | **CMP** | Q2, R12 | Loading and empty states are one component state each | No server is involved | none |
| 041 | Become a seller (one-way promotion) | AUTH-06 | Web | E-WEB | **E-WEB** | Q6, R7 | Smoke S3 starts here: the one become-a-seller journey. The role change is `PUT /api/auth/profile` (used by the API specs) | The button and the dashboard after it need a browser | none |
| 042 | Seller creates simple product listing (web 6-step wizard) | SEL-01, SEL-06 | Web | E-WEB | **E-WEB** | Q6, R7 | Smoke S3: the one wizard journey for a simple product | The product rules are `productInput.test.ts` and API TC-304 to TC-311 | `seller-simple-product-crud.spec.ts` (@TC-042) |
| 043 | Wizard validation — missing required fields | SEL-01, SEL-06 | Web | E-WEB | **U** | Q1, R2, R12 | The wizard's step checks are client rules; the server rules are API TC-304 to TC-311. Extract the step checks into a function and test every field | — | `productInput.test.ts` (server side only) |
| 044 | Edit product price and stock | SEL-04 | Web | E-WEB | **API** | Q5, R6 | The update rules are `PUT /api/seller/products/:id` (101 tests in `seller-products.api.spec.ts`). The edit screen stays as one step of the CRUD journey | Ownership and validation need the server | `seller-products.api.spec.ts` |
| 045 | Preview simple product as buyer via My Products page | SEL-07 | Web | E-WEB | **E-WEB** | Q6 | A web-only page (`/my-products`) the buyer-preview is only visible in a browser. P2: keep it a step of the CRUD journey | No server rule is involved | `seller-simple-product-crud.spec.ts` (@TC-045) |
| 046 | Delete product from seller dashboard | SEL-04 | Web | E-WEB | **API** | Q5, R8 | Delete and its ownership check are API; the dashboard row disappearing is one step of the CRUD journey | Ownership needs the auth middleware | `seller-access.api.spec.ts` |
| 047 | Seller advances order through valid status pipeline | FUL-01 | Web | E-WEB | **E-WEB** | Q6, R7 | The one seller pipeline journey (smoke S4 E leg). The allowed moves are `VALID_TRANSITIONS` (U) and TC-048 | The status buttons and badge need a browser | `sellerTransitions.test.ts` (topic) |
| 048 | Seller invalid status transition rejected | FUL-01 | API | API | **API** | Q5 | One route smoke for an invalid move (400); the matrix is `sellerTransitions.test.ts` | The route and the role check need the server | `sellerTransitions.test.ts`; `seller-access.api.spec.ts` (@TC-048) |
| 049 | Seller cancel order with reason | CAN-05 | Web | E-WEB | **E-WEB** | Q6, R7 | Done in the refunds review: the one seller-cancel journey (built 2026-11-28) | — | `seller-cancel-order.spec.ts` (@TC-049) |
| 050 | Create and apply seller voucher end-to-end | CPN-01, CPN-03 | Web | E-WEB | **E-WEB** | Q6, R7 | The one voucher journey: the seller creates a voucher, the buyer applies it, the total changes. Add one invalid code here (TC-020) and fold TC-019 in | Two roles and two screens | `coupons.api.spec.ts` (topic) |
| 051 | Seller order detail shows formatted payment and delivery labels | None yet | Web | E-WEB | **U** | Q1 | Formatting a payment method or delivery option into its label is a pure function of the order | — | **none** |
| 052 | New order toast notification (web polling) | PAR-04 | Web | E-WEB | **Manual** | R9 | Polling timing. Extract "which orders are new since the last poll" as a pure function for a unit test; keep the toast itself manual | The toast needs real time | none |
| 053 | Buyer blocked from seller API routes | AUTH-07 | API | API | **API** | Q5, R8 | The role middleware on the seller routes | It needs the auth middleware | `seller-access.api.spec.ts`; `security.api.spec.ts` (TC-135) |
| 054 | Seller cannot edit another seller's product | SEL-04 | API | API | **API** | Q5, R8 | Ownership of a product on update and delete. **The scenario's Test File points at a web spec that only checks the dashboard lists own products** | It needs auth and the database | `seller-access.api.spec.ts` |
| 055 | Protected routes require authentication | PAR-01, AUTH-07 | Web | E-WEB | **E-WEB** | Q6, R7 | The one guard journey: protected routes (checkout, orders, profile) send an unauthenticated visitor to login; add `/cart` for a guest (TC-009) and `/checkout` (TC-007) | The redirect is a router behaviour | none |
| 056 | Insufficient stock at checkout returns 400 | INV-02 | API | API | **I** | Q3, R1, R4 | Insufficient stock is refused before anything changes, and the decrement is guarded. Keep one API case for the route | It depends on stored stock | `orderService.createOrders.integration.test.ts`; API TC-056 |
| 057 | Coupon below minimum order amount rejected | CPN-04 | API | API | **I** | Q3, R1 | `validateCoupon` reads the coupon and the order amount. Test the minimum-amount boundary with the real database (U if the rule is extracted) | A mock of the coupon model would hide the rule | **none**; API TC-057 only |
| 058 | Product description max 200 characters enforced | SEL-01 | API | API | **U** | Q1, R3 | The 200-character limit is a validator rule; test min, max and max + 1 | — | `productInput.test.ts` (topic, not checked for 200) |
| 059 | Stale product removed from cart on load (web) | CART-06 | Web | E-WEB | **U** | Q1 | The cart drops a product whose stock is 0 when it loads. Extract the filter and test it | — | **none** |
| 060 | Web guest browse — no login required for catalog | Alias of TC-008; see that case | Web | E-WEB | **N/A** | — | Alias of TC-008; counted once | — | — |
| 061 | Seller wizard has 6 steps on web and mobile | SEL-06 | Web | E-WEB | **trim** | R7 | TC-042 and TC-064 walk through every wizard step, so a step count adds nothing | — | TC-042, TC-064 |
| 062 | Wishlist not available on web | PAR-02 | Web | Manual | **Blocked** | — | Nothing to automate: a feature that is absent on web. The strategy keeps it Blocked; delete the scenario if you do not want it | — | none |
| 063 | Web cart checkboxes decide which items go to checkout | CART-05 | Web | E-WEB | **E-WEB** | Q6, R11 | One case that checking and unchecking lines changes what checkout shows. The selection logic is U after extraction; mobile TC-602 is its own client case | The page passes the selection to checkout | none |
| 064 | Seller creates product listing with variants (web) | SEL-03, SEL-06 | Web | E-WEB | **E-WEB** | Q6, R7 | Smoke S3: the one variant wizard journey | Variant rules are `productInput.test.ts` and API | `seller-product-wizard.spec.ts` (@TC-064) |
| 065 | Buyer sees new seller listing in public catalog | CAT-01, CAT-07 | Web | E-WEB | **E-WEB** | Q6, R7 | The one cross-role journey: a seller lists, a buyer finds it | Two roles; the list rule itself is TC-010 / TC-015 at I | `product-catalog-visibility.spec.ts` (@TC-065) |
| 066 | Buyer finds new listing via search and category filter | CAT-03, CAT-04 | Web | E-WEB | **I** | Q3, R11 | Search and category together are TC-010 and TC-011 at I; TC-065 is the E2E | Same as TC-010 | `product-browse.spec.ts` (topic) |

## 2. Overlap analysis

| Requirement | Layers where it appears | What each layer proves | Verdict | Action |
|---|---|---|---|---|
| REQ-PAR-01 guests and protected routes | E-WEB TC-007, TC-008, TC-009, TC-055 | Four tests of one router rule: which routes need a login | ⚠️ | Keep TC-008 (guest browse) and TC-055 (guard); fold TC-007 and TC-009 into TC-055 as extra assertions |
| REQ-CAT-03, REQ-CAT-04 search and category | E-WEB TC-010, TC-011, TC-066 | Three browser tests of one server query | ⚠️ | Move the matrix to an integration test of the list query; keep TC-065 as the only E2E |
| REQ-CART-01 the cart | E-WEB TC-006, TC-016, TC-021; API `cart.api.spec.ts` | Add, change, remove, group by seller, restore after login | ⚠️ | Keep TC-016 as the one cart journey; TC-006 is API; TC-021 is part of TC-025 |
| REQ-CPN-03, 04, 05 vouchers | E-WEB TC-019, TC-020, TC-050; API TC-057, TC-235 to TC-253 | Apply a code, a rejected code, create and apply | ⚠️ | Keep TC-050 as the one E2E (valid code and one invalid code); the discount math is a missing unit test; the reasons are API |
| REQ-AUTH-10 password rule | E-WEB TC-004; U `authValidators.test.ts` (server rule, 6 characters); U `validators.test.ts` and CMP `Signup.test.tsx` (web rule, added 2026-11-28) | A client rule and a server rule that differ on purpose (API and mobile: 6 characters; web: 8 with a mix) | ✅ after the fix | One tested client function and one form test; no E2E |
| REQ-REV-02, 03 reviews | E-WEB TC-034; API TC-035, TC-036; I `reviewController.integration.test.ts` | The same two rules at three layers | ⚠️ | Keep the integration tests and TC-034 as the one journey; the API duplicates can go or stay as one smoke |
| REQ-CAN-01, 02 buyer cancel | I `orderController.cancel.integration.test.ts`; API TC-033; E-WEB TC-153 | The 409 and the legacy 400 at the route; the journey | ✅ | Keep TC-033 as the route smoke |
| REQ-FUL-01 seller pipeline | U `sellerTransitions.test.ts`; API TC-048; E-WEB TC-047 | The allowed moves, one invalid move over HTTP, the buttons | ✅ | Keep all three |
| REQ-SEL-01, 04, 06 the seller product | E-WEB TC-042 to TC-046, TC-061, TC-064; API TC-304 to TC-311 (101 tests); U `productInput.test.ts` | Create, edit, preview, delete; server validation | ⚠️ | One CRUD journey and one wizard journey stay E2E; TC-061 is trimmed; edit and delete rules are API |
| REQ-INV-02 stock | I `createOrders.integration`; API TC-056 | The refusal and the guarded decrement | ⚠️ | Keep the API case as one route smoke |
| REQ-PRC-04 totals | U `checkoutPricing.test.ts`; API TC-026; E-WEB TC-039 | Formula, stored total, display | ⚠️ | TC-039 becomes an assertion in TC-022 |

## 3. Shift-left opportunities

**E-WEB to U (extract the rule first):** TC-004 (password rule), TC-017 (cart cap), TC-038 (stored theme), TC-043 (wizard step checks), TC-051 (labels), TC-059 (stale products), and the selection logic behind TC-063.
**E-WEB to I (real database):** TC-010, TC-011, TC-066 (the list query), TC-015 (the seller's own products), TC-031 (confirm receipt), TC-034's rules, TC-035, TC-036, TC-057.
**E-WEB to API:** TC-006, TC-037, TC-044, TC-046.
**E-WEB to CMP (a props-driven component first):** TC-012, TC-014, TC-040.
**Trim (covered by another case):** TC-007, TC-009, TC-013, TC-021, TC-039, TC-061, and TC-023, TC-024, TC-032 (already trimmed).
**Single representative cases that stay:** TC-001 (login), TC-003 (signup), TC-005 (logout), TC-008 (guest), TC-016 (cart), TC-022 (COD checkout), TC-025 (multi-seller), TC-029 (address check), TC-034 (review), TC-041 (become a seller), TC-042 and TC-064 (wizard), TC-045 (preview), TC-047 (pipeline), TC-049 (seller cancel), TC-050 (voucher), TC-055 (guards), TC-063 (cart selection), TC-065 (catalog).

## 4. Gaps

**Requirements in scope with no scenario** (from `requirements-trace.md`): none in this range. TC-014, TC-029 and TC-051 have **no requirement** ("None yet"); TC-060 is an alias.
**Rules whose lowest layer has no test:**
- login with an **unknown email** returning the same message as a wrong password (REQ-AUTH-04; TC-233 covers only the wrong password),
- ~~the web password rule~~ (closed 2026-11-28: one `validatePassword`, with unit and form tests),
- coupon math and the minimum-amount check (`couponDiscountFor`, `validateCoupon`: no unit or integration test at all),
- the product list query (search, category, own products hidden, stock filter),
- the cart rules in `CartContext` (cap, stale products, selected lines) and the cart merge after login,
- the wizard's step checks, the stored theme, the payment and delivery labels.
**Data fixes in the scenario files:** TC-054's Test File pointed at a web spec that does not test the rule (**fixed 2026-11-28**: it now names `seller-access.api.spec.ts`); TC-014, TC-029 and TC-051 still need a `REQ-*` entry or a note.

## 5. Pyramid summary

Counts are of the 66 records (TC-060 is an alias and counted as N/A).

**Current** (the scenario's Suggested Layer):
```
E-WEB      ████████████████████████████  50
E-WEB+API  ██                            3
API        ██████                        10
U          █                             2
Manual     █                             1
```
**Recommended:**
```
E-WEB      ███████████                   20
API        ████                          8
I          ██████                        10
CMP        ██                            3
U          ███████                       13
Manual     █                             1
Blocked    █                             1
trim       █████                         9
N/A        █                             1
```
Today the block is an ice-cream cone: 53 of 66 scenarios (80%) are browser tests and only 2 are unit tests. Recommended, 20 stay in the browser (30%), 9 are trimmed, and 26 move to unit, integration or component tests. The remaining browser tests are one journey per area, which is what the rules allow. Without `jsdom`, 3 component rows are only possible for props-driven blocks.

## 6. Open questions

1. ~~**Which password rule is right?**~~ **Resolved 2026-11-28** (the owner asked for the recommended option): the web rule stays as `Signup.tsx` had it, 8 characters with a lower case letter, an upper case letter and a digit (REQ-AUTH-10), now the single `validatePassword`; the unused, weaker copy is gone. The API and mobile keep 6 characters on purpose.
2. ~~**Should the web get `jsdom` and Testing Library?**~~ **Done 2026-11-28** (see the finding above).
3. ~~**TC-054's Test File**~~ **Fixed 2026-11-28.** The web spec `seller-access.spec.ts` still carries the `@TC-054` tag although it checks the dashboard list, not the rule; relabel its tag when you next touch it.
4. **TC-014, TC-029, TC-051 have no requirement.** Add `REQ-*` entries (the code supports all three) or keep them as UI-only cases.
5. **TC-052** stays Manual (a polling toast) and **TC-062** stays Blocked (an absent feature). Say if TC-062 should be deleted.

## 7. Hand-off for `/test-strategy`

Final layers to record (the recommended layer above), with these changes from the current strategy rows:
- **U:** TC-004, 017, 018, 019, 038, 043, 051, 058, 059 (and 026, 027, 028, 030, which are already there).
- **I:** TC-010, 011, 015, 031, 033, 035, 036, 056, 057, 066.
- **CMP:** TC-012, 014, 040.
- **API:** TC-006, 020, 037, 044, 046 (and 048, 053, 054, which stay).
- **E-WEB (keep):** TC-001, 002, 003, 005, 008, 016, 022, 025, 029, 034, 041, 042, 045, 047, 049, 050, 055, 063, 064, 065.
- **Trim:** TC-007, 009, 013, 021, 039, 061 (and 023, 024, 032, already trimmed).
- **Manual:** TC-052. **Blocked (unchanged):** TC-062.

**Applied to the strategy on 2026-11-28** (the owner asked for it): 34 rows changed layer in `test-strategy.md` and its four views; the rest already agreed. TC-062 stays Blocked. The scenario files are unchanged apart from TC-054's Test File. The six new trims are removed too: only TC-013 had a test, and it was removed from `product-detail.spec.ts` on 2026-11-28. **Item 45b of the strategy (the tests that move the rules down) was done the same day** (see that item for the files), and the browser tests it made redundant were removed: TC-012, TC-014 (`product-detail.spec.ts`) and TC-010, TC-011 (`product-browse.spec.ts`).
