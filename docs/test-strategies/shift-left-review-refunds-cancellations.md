# Shift-left review: refunds and cancellations

> Produced 2026-11-28 with the `shift-left-testing` skill.
> **Scope:** the 49 scenarios linked to `REQ-REF-*` and `REQ-CAN-*` (API 23, mobile 7, web 19), from `docs/test-cases/test-scenarios-api.md`, `-mobile.md` and `-web.md`.
> **Method:** read-only. Nothing was run and no scenario, strategy or test file was edited. Playwright and Patrol tests are matched by TC tag. Backend, web and mobile unit, component and integration tests carry no TC tags, so they are matched by topic.
> **Status:** this review feeds `/test-strategy`. `docs/test-strategies/test-strategy.md` has not been changed to match it. A companion review for checkout is in `shift-left-review-checkout.md`.
> Counts of tests are as of 2026-11-28; recount before quoting them.

Layer codes: **U** unit, **CMP** component or widget, **I** integration (real MongoDB, Stripe mocked), **C** contract, **API** running backend over HTTP, **E-WEB** Playwright browser, **E-MOB** Patrol.

**The headline.** Almost none of the 49 scenarios has a higher-layer test. Only `TC-033` has a Playwright test, and Patrol's `tc-180` has a test. The opt-in `local-payment-settlement` spec covers part of the web seller accept and cancel journey. The layers below E2E are heavily covered: about 200 backend tests, about 100 web tests and about 120 mobile tests. The scenario docs promise about 40 API and E2E tests that would mostly duplicate what already exists.

Key to the "Existing test" column (all matched by topic unless marked TC):

* **Backend:** `OC-I` `orderCancellation.integration.test.ts` (15 tests), `SC-I` `sellerCancellation.integration.test.ts` (30), `OA-I` `orderAcceptance.integration.test.ts` (25), `RE-I` `refundEligibility.integration.test.ts` (28), `RR-I` `refundRequest.integration.test.ts` (25), `DR-I` `deliveredRefund.integration.test.ts` (19), `LP-I` `legacyPayments.integration.test.ts` (16), `ST-U` `sellerTransitions.test.ts` (20), `RA-U` `refundAllocation.test.ts` (27), `RS-U` `refundShipping.test.ts` (3).
* **Web:** `RRF` `RefundRequestForm.test.tsx` (16), `RRP` `RefundRequestPanel.test.tsx` (3), `OrderRefundBadge.test.tsx`, `utils/orderTabs.test.ts`, `utils/sellerAcceptance.test.ts` (25).
* **Mobile:** `M-refund` the refund form, polish and bloc tests in `test/features/refunds`, `M-seller-cancel` the cancel, dashboard-cancel and bloc tests in `test/features/seller`, `M-seller-refund` the seller refund tab and views tests, `M-tabs` `order_tabs_test.dart` and `orders_screen_tabs_test.dart`.

## 1. Layer assignment

