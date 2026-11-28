# Shift-left review: checkout

> Produced 2026-11-28 with the `shift-left-testing` skill.
> **Scope:** the 37 scenarios linked to `REQ-ORD-*` (API 10, mobile 11, web 16), from `docs/test-cases/test-scenarios-api.md`, `-mobile.md` and `-web.md`.
> **Method:** read-only. Nothing was run and no scenario, strategy or test file was edited. Playwright and Patrol tests are matched by TC tag. Backend, web and mobile unit, component and integration tests carry no TC tags, so they are matched by topic and marked "(topic)".
> **Status:** this review feeds `/test-strategy`. `docs/test-strategies/test-strategy.md` has not been changed to match it.
> Counts of tests are as of 2026-11-28; recount before quoting them.

Layer codes: **U** unit, **CMP** component or widget, **I** integration (real MongoDB, Stripe mocked), **C** contract, **API** running backend over HTTP, **E-WEB** Playwright browser, **E-MOB** Patrol.

## 1. Layer assignment

REQ numbers are `REQ-ORD-nn` unless another prefix is shown.

| TC | Scenario | REQ | Plat | Current → Recommended | Rule | Why this layer | Why not lower | Existing test |
|---|---|---|---|---|---|---|---|---|
| 110 | Order list shows only own orders | 12 | API | API → **API** | Q5, R8 | Needs the JWT middleware and the real route | U or I can't prove the auth scoping | `api/order-isolation.api.spec.ts` (TC) |
| 193 | Card order via old endpoint → 426 | 04 | API | API → **API** (1 case) | Q5, R13 | Proves the guard is mounted under the env flag | The guard logic itself is already U and C | `api/stripe-webhook.api.spec.ts` (TC); U `checkoutFlowGuard.test.ts`, C `checkoutContract.test.ts` (topic) |
| 194 | Client payment intent → 426 | 04 | API | API → **U** | Q1 | Same guard on `create-intent` | (lowest) | `checkoutFlowGuard.test.ts`, `checkoutContract.test.ts` (topic) |
| 195 | Session priced from the server | 15 | API | API → **I** | Q3, R1 | Prices come from stored products inside the session transaction | Needs real DB values | `checkoutService.integration.test.ts`: "ignores client-sent totals…" (topic) |
| 196 | Session is idempotent | 05, 07 | API | API → **I** (+1 API smoke) | Q3, R1, R4 | Key and request hash live in MongoDB; concurrent keys | A mocked datastore proves nothing | Same file: replay, reused key, concurrent (3 tests); U `checkoutController.test.ts`; C (topic) |
| 197 | Session and saved card are owner-only | 06, 08 | API | API → **I** | Q3, R8 | The service owns the rule | API adds only routing | I: `checkoutSessionRead`, `checkoutAuthorization`, `checkoutFinalization` (404 for another buyer); C: 403 `saved_card_not_owned` (topic) |
| 231 | Drafts stay hidden | 11 | API | API → **I** | Q3 | Visibility over stored orders | Needs stored orders | `orderVisibility.integration.test.ts` (12 tests) (topic) |
| 255 | Invalid order body rejected | 02 | API | API → **U** | Q1, R3 | `createOrderRules` run on sample bodies | (lowest) | **none** |
| 256 | Unknown product or variant → 404, nothing changes | 03 | API | API → **I** | Q3, R1 | "Changes nothing" is stored state | U can't see stock and orders | **none** |
| 262 | COD order starts pending with acceptance fields | 03 | API | API → **I** | Q3 | Stored fields | API adds nothing | `orderService.cod.integration.test.ts` (topic) |
| 083 | Multi-seller checkout (mobile) | 01 | Mob | E-MOB → **E-MOB** | Q6, R7 | The device journey | The split itself is proven at I | patrol `multi_seller_card_checkout_test.dart` (tc-083); I `checkoutService`, `checkoutFinalization` (topic) |
| 084 | Order history tabs and detail (mobile) | 12 | Mob | E-MOB → **CMP** | Q2, R12 | A widget rendering tabs from data | (no Patrol test exists) | `order_tabs_test.dart`, `orders_screen_tabs_test.dart` (topic) |
| 095 | COD checkout (mobile) | 03 | Mob | *(blank)* → **E-MOB** | Q6, R7 | The COD money path on a device | Stored fields are I | patrol `simple_cod_checkout_test.dart` (by file; its tag has no `tc-` id) |
| 096 | Saved card checkout (mobile) | 10 | Mob | E-MOB → **E-MOB** | R7 | The saved-card path | Payload logic is U | patrol `simple_saved_credit_checkout_test.dart` (tc-096); U `checkout_session_payload_test.dart` |
| 097 | New card checkout (mobile) | 10 | Mob | E-MOB → **E-MOB** | R7 | The new-card path | Same | patrol `simple_new_credit_checkout_test.dart` (tc-097) |
| 101 | COD with variant (mobile) | 03, PRC-02 | Mob | E-MOB → **E-MOB** | R7, R11 | The one variant journey on mobile | Variant pricing is U and I | patrol `variant_cod_checkout_test.dart` (by file) |
| 103 | Variant × new card (mobile) | 10, PRC-02 | Mob | E-MOB → **trim** | R2, R11 | – | Variant is TC-101 plus I; payment is TC-097 | patrol `variant_new_credit_checkout_test.dart` (tc-103) |
| 104 | Variant × saved card (mobile) | 10, PRC-02 | Mob | E-MOB → **trim** | R2, R11 | – | Variant is TC-101 plus I; payment is TC-096 | patrol `variant_saved_credit_checkout_test.dart` (tc-104) |
| 177 | Declined card places no order (mobile) | 09 | Mob | E-MOB → **I** (+CMP for the message) | Q3, R5 | Definitive-rejection handling | Needs the stored result | I `checkoutAuthorization`: "fails the checkout on a definitive rejection…"; `payment_bloc_checkout_session_test.dart` (topic); no Patrol test |
| 178 | 3-D Secure (mobile) | 09 | Mob | Manual → **Manual** | – | The native 3DS sheet can't be automated (open item M4) | – | none |
| 189 | Interrupted checkout resumes (mobile) | 07, 08 | Mob | Manual → **I** | Q3 | Server idempotency, no second intent | – | I "returns the same session for a replayed key", "does not create a second intent…" (topic) |
| 022 | COD checkout (web) | 02, 03 | Web | E-WEB → **E-WEB** | Q6, R7 | The COD money journey | Stored fields are I | `web/buyer/checkout.spec.ts` (@TC-022) |
| 023 | Saved card checkout (web) | 10, PAY-02, PAY-08 | Web | E-WEB → **trim** | R13, R7 | – | Under `manual_capture` it repeats TC-144 | same file (@TC-023) |
| 024 | New card checkout (web) | 10, PAY-02 | Web | E-WEB → **trim** | R13, R7 | – | Under `manual_capture` it repeats TC-143 | same file (@TC-024) |
| 025 | Multi-seller checkout (E and API legs) | 01 | Web | E-WEB + API → **E-WEB** (drop the API leg) | R7, R1 | One UI proof of two orders | The split is I | `checkout.spec.ts` (@TC-025), `api/orders.api.spec.ts` (@TC-025); I `orderService.cod.integration`, `checkoutFinalization` (topic) |
| 030 | History tabs filter by status | 12 | Web | E-WEB → **U** | Q1 | Tab filter is pure logic | (lowest) | `utils/orderTabs.test.ts` (refund-tab rules only); no Playwright test |
| 098 | COD with variant (web) | 03, PRC-02 | Web | E-WEB → **E-WEB** | R7, R11 | The one variant journey on web | Stored variant data is I | `variant-checkout.spec.ts` (@TC-098) |
| 105 | Variant × new card (web) | PRC-02, 10 | Web | E-WEB → **trim** | R2, R11 | – | Variant is TC-098 plus I; payment is TC-143 | same file (@TC-105) |
| 106 | Variant × saved card (web) | PRC-02, 10 | Web | E-WEB → **trim** | R2, R11 | – | Variant is TC-098 plus I; payment is TC-144 | same file (@TC-106) |
| 112 | Buyer 2 sees only own orders (UI) | 12, AUTH-08 | Web | E-WEB → **API (TC-110)** | R6, R8 | The browser adds nothing | – | `web/mixed/order-isolation.spec.ts` (@TC-112) |
| 143 | New card reserves, no charge | PAY-02, 10 | Web | E-WEB → **E-WEB** | R5, R7 | The one real-Stripe card journey | The authorisation logic is I | `card-checkout-authorization.spec.ts` (@TC-143) |
| 144 | Saved card reserves | PAY-02, 10 | Web | E-WEB → **E-WEB** | R7 | The saved-card journey | – | same file (@TC-144) |
| 146 | Declined card, no order (E and API legs) | 09 | Web | E-WEB + API → **E-WEB** (drop the API leg) | R7 | The main failure the buyer feels | The rule is I | same file (@TC-146) |
| 147 | 3-D Secure completes after authentication | 09 | Web | E-WEB → **E-WEB** | Q6 | A real Stripe challenge in a browser | Outcome mapping is already U | same file (@TC-147); U `stripeAuthorization.test.ts` (7 tests) |
| 148 | Multi-seller card holds each amount | 01, 09 | Web | E-WEB + API → **E-WEB** (drop the API leg) | R7 | One multi-seller card journey | The split is I | same file (@TC-148) |
| 151 | Interrupted checkout resumes | 07, 08 | Web | Manual + API → **I** (+U) | Q3 | Idempotent resume | – | U `checkoutAttempt.test.ts`; I (topic). Already exercised inside the TC-147 test, which carries both tags, so the "Manual" label is stale |
| 400 | Expired checkout not resumed, attempt cleared | 08 | Web | E-WEB → **U** (+I) | Q1 | Stored attempt cleanup | (lowest) | U `checkoutAttempt.test.ts`; I "refuses to place an expired session…"; a separate Playwright test @TC-400 exists |

