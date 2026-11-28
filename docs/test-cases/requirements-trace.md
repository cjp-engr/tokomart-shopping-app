# Requirements trace: TokoMart requirements to test cases

> Written 2026-11-28 from `.claude/skills/tokomart-requirements/SKILL.md` (the `REQ-*` IDs) and the scenario files in this folder.
> The requirements were written from the code on that date. The test cases were last reviewed 2026-10-24 by reading the code, and none of them was run for this trace.
> Where a test case and the code disagree, the code wins (see "Differences between the test cases and the code").
> This file maps by subject. It does not say a test exists or passes: `Automation status` in the scenario files is still "Needs review" for almost every case.
> Every scenario record also carries a `Requirement(s)` line with the same links (added 2026-11-28). If the two ever disagree, fix both.

## Summary

| | Count |
|---|---|
| Requirements | 143 |
| Requirements with at least one test case | 119 |
| Requirements with no test case | 24 |
| Test case records | 348 (346 active, 2 aliases) |
| Active test cases mapped to at least one requirement | 321 |
| Active test cases with no requirement yet | 25 |

Aliases are not mapped: TC-060 is an alias of TC-008, and TC-613 is an alias of TC-102.

## Requirement to test cases


### 1. Authentication & authorisation

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-AUTH-01 | A visitor signs up with email, password, first name and last name. | TC-003, TC-289 |
| REQ-AUTH-02 | Signup and login input is validated by the API. | TC-136, TC-289 |
| REQ-AUTH-03 | A registered user logs in with email and password. | TC-001, TC-067, TC-232 |
| REQ-AUTH-04 | Login must not reveal which accounts exist. | TC-002, TC-233, TC-612 |
| REQ-AUTH-05 | Tokens are JWTs that expire (7 days unless `JWT_EXPIRES_IN` says otherwise). | TC-132, TC-133, TC-254, TC-272, TC-286, TC-287 |
| REQ-AUTH-06 | Roles are `buyer` (default) and `seller`. There is no admin. A buyer becomes a seller with `PUT… | TC-041, TC-089 |
| REQ-AUTH-07 | Seller-only routes need a seller account. | TC-053, TC-055, TC-135, TC-288, TC-611 |
| REQ-AUTH-08 | A buyer can only read their own orders. | TC-110, TC-111, TC-112, TC-134 |
| REQ-AUTH-09 | Profile updates are validated. | **none** |
| REQ-AUTH-10 | The web signup form is stricter than the API. | TC-004 |
| REQ-AUTH-11 | A failed login shows one message that does not say whether the email or the password was wrong. | TC-002, TC-612 |
| REQ-AUTH-12 | A logged-in user reads their own profile with `GET /api/auth/me`. | TC-234 |
| REQ-AUTH-13 | Logging out clears the stored session on the device. | TC-005, TC-071 |

### 2. Product catalog & search

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-CAT-01 | Anyone can list products without logging in. | TC-008, TC-065, TC-072, TC-608 |
| REQ-CAT-02 | Categories are `Electronics`, `Clothing`, `Home & Garden`, `Books`, `Sports & Outdoors`. | **none** |
| REQ-CAT-03 | Filters: `category`, `minPrice`, `maxPrice` (both inclusive), `rating` (minimum), `minReviews`,… | TC-011, TC-066, TC-075 |
| REQ-CAT-04 | `search` matches product name and description text. | TC-010, TC-066, TC-074 |
| REQ-CAT-05 | Sorting: `price-asc`, `price-desc`, `rating` (high to low), `name`, `newest`. | **none** |
| REQ-CAT-06 | Pagination: `page` (default 1) and `limit` (default 20). | **none** |
| REQ-CAT-07 | Out-of-stock products are left out of the public list. | TC-065 |
| REQ-CAT-08 | Product details show seller name and avatar, price, discount, variants and shipping settings. | **none** |
| REQ-CAT-09 | A search with no matches is not an error. | TC-040 |
| REQ-CAT-10 | A seller does not see their own products in the buyer catalog. | TC-015, TC-610 |

### 3. Pricing & discounts

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-PRC-01 | A product has a price of 0 or more and an optional discount of 0 to 100 %. A variant has its own… | TC-306 |
| REQ-PRC-02 | A line uses the **variant's** price and discount when a variant is chosen, otherwise the product's. | TC-013, TC-076, TC-098, TC-101, TC-103, TC-104, TC-105, TC-106, TC-258 |
| REQ-PRC-03 | Line gross = unit price × quantity; line discount = gross × discount % ÷ 100. | **none** |
| REQ-PRC-04 | Each seller's order is priced in this order: subtotal − product discounts = effective subtotal; −… | TC-026, TC-039 |
| REQ-PRC-05 | Shipping is per seller. `free` → 0. `buyer_pays` → the fee set for the buyer's chosen delivery option… | TC-018, TC-027, TC-028, TC-081, TC-257, TC-263, TC-301, TC-302 |
| REQ-PRC-06 | Placed orders keep the name, unit price, discount and variant of each line as they were at placement. | TC-039 |
| REQ-PRC-07 | Card amounts are rounded once, to the nearest cent, when converted to Stripe's smallest unit. | **none** |
| REQ-PRC-08 | A discounted product shows the original price struck through next to the discounted price. | TC-012, TC-609 |
| REQ-PRC-09 | Order cards and order details show the order's stored `total`, not a total recalculated from its lines. | TC-039 |

### 4. Stock

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-INV-01 | Stock is a whole number of 0 or more, on the product and on each variant. | **none** |
| REQ-INV-02 | A cash-on-delivery order checks stock when it is placed. | TC-056, TC-099, TC-260 |
| REQ-INV-03 | A card checkout reserves stock for every item when the session is created (`manual_capture`). | TC-099, TC-198 |
| REQ-INV-04 | A checkout session reserves all items for all sellers or none. | TC-198 |
| REQ-INV-05 | A card checkout session never oversells under concurrency. | **none** |
| REQ-INV-06 | Stock comes back, once only, when an order is cancelled or a checkout is abandoned, expires or fails. | TC-260, TC-312 |
| REQ-INV-07 | The web cart never holds more of an item than its stock. | TC-017, TC-614 |

### 5. Cart

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-CART-01 | A logged-in buyer has one server-side cart. `GET /api/cart` returns it grouped by seller; `PUT… | TC-006, TC-016, TC-021, TC-077, TC-100, TC-107, TC-108, TC-109, TC-607 |
| REQ-CART-02 | Syncing the cart drops lines with a quantity of 0 or less and groups the rest by the product's seller. | **none** |
| REQ-CART-03 | A cart line has a quantity of at least 1. | **none** |
| REQ-CART-04 | The buyer chooses a delivery option and a coupon per seller before checkout. | TC-018, TC-081, TC-082 |
| REQ-CART-05 | Each cart line has a checkbox, on web and on mobile; only the checked lines go to checkout. | TC-063, TC-078, TC-079, TC-080, TC-602 |
| REQ-CART-06 | Web: cart lines whose product is out of stock are removed when the cart is refreshed. | TC-059 |
| REQ-CART-07 | Ordered lines leave the server cart and the other lines stay. | TC-261 |
| REQ-CART-08 | After login or signup the cart is loaded from the server. | TC-006, TC-607 |
| REQ-CART-09 | Logging out clears the local cart only; the server cart stays. | **none** |