| TC | Scenario | REQ | Current → Recommended | Rule | Why this layer / why not lower | Existing test |
|---|---|---|---|---|---|---|
| 033 | Buyer can't cancel a processing order | CAN-02 | API → **API** (keep) | Q5 | Exists and passes; the status rule itself is service logic | Playwright `api/orders.api.spec.ts` (TC). **No test** of the legacy "only pending" message |
| 204 | Accept racing cancel, one winner | CAN-03 | I → **I** | R4 | Atomic claim in MongoDB. The scenario says "Blocked", which is stale | `OC-I`, `SC-I`, `OA-I` race tests |
| 205 | Buyer cancels pending; idempotent | CAN-01, 02 | API → **I** (+1 API smoke) | Q3, R1 | Replay without a second release or restock is stored state | `OC-I` "cancel and replay without releasing or restoring twice" |
| 206 | Buyer cancel after acceptance is a conflict | CAN-02 | API → **I** | Q3 | The claim loses to acceptance | `OC-I` refuses cancellation after acceptance claimed the order. **Gap:** the buyer route's `409 cancellation_conflict` code appears only in the contract test |
| 207 | Buyer reason limited to 500 chars | CAN-01 | API → **U** | Q1, R3 | The check runs before any DB access in `cancelOrderAsBuyer` | **none** |
| 208 | Buyer can't cancel another's order | CAN-01 | API → **I** | Q3, R8 | The service checks the owner | `OC-I` denies another buyer |
| 209 | Seller cancels pending: 200 with payment operation | CAN-05 | API → **I** (+1 API smoke) | Q3, R5 | Card and COD claims with the hold release | `SC-I`; `controllers/__tests__/sellerController.test.ts` (200 with operation) |
| 210 | Seller cancel validation and ownership | CAN-05 | API → **I** | Q3 | Reason 1–1000 and the foreign seller are service rules | `SC-I`, `ST-U` (`invalid_cancel_reason`) |
| 211 | Seller cancel conflicts, unsupported shapes | CAN-05 | API → **I** | Q3 | Stored order shapes | `SC-I`, `LP-I`, `orderVisibility.integration` (`cancellation_unavailable`) |
| 212 | Seller can't cancel a shipped order | CAN-05 | API → **U** | Q1 | A table lookup | `ST-U` (`VALID_TRANSITIONS`) |
| 213 | `canSellerCancelPending` from the server | CAN-07 | API → **U** | Q1 | A pure function | `ST-U`, `SC-I` |
| 214 | Eligibility for a delivered captured card order | REF-01 | API → **I** (+1 API smoke) | Q3, R13 | Stored order and the flag; one HTTP call proves the route and flag | `RE-I` (28 tests) |
| 215 | Ineligible reasons | REF-01 | API → **I** | Q3, R3 | Each reason is a branch over stored state | `RE-I` covers each reason |
| 216 | Refund request body validation | REF-03 | API → **U** | Q1, R3 | `createRefundRules` on sample bodies | **none**: `refundValidators.test.ts` covers only the seller list rules |
| 217 | Refund request idempotency | REF-06 | API → **I** | Q3, R1 | Key and payload hash in MongoDB | `RR-I` replay, changed payload, concurrent keys |
| 218 | One unresolved request per order | REF-09 | API → **I** | Q3, R4 | A concurrency claim | `RR-I` "exactly one active request" |
| 219 | Refunds can be switched off | REF-01 | API → **I** | Q3, R13 | The flag, tested in both states below E | `RE-I`, `DR-I` ("with the flag off") |
| 220 | Amount never taken from the client | REF-03 | API → **I** | Q3 | The server computes the quote | `RR-I` quotes; `RA-U` |
| 221 | Buyer isolation on refund endpoints | REF-07 | API → **I** | Q3, R8 | The service filters by buyer | `RE-I` 404 for another buyer; `RR-I` "hides foreign buyer history" |
| 222 | Seller isolation on refund decisions | REF-05 | API → **I** | Q3, R8 | The service filters by seller | `RR-I` "foreign seller decisions" |
| 223 | Approve starts one refund; races converge | REF-06 | API + I → **I** | R4, R5 | Durable refund operation; Stripe mocked | `DR-I` "settles exactly once…", `RR-I` |
| 224 | Rejection needs an explanation | REF-05 | API → **U** (+I) | Q1 | `decideRefundRules` | **none** for the validator; `RR-I` for the service |
| 226 | Seller refund list pagination and filters | REF-05 | API → **I** | Q3 | Query over stored requests | `RR-I` pagination and groups; `refundValidators.test.ts` (list rules) |
| 180 | Buyer cancels a pending order (mobile) | CAN-01 | E-MOB → **E-MOB** (keep) | Q6, R7 | The one mobile cancel journey | Patrol `2_buyer/local_buyer_cancels_order_test.dart` (tc-180) |
| 181 | No cancel after the seller accepts (mobile) | CAN-02 | E-MOB → **CMP** | Q2, R12 | The button depends on order status | **none**: only the model test mentions it |
| 183 | Seller cancels with a required reason (mobile) | CAN-05 | E-MOB → **CMP** | Q2, R12 | A dialog and its validation | `M-seller-cancel` |
| 184 | Cancel hidden when the seller may not cancel | CAN-07 | Widget / E-MOB → **CMP** | R12 | A widget visibility rule | `M-seller-cancel` |
| 185 | Buyer requests a refund (mobile) | REF-03 | E-MOB → **CMP** | Q2, R12 | The form, stepper and submit state; Patrol keys are missing | `M-refund` (form 14, polish 14, bloc 6) |
| 186 | Seller approves or rejects (mobile) | REF-05 | E-MOB → **CMP** | Q2, R12 | Seller views and reject form | `M-seller-refund` |
| 187 | Return/Refund and Complete tabs (mobile) | REF-06 | Widget / E-MOB → **CMP** | R12 | Tab content from data | `M-tabs`, `refund_lists_scroll_test.dart` (13) |
| 032 | Buyer cancels a pending order | CAN-01, 02 | E-WEB + API → **trim** | R7 | Same journey as TC-153 | none |
| 049 | Seller cancels with a reason | CAN-05 | E-WEB → **E-WEB** (to build) | Q6, R7 | The one seller-cancel journey on web (COD, no Stripe) | none |
| 152 | Buyer cancels a pending card order, hold released | CAN-02, PAY-05 | E-WEB + API → **I** | R5 | Release is Stripe-mocked I | `OC-I` "cancels an authorized card order, releases the hold…" |
| 153 | Buyer cancels a pending COD order | CAN-02 | E-WEB + API → **E-WEB** (to build) | Q6, R7 | The one buyer-cancel journey on web | none |
| 154 | No cancel after acceptance; "Keep Order" | CAN-02, 03 | E-WEB → **CMP** (+I) | R12 | The button logic is in `OrderHistory.tsx` | **none** on web |
| 157 | Seller cancels a card order, hold released | CAN-05, PAY-05 | E-WEB + API → **I** | R5 | Release is I | `SC-I`; the real-Stripe check exists only in the opt-in `local-payment-settlement.spec.ts` |
| 158 | Seller cancel needs a valid reason | CAN-05 | E-WEB + API → **CMP** (+I) | R12 | The dialog validation | `sellerAcceptance.test.ts` (topic); `SC-I` server side |
| 159 | Seller cancels a COD order, no Stripe request | CAN-05 | E-WEB + API → **I** | R5 | The claim and no provider call | `SC-I` "cancels a COD order…, no Stripe" |
| 160 | No seller cancel from shipped or card after pending | CAN-06 | E-WEB + API → **U** (+CMP) | Q1 | `VALID_TRANSITIONS` plus the visible flag | `ST-U`, `SC-I` |
| 161 | Refund offered inside the 7-day window | REF-01 | E-WEB → **CMP** | R12 | A form listing refundable items and the deadline | `RRF` "lists only items that can still be refunded…", `RRP`; `RE-I` |
| 162 | Buyer submits a partial request | REF-03 | E-WEB + API → **I** (+CMP) | Q3 | Claim and quote | `RR-I` quotes and claims; `RRF` |
| 163 | Refund form validation | REF-03 | E-WEB + CMP → **CMP** | R12 | A client form | `RRF` (16 tests); the server rules are the U gap above |
| 164 | Seller approves, refund settles | REF-05, 06 | E-WEB + API → **E-WEB** (one opt-in journey) | R5, R7 | The one refund journey: request, approve, settle, with Stripe test mode and a seeded delivered order | `DR-I` proves settlement below |
| 165 | Seller rejects with an explanation | REF-05 | E-WEB + API → **I** (+CMP) | Q3 | Decision stored | `RR-I` |
| 166 | One active request; a second follows resolution | REF-09 | E-WEB + API → **I** | R4 | A concurrency claim | `RR-I`, `RE-I` |
| 167 | Shipping only with the last paid units | REF-08 | API + CMP → **U** | Q1 | Already holds the matrix | `RS-U`, `DR-I` |
| 168 | Refund chips and tabs reflect refund state | REF-06 | CMP / E-WEB → **CMP** | R12 | Rendering from the order's state | `OrderRefundBadge`, `orderTabs`; mobile `M-tabs` |
| 169 | Refund unavailable when not eligible | REF-01 | API + CMP → **CMP** (+I) | R12 | The notice; the reasons are I | `RRP`; `RE-I` |
| 170 | Seller Return/Refund tab and badge | REF-05 | CMP / E-WEB → **CMP** | R12 | Grouping and counts are I | `RR-I` "groups… with a count for each"; mobile `seller_dashboard_refund_tab_test.dart`; **none on web** |