## 2. Overlap analysis

| Requirement | Layers where it appears | Verdict | Action |
|---|---|---|---|
| REQ-ORD-10 placing orders | I (`checkoutFinalization`), E-WEB (TC-023, 024, 143, 144, 105, 106), E-MOB (TC-096, 097, 103, 104) | ⚠️ | Keep one E case per payment path (new, saved) per platform. Trim the variant × payment copies |
| REQ-ORD-03 COD order fields | I (`orderService.cod.integration`), API (TC-262, unmapped), E-WEB (TC-022, 098), E-MOB (095, 101) | ⚠️ | I owns the fields. E keeps the journey. Don't write TC-262 as an API test |
| REQ-ORD-07 idempotency | I (3 tests), U (controller), C, API (TC-196, unmapped), E (TC-151) | ✅ | Keep I; build only one API smoke |
| REQ-ORD-09 authorisation outcomes | I (`checkoutAuthorization`), U (`stripeAuthorization`), E-WEB (146, 147, 148), E-MOB (177, 178) | ✅ | Keep E-WEB 146 and 147 only; mobile via I and widget tests |
| REQ-ORD-04 the 426 guard | U (6 tests), C, API (TC-193, 194) | ⚠️ | One API case; fold TC-194 into it or drop it |
| REQ-ORD-12 own orders | API (TC-110), E-WEB (TC-112), U and CMP tabs | ⚠️ | Drop TC-112 |
| REQ-ORD-01 one order per seller | I, E-WEB (TC-025, 148), E-MOB (083), API leg of TC-025 | ⚠️ | Drop the API leg |
| REQ-ORD-11, 15 drafts hidden, server prices | I only (API TC-231 and TC-195 are unmapped) | ❌ | Don't build API versions |