### 6. Coupons

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-CPN-01 | A seller creates a coupon with a code, a type (`percentage` or `fixed`), a value and optionally a… | TC-050, TC-093, TC-246, TC-247, TC-253 |
| REQ-CPN-02 | A seller lists, edits and deletes only their own coupons. | TC-093, TC-248, TC-249, TC-250 |
| REQ-CPN-03 | A buyer validates a code for a seller with `POST /api/coupons/validate` (`code`, `sellerId`,… | TC-019, TC-050, TC-082, TC-093, TC-235, TC-242, TC-243, TC-245 |
| REQ-CPN-04 | Rejection reasons are checked **in this order**: unknown → `404 Invalid voucher code`; inactive →… | TC-020, TC-057, TC-238, TC-239, TC-240, TC-241, TC-244 |
| REQ-CPN-05 | Percentage discount = amount × value ÷ 100, capped at the maximum discount when one is set. Fixed… | TC-019, TC-235, TC-236, TC-237 |
| REQ-CPN-06 | Validating a coupon shows the discount but does not use it up. | **none** |
| REQ-CPN-07 | A buyer lists the usable coupons of a seller with `GET /api/coupons?sellerId=…[&orderAmount=…]`. | TC-251 |
| REQ-CPN-08 | A coupon is used up by a placed order, never by validation. | TC-252, TC-259 |
| REQ-CPN-09 | In a card checkout session the coupon use is reserved atomically with the stock. | **none** |
| REQ-CPN-10 | A cancelled order gives its coupon use back, once only. | TC-312 |

### 7. Checkout & orders

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-ORD-01 | Checkout makes **one order per seller** in the cart; coupon, delivery option, message, shipping, tax… | TC-025, TC-083, TC-148 |
| REQ-ORD-02 | Cash on delivery uses `POST /api/orders`. It needs at least one item (product id, whole quantity of 1… | TC-022, TC-255 |
| REQ-ORD-03 | A cash-on-delivery order is created `pending` with payment status `not_required`, no Stripe call, a… | TC-022, TC-095, TC-098, TC-101, TC-256, TC-262 |
| REQ-ORD-04 | With `CHECKOUT_FLOW=manual_capture`, card orders must use checkout sessions. | TC-193, TC-194 |
| REQ-ORD-05 | `POST /api/checkout/sessions` needs an `Idempotency-Key` header of 8 to 128 characters. | TC-196 |
| REQ-ORD-06 | The session request is validated. | TC-197 |
| REQ-ORD-07 | The same key with the same request never creates a second session. | TC-151, TC-189, TC-196 |
| REQ-ORD-08 | A session holds the reservation for 15 minutes. | TC-151, TC-189, TC-197, TC-400 |
| REQ-ORD-09 | Each seller's amount is authorised separately. | TC-146, TC-147, TC-148, TC-177, TC-178 |
| REQ-ORD-10 | `POST /api/checkout/sessions/:id/confirm` places all the orders in one transaction, only when every… | TC-023, TC-024, TC-096, TC-097, TC-103, TC-104, TC-105, TC-106, TC-143, TC-144 |
| REQ-ORD-11 | Unfinished checkouts are invisible. | TC-231 |
| REQ-ORD-12 | Order history lists the buyer's own orders, newest first. | TC-030, TC-084, TC-110, TC-112 |
| REQ-ORD-13 | A card order that was cancelled or expired never leaves a charge. | TC-316 |
| REQ-ORD-14 | Checkout shows a note under Cash on Delivery: inspect the items before accepting and paying. | TC-501, TC-502 |
| REQ-ORD-15 | Prices always come from the server. | TC-195 |

### 8. Payments

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-PAY-01 | Stripe is used in test mode only. | **none** |
| REQ-PAY-02 | A card is **authorised** (money held) at checkout and **charged** only when the seller accepts. | TC-023, TC-024, TC-143, TC-144, TC-145, TC-149, TC-150, TC-155, TC-176, TC-179, TC-182, TC-199 |
| REQ-PAY-03 | The seller must accept within 24 hours of placing. | TC-156, TC-200, TC-201, TC-202 |
| REQ-PAY-04 | An order the seller did not accept by its deadline is cancelled by the system. | TC-203, TC-316, TC-401 |
| REQ-PAY-05 | A cancelled or expired card order releases its hold. | TC-152, TC-157, TC-316 |
| REQ-PAY-06 | Captures, releases and refunds are durable operations with stable idempotency keys. | **none** |
| REQ-PAY-07 | Stripe webhooks need a valid signature and are processed from an inbox. | TC-229, TC-230 |
| REQ-PAY-08 | Saved cards: add, list, delete and set a default. | TC-023, TC-142 |
| REQ-PAY-09 | With `CHECKOUT_FLOW=legacy`, a card order is placed with a succeeded payment intent. | TC-295, TC-296 |
| REQ-PAY-10 | Seller or buyer cancelling a legacy card order refunds the card. | **none** |

### 9. Seller fulfilment & order lifecycle

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-FUL-01 | Order status moves `pending` → `preparing` → `processing` → `shipped` → `delivered`, or to… | TC-047, TC-048, TC-092, TC-160, TC-212 |
| REQ-FUL-02 | A seller sees the orders that contain their products, showing only their own lines. | TC-134 |
| REQ-FUL-03 | A seller changes only orders of their own. | **none** |
| REQ-FUL-04 | `pending` → `preparing` is the seller's acceptance. | TC-155, TC-182 |
| REQ-FUL-05 | `shipped` records the shipping time. `delivered` records the delivery time and ends the buyer's… | TC-227 |
| REQ-FUL-06 | The buyer confirms receipt with `PUT /api/orders/:id/confirm-received`. | TC-031, TC-085 |
| REQ-FUL-07 | A shipped order the buyer never confirms counts as delivered 48 hours after it shipped. | **none** |

### 10. Cancellations

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-CAN-01 | A buyer cancels an order with `PUT /api/orders/:id/status` (cancellation is its only use) and an… | TC-032, TC-180, TC-205, TC-207, TC-208 |
| REQ-CAN-02 | A buyer can cancel only while the order is still waiting for the seller. | TC-032, TC-033, TC-152, TC-153, TC-154, TC-181, TC-205, TC-206 |
| REQ-CAN-03 | Exactly one of: seller accepts, buyer cancels, seller cancels, deadline expires. | TC-154, TC-204 |
| REQ-CAN-04 | A cancelled order puts back stock, sold count and coupon use, and releases the card hold. | TC-312 |
| REQ-CAN-05 | A seller cancels a pending order with a reason of 1 to 1000 characters. | TC-049, TC-157, TC-158, TC-159, TC-183, TC-209, TC-210, TC-211, TC-212 |
| REQ-CAN-06 | A seller cannot cancel a card order after acceptance. | TC-160 |
| REQ-CAN-07 | The cancel buttons only appear where cancelling is possible. | TC-184, TC-213 |

### 11. Delivered-item refunds

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-REF-01 | `GET /api/orders/:id/refund-eligibility` says whether a delivered order can be refunded and why not. | TC-161, TC-169, TC-214, TC-215, TC-219, TC-313 |
| REQ-REF-02 | Cash-on-delivery orders cannot be refunded in the app. | TC-313, TC-503, TC-504 |
| REQ-REF-03 | A refund request lists the items (1 to 1000, each a line id and a positive whole quantity), a reason… | TC-162, TC-163, TC-185, TC-216, TC-220, TC-314 |
| REQ-REF-04 | The refund for chosen units comes from the order's own allocation of price, discount and tax. | TC-314, TC-315 |
| REQ-REF-08 | Shipping is refunded only with the last paid units, and only for a seller-fault reason. | TC-167 |
| REQ-REF-09 | An order can have only one unresolved refund request. | TC-166, TC-218 |
| REQ-REF-05 | A seller decides each request: approve, or reject with a reason of 1 to 1000 characters. | TC-164, TC-165, TC-170, TC-186, TC-222, TC-224, TC-226 |
| REQ-REF-06 | A request moves `requested` → `rejected`, or `requested` → `processing` → `refunded` or `needs_review`. | TC-164, TC-168, TC-187, TC-217, TC-223, TC-315 |
| REQ-REF-07 | A buyer sees their own requests for an order and their completed requests. | TC-221 |

### 12. Reviews

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-REV-01 | A buyer reviews a product with product id, order id, rating and comment. | TC-034, TC-273, TC-274 |
| REQ-REV-02 | Only for a product in the buyer's own **delivered** order. | TC-034, TC-036, TC-275 |
| REQ-REV-03 | One review per buyer per product. | TC-035 |
| REQ-REV-04 | A product's rating and review count follow its reviews. | TC-277 |
| REQ-REV-05 | A buyer edits their own review (rating, comment or both). | TC-278, TC-279 |
| REQ-REV-06 | Anyone can read a product's reviews; a buyer can check whether they already reviewed it. | TC-280, TC-281, TC-282 |
| REQ-REV-07 | Reviews cannot be deleted. | TC-284 |
| REQ-REV-08 | Two simultaneous reviews by one buyer for one product create only one. | TC-283 |

### 13. Seller tools

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-SEL-01 | A seller creates a product with `POST /api/seller/products` (the route both apps use) with name,… | TC-042, TC-043, TC-058, TC-304, TC-305, TC-306, TC-307, TC-311 |
| REQ-SEL-02 | Every product has valid shipping settings: at least one option from `standard`, `express`, `pickup`;… | TC-303 |
| REQ-SEL-03 | A product may have variants. | TC-013, TC-064, TC-091, TC-120, TC-619 |
| REQ-SEL-04 | Only a product's owner can change or delete it (`PUT` and `DELETE /api/seller/products/:id`). | TC-044, TC-046, TC-054, TC-120, TC-285, TC-308, TC-616, TC-617, TC-619, TC-620 |
| REQ-SEL-05 | Multipart product data is checked. | TC-309, TC-310 |
| REQ-SEL-06 | The product wizard has six steps on web and on mobile: Basic Info, Pricing, Description, Images,… | TC-042, TC-043, TC-061, TC-064, TC-090, TC-091, TC-601 |
| REQ-SEL-07 | A seller can preview their own product as a buyer would see it. | TC-045, TC-094, TC-121 |
| REQ-SEL-08 | Product, variant and avatar images are uploaded to Cloudinary. | **none** |

### 14. Profile, addresses & social

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-PRO-01 | A buyer saves addresses, with one default. | TC-137, TC-138, TC-139, TC-140, TC-141, TC-172, TC-173, TC-174, TC-190, TC-191, TC-192 |
| REQ-PRO-02 | A buyer saves cards (type `credit-card`, `debit-card` or `paypal`; last four digits; expiry) and sets… | TC-142, TC-175, TC-192 |
| REQ-PRO-03 | A user follows and unfollows other users. | TC-037, TC-088, TC-113, TC-290, TC-291 |
| REQ-PRO-04 | A logged-in user searches users and sees followers and following. | TC-292, TC-293, TC-294 |

### 15. Platform parity

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-PAR-01 | Guest browsing: on web, products, product details and the cart are open to guests; profile, checkout,… | TC-007, TC-008, TC-009, TC-055, TC-068, TC-069, TC-600, TC-611 |
| REQ-PAR-02 | Wishlist exists on mobile only, and only in memory. | TC-062, TC-086, TC-087, TC-603 |
| REQ-PAR-03 | Signup password rule: web needs 8 or more characters with upper case, lower case and a digit. Mobile… | TC-070, TC-606 |
| REQ-PAR-04 | Sellers are alerted to new orders. Mobile shows a local "New Orders" notification, found by checking… | TC-052, TC-605 |
| REQ-PAR-05 | Mobile starts in dark mode. The buyer can switch in Profile. | **none** |
| REQ-PAR-06 | Cash on Delivery is chosen as its own option next to Saved Card and New Card, on web and mobile. | **none** |
| REQ-PAR-07 | Both apps show an offline banner when the connection is lost. | TC-171, TC-188 |
| REQ-PAR-08 | The web app has a dark mode toggle whose choice is remembered. | TC-038 |

### 16. Non-functional

| Requirement | What it says | Test cases |
|---|---|---|
| REQ-NFR-01 | Errors have one of two shapes. Most routes: `{ success: false, message, code? }`, with `stack` only… | TC-297 |
| REQ-NFR-02 | An unknown route returns `404 Not Found — <url>`. | TC-299 |
| REQ-NFR-03 | Rate limits per minute: 10 on `/api/auth` (one shared bucket for every auth route, including profile,… | TC-114, TC-115, TC-116, TC-117, TC-118, TC-119, TC-264, TC-265, TC-266, TC-267, TC-268, TC-271 |
| REQ-NFR-04 | JSON and form bodies are limited to 10 MB. | **none** |
| REQ-NFR-05 | Duplicate-key, validation and invalid-id database errors that reach the shared error handler are… | TC-308 |
| REQ-NFR-06 | `GET /health` answers without login. | TC-298, TC-300 |
| REQ-NFR-07 | The API publishes its own documentation outside production. | TC-228 |
| REQ-NFR-09 | The client address used for rate limits comes from `TRUST_PROXY_HOPS`. | TC-269, TC-270 |
| REQ-NFR-08 | Background jobs are safe to overlap or restart. | **none** |

## Requirements with no test case

These are requirements the test cases do not cover. Each one is a candidate for a new scenario.


**1. Authentication & authorisation**

- REQ-AUTH-09: Profile updates are validated.

**2. Product catalog & search**

- REQ-CAT-02: Categories are `Electronics`, `Clothing`, `Home & Garden`, `Books`, `Sports & Outdoors`.
- REQ-CAT-05: Sorting: `price-asc`, `price-desc`, `rating` (high to low), `name`, `newest`.
- REQ-CAT-06: Pagination: `page` (default 1) and `limit` (default 20).
- REQ-CAT-08: Product details show seller name and avatar, price, discount, variants and shipping settings.

**3. Pricing & discounts**

- REQ-PRC-03: Line gross = unit price × quantity; line discount = gross × discount % ÷ 100.
- REQ-PRC-07: Card amounts are rounded once, to the nearest cent, when converted to Stripe's smallest unit.

**4. Stock**

- REQ-INV-01: Stock is a whole number of 0 or more, on the product and on each variant.
- REQ-INV-05: A card checkout session never oversells under concurrency.

**5. Cart**

- REQ-CART-02: Syncing the cart drops lines with a quantity of 0 or less and groups the rest by the product's seller.
- REQ-CART-03: A cart line has a quantity of at least 1.
- REQ-CART-09: Logging out clears the local cart only; the server cart stays.

**6. Coupons**

- REQ-CPN-06: Validating a coupon shows the discount but does not use it up.
- REQ-CPN-09: In a card checkout session the coupon use is reserved atomically with the stock.

**8. Payments**

- REQ-PAY-01: Stripe is used in test mode only.
- REQ-PAY-06: Captures, releases and refunds are durable operations with stable idempotency keys.
- REQ-PAY-10: Seller or buyer cancelling a legacy card order refunds the card.

**9. Seller fulfilment & order lifecycle**

- REQ-FUL-03: A seller changes only orders of their own.
- REQ-FUL-07: A shipped order the buyer never confirms counts as delivered 48 hours after it shipped.

**13. Seller tools**

- REQ-SEL-08: Product, variant and avatar images are uploaded to Cloudinary.

**15. Platform parity**

- REQ-PAR-05: Mobile starts in dark mode. The buyer can switch in Profile.
- REQ-PAR-06: Cash on Delivery is chosen as its own option next to Saved Card and New Card, on web and mobile.

**16. Non-functional**

- REQ-NFR-04: JSON and form bodies are limited to 10 MB.
- REQ-NFR-08: Background jobs are safe to overlap or restart.

## Test cases with no requirement yet

These cases describe behaviour that has no `REQ-*` entry. Most are UI behaviour that has not been checked in the code. Each needs either a new requirement, once the code confirms it, or a decision to leave it out.

| Test case | Platform | Title | Why there is no requirement |
|---|---|---|---|
| TC-014 | Web | Add to cart blocked when variant not selected | A variant product cannot be added to the cart before a variant is chosen (UI guard; not yet checked in code). |
| TC-029 | Web | Checkout blocked with missing address fields | Required checkout address fields on web (UI validation; not yet checked in code). |
| TC-122 | Web | Seller views product list on My Products page | Seller product list on the My Products page (UI; the API call is not yet a requirement). |
| TC-123 | Web | Products page — navigate to next page loads different products | Web products page pagination behaviour (UI; not yet checked in code). |
| TC-124 | Web | Products page — category filter resets to page 1 | Web products page pagination behaviour (UI; not yet checked in code). |
| TC-125 | Web | Products page — sort change resets to page 1 | Web products page pagination behaviour (UI; not yet checked in code). |
| TC-126 | Web | Products page — count label shows total across all pages | Web products page pagination behaviour (UI; not yet checked in code). |
| TC-127 | Web | Products page — pagination hidden when results fit on one page | Web products page pagination behaviour (UI; not yet checked in code). |
| TC-128 | Web | MyProducts page — navigate to next page | Web My Products page pagination behaviour (UI; not yet checked in code). |
| TC-129 | Web | MyProducts page — category filter resets to page 1 | Web My Products page pagination behaviour (UI; not yet checked in code). |
| TC-130 | Web | MyProducts page — next button disabled on last page | Web My Products page pagination behaviour (UI; not yet checked in code). |
| TC-131 | Web | MyProducts page — pagination hidden when products fit on one page | Web My Products page pagination behaviour (UI; not yet checked in code). |
| TC-051 | Web | Seller order detail shows formatted payment and delivery labels | Seller order detail payment and delivery labels (UI text). |
| TC-500 | Web | The Stripe card field renders on the payment step | The Stripe card field renders on the payment step (UI). |
| TC-225 | API | A refund does not undo fulfillment | A refund does not undo fulfilment (the order stays delivered); not yet checked in code. |
| TC-276 | API | A seller cannot review their own product | Expected rule is not in the code: see Open question 15. |
| TC-073 | Mobile | Open cart from products screen (S2 smoke) | Opening the cart from the products screen (navigation). |
| TC-102 | Mobile | Add to cart blocked without variant — mobile guard (Patrol) | Same guard on mobile (UI; not yet checked in code). |
| TC-615 | Mobile | Seller views simple product in seller dashboard (mobile Read) | Mobile seller dashboard lists a simple product (UI read). |
| TC-618 | Mobile | Seller views variant product in dashboard (mobile Read) | Mobile seller dashboard lists a variant product (UI read). |
| TC-621 | Mobile | Initial product list loads first 20 products | Mobile seller product list loads 20 at a time and fetches more on scroll (UI; not yet checked in code). |
| TC-622 | Mobile | Scrolling to the bottom loads more products | Mobile seller product list loads 20 at a time and fetches more on scroll (UI; not yet checked in code). |
| TC-623 | Mobile | Loading spinner visible while fetching more products | Mobile seller product list loads 20 at a time and fetches more on scroll (UI; not yet checked in code). |
| TC-624 | Mobile | No further fetch when all products are loaded | Mobile seller product list loads 20 at a time and fetches more on scroll (UI; not yet checked in code). |
| TC-604 | Mobile | Notifications bell is UI stub (no-op) | Notifications bell is a stub with no behaviour. |

## Differences between the test cases and the code

| Test cases | The test case said | The code shows | Status |
|---|---|---|---|
| TC-063 (and the parity case TC-602) | The web cart has no checkbox selection; all items go to checkout. | The web cart has a checkbox per line and passes the checked lines to checkout (`Cart.tsx`, `Checkout.tsx`). Now REQ-CART-05. | Corrected 2026-11-28 in both records. |
| TC-061, TC-090, TC-091, TC-601 (and the parity lines of TC-042, TC-064, TC-616) | The mobile product wizard has 7 steps, with a separate Variants step. | It has 6: Basic Info, Pricing, Description, Images, Shipping, Review. Variants are set up inside Pricing, as on web. Now REQ-SEL-06. | Corrected 2026-11-28, also in the seller index and the test strategy files. |
| "test-scenarios.md" (master index) | There are 259 retained case IDs: Web 107 active and 1 alias, Mobile 77 active and 1 alias, API 73 active. | The three files hold 339 case records (Web 110, API 150, Mobile 79), 337 active and 2 aliases. The master's counts predate the API cases added on 2026-10-24 to 2026-10-26. | Corrected 2026-11-28. |
| TC-052 | The web new-order toast polls every 30 seconds. | The toast exists (`Layout.tsx`); the polling interval was not verified. Now REQ-PAR-04 and Open question 9. | Not a mismatch; interval still open. |

Still wrong in the automation files, which are the owner's to change (the agent rules keep them off `e2e-testing/` and `patrol_test/`):

* `e2e-testing/tests/web/seller/NOTES.md` says the web wizard has 7 steps with a Variants step.
* `frontend-mobile/patrol_test/1_seller/add_product_simple_test.dart` and `add_product_variant_test.dart` say "7-step wizard" in their header comments, and `frontend-mobile/patrol_test/1_seller/NOTES.md` repeats it.

Cases that already note a gap in the code (each raised as an Open question in the requirements skill; the code agrees with the gap):

| Test case | Gap | Open question |
|---|---|---|
| TC-245 | A malformed seller id on coupon validate probably gives `500`. | 12 |
| TC-261 | After a cash-on-delivery order the other variant of the product also leaves the cart. | 16 |
| TC-274, TC-281 | Review create, update and list answer some bad values with `500`; `limit` has no cap. | 2, 12 |
| TC-276 | A seller can review their own product. | 15 |
| TC-293 | User search uses the typed text as a regular expression. | 17 |
| TC-295 | With `CHECKOUT_FLOW=legacy`, a card order with no payment intent is created unpaid. | 14 |

## Next steps

1. Review "Requirements with no test case" and decide which need new scenarios (the `create-scenarios` skill can write them).
2. Decide, for each case under "Test cases with no requirement yet", whether to add a requirement once the code confirms it.
3. Update the three automation files listed above that still say the wizard has 7 steps.
4. When a requirement changes, update its `Requirement(s)` lines and regenerate this table.