## 2. Overlap analysis

| Requirement | Layers where it appears | Verdict | Action |
|---|---|---|---|
| REQ-CAN-01/02 buyer cancel | I (`OC-I`), API (TC-033, 205–208), E-WEB (032, 153, 154), E-MOB (180, 181) | ⚠️ | Keep I; one API smoke; one E per platform (TC-153, TC-180) |
| REQ-CAN-05 seller cancel | I (`SC-I`, 30 tests), API (209–212), E-WEB (049, 157–160), E-MOB (183, 184) | ⚠️ | Keep I and U; one E-WEB (TC-049); the rest CMP |
| REQ-CAN-03 races | I (3 files), API (204) | ✅ | Keep I only |
| REQ-REF-01 eligibility | I (`RE-I`), API (214, 215, 219), CMP (`RRF`, `RRP`), E-WEB (161, 169) | ⚠️ | I owns the matrix; one API smoke; CMP for the form |
| REQ-REF-06/08/09 request, shipping, one active | I, U (`RS-U`), API, E-WEB | ⚠️ | I and U own them; no API or E copies |
| REQ-REF-05/06 approve and settle | I (`DR-I`), E-WEB (164), API (223) | ✅ | One E journey (opt-in); settlement stays at I |

## 3. Shift-left opportunities