## 3. Shift-left opportunities

* **Already covered at I; don't build API tests:** TC-195, 197, 231, 262, and the matrix of TC-196.
* **Move to U:** TC-255 (no test yet), TC-194 (covered), TC-030, TC-400.
* **Move to I:** TC-256 (no test yet), TC-177, TC-189, TC-151.
* **Move to CMP:** TC-084 (E-MOB with no Patrol test).
* **Trim, covered by another case:** TC-023, 024, 105, 106, 103, 104, 112, and the API legs of TC-025, 146 and 148.
* **Single representatives to keep:**
  * Web: TC-022, 143, 144, 146, 147, 148, 025 and 098.
  * Mobile: TC-083, 095, 096, 097 and 101.

## 4. Gaps

* **Requirements with no scenario:**
  * REQ-ORD-13 (a cancelled or expired card order never leaves a charge): the release and scanner tests exist, but no scenario.
  * REQ-ORD-14 (the COD note): `CashOnDeliveryNotice.test.tsx` and `cash_on_delivery_notice_test.dart` exist (CMP), but no scenario.
* **Scenarios with no requirement:** none in scope.
* **Rules with no test at their lowest layer:**
  * Order body validation (`createOrderRules`).
  * An unknown product or variant creating nothing (TC-256).
  * REQ-ORD-12's newest-first ordering.
  * `orderService.stripe.test.ts` records that a legacy card order with no payment intent is accepted. That is Open question 14 in `tokomart-requirements`.