* **To I, already covered, so don't write the API test:** TC-205 (matrix), 206, 208–211, 215, 217–223, 226.
* **To U:** TC-207, TC-216 and TC-224 (**gaps**), TC-212 and TC-213 (covered), TC-160 and TC-167 (covered).
* **To CMP:** TC-181 and TC-185 to 187 on mobile (no Patrol keys needed), TC-154 (**gap**), TC-158, TC-161, TC-163, TC-168 to 170.
* **Keep as the only E2E:** web TC-049 (seller cancel), TC-153 (buyer cancel), TC-164 (refund, opt-in); mobile TC-180. Everything else here has no E2E test today, so there is nothing to remove, only 40-plus tests not to build.

## 4. Gaps

* **Requirements with no scenario:**
  * REQ-CAN-04 (a cancelled order restores stock, coupon use and the hold): `OC-I` and `SC-I` cover it.
  * REQ-REF-02 (COD can't be refunded in the app): the web and mobile panel tests exist (`RefundRequestPanel.test.tsx`, `refund_cod_panel_test.dart`).
  * REQ-REF-04 (refund from the order's own allocation): `RA-U` has 27 tests.
  * Each needs a scenario linked to its existing test.
* **Scenarios with no requirement:** none in scope.
* **No test at the lowest layer:**
  * `createRefundRules` and `decideRefundRules` (U): TC-216, 224.
  * The buyer reason 500-character limit (U): TC-207.
  * The buyer cancel route's `409 cancellation_conflict` mapping and the legacy "only pending" message (I): TC-033, 206.
  * The web buyer cancel button and "Keep Order" logic in `OrderHistory.tsx` (CMP): TC-154.
  * The mobile buyer cancel button (CMP): TC-181.
  * The web seller Return/Refund tab (CMP): TC-170.

## 5. Pyramid summary

```
CURRENT (49)                      RECOMMENDED (49)
API   ████████████████████████ 24   E-WEB ███ 3
E-WEB ███████████████          15   E-MOB █ 1
E-MOB ███████                   7   API   █ 1  (+3 smokes: TC-205, 209, 214)
CMP   ██                        2   I     ███████████████████████ 23
I     █                         1   CMP   █████████████ 13
                                    U     ███████ 7        · trimmed: 1
```

The scenario docs are a steep ice-cream cone, but the code is a proper pyramid. The 3 E-WEB cases and 1 E-MOB case are the ones to keep or build, and none of the three web ones exists yet. The work here is mostly relinking the scenarios, plus six small gaps.

## 6. Open questions

1. TC-204 says "Blocked (needs controlled…)", but the race tests exist.
2. Does the opt-in `local-payment-settlement` spec count as the E2E for card cancellation and hold release? It's skipped by default.
3. Is the one refund E2E (TC-164) wanted? It needs a seeded delivered and captured order plus Stripe test mode.
4. TC-185 and TC-186 say Patrol keys are missing. With CMP coverage in place, the keys are only needed for a Patrol refund journey.
5. TC-221 and TC-222 look covered by `RR-I` and `RE-I` test titles, but they were matched by title only. Confirm before relying on them.

## 7. Hand-off for `/test-strategy`

* **I:** TC-204, 205, 206, 208–211, 214, 215, 217–223, 226, 152, 157, 159, 162, 165, 166.
* **U:** TC-207, 212, 213, 216, 224, 160, 167.
* **CMP:** TC-181, 183 to 187, 154, 158, 161, 163, 168 to 170.
* **E-WEB (to build):** TC-049, 153, and 164 (opt-in).
* **Keep:** TC-033 (API), TC-180 (E-MOB).
* **Trim:** TC-032.
* **Gaps to add:** scenarios for REQ-CAN-04, REQ-REF-02 and REQ-REF-04.

## 8. Follow-up (2026-11-28)

Tests added for three gaps in section 4. Each was run on its own; the full suites were not run.

| Gap | New test | Layer | Result |
|---|---|---|---|
| `createRefundRules` and `decideRefundRules` (REQ-REF-03, REQ-REF-05) | `backend/src/validators/__tests__/refundValidators.test.ts` | U | 55 new tests pass (64 in the file with the 9 that already existed) |
| Buyer cancel reason limit of 500 characters (REQ-CAN-01) | `backend/src/services/__tests__/orderService.cancelReason.test.ts` | U | 5 tests pass |
| Buyer cancel route: `409 cancellation_conflict`, legacy "only pending" (REQ-CAN-01, REQ-CAN-02) | `backend/src/controllers/__tests__/orderController.cancel.integration.test.ts` | I | 12 tests pass |

The seller list filters (`sellerRefundListRules`) already had tests in the same file, which are kept. The web buyer cancel button and the seller Return/Refund tab are still untested.