## 5. Pyramid summary

```
CURRENT (37 scenarios)            RECOMMENDED (37 scenarios)
E-WEB ███████████████ 15          E-WEB ████████ 8
E-MOB █████████        9          E-MOB █████ 5
API   ██████████      10          API   ██ 2
(none at U, CMP or I)             I     █████████ 9
Manual ███             3          CMP   █ 1
                                  U     ████ 4
                                  Manual █ 1   · trimmed as covered elsewhere: 7
```

The scenario docs are an ice-cream cone, but the code isn't. This area already has about 46 backend integration tests, 16 contract tests and about 30 unit tests (backend and web) that the scenarios don't mention. The fix is mostly relinking the scenarios, plus about three real gaps (TC-255, TC-256 and the REQ-ORD-12 ordering).

The full Playwright suite ran in about 2 minutes on 2026-11-28, so trimming saves maintenance more than time. If breadth matters for the showcase, keep the trim candidates.

## 6. Open questions

1. TC-095 has no `Suggested Layer`; it was treated as E-MOB.
2. The Patrol COD tests carry no `tc-` tag (`checkout-cod`, `checkout-variant-cod`), so they match only by `Test File`.
3. TC-151 is marked Manual, but its test exists inside the TC-147 test.
4. **Reference flow:** TC-023 and TC-024 are the only card journeys that don't depend on `manual_capture`. If `legacy` is what ships, keep one of them (this is Open question 7 in `tokomart-requirements`).
5. `test-strategy.md` assigns TC-197 and TC-262 to API; this review recommends I, since the I tests exist.

## 7. Hand-off for `/test-strategy`

* **Final layers:**
  * Multi (I + one API smoke): TC-196
  * I: TC-195, 197, 231, 256, 262, 177, 189, 151
  * U: TC-255, 194, 400, 030
  * CMP: TC-084
* **Contested decisions:** TC-197 and TC-262 (the strategy says API), TC-023 and TC-024 (the strategy says they overlap on purpose), and the trims.
* **Gaps to add:** scenarios for REQ-ORD-13 and REQ-ORD-14.

## 8. Follow-up (2026-11-28): gaps filled

Tests added for the "no test at the lowest layer" items in section 4. All were run on their own; the full suites were not run.

| Gap | New test | Layer | Result |
|---|---|---|---|
| TC-255 order body validation | `backend/src/validators/__tests__/orderValidators.test.ts` | U | 15 tests pass |
| REQ-AUTH-02 auth validators | `backend/src/validators/__tests__/authValidators.test.ts` | U | 22 tests pass |
| TC-256 unknown product or variant, nothing changes (and the stock refusals, REQ-INV-02) | `backend/src/services/__tests__/orderService.createOrders.integration.test.ts` | I | 6 pass, 1 expected failure (below) |
| REQ-ORD-12 newest first, own orders only, no drafts | `backend/src/services/__tests__/orderService.history.integration.test.ts` | I | 4 tests pass |
| REQ-REV-03, 04, 08 reviews | `backend/src/controllers/__tests__/reviewController.integration.test.ts` | I | 5 tests pass |

**A defect was found.** `createOrders` takes the stock and the coupon use before `Order.create`, outside a transaction. When the order then fails, the stock stays taken. `POST /api/orders` can trigger it, because `createOrderRules` accepts `shippingAddress: {}`. The test is marked `it.fails` as a known defect, so the suite stays green and the test flips to a failure when the defect is fixed. See Open questions 18 and 19 in `tokomart-requirements`.
