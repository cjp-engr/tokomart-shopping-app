import { expect, type APIRequestContext, type Page } from '@playwright/test';

import type { CartPage } from '../pages/cart.page';
import type { CheckoutPage } from '../pages/checkout.page';
import type { ProductDetailPage } from '../pages/product-detail.page';
import { createSimpleProduct } from './product-factory';
import { getBuyerToken } from './auth-state';
import { API_URL } from './test-data';
import { TEST_PASSWORD } from './api-client';

// Must match the backend's CHECKOUT_FLOW for the run. Tests that need the authorization flow skip otherwise.
export const CHECKOUT_FLOW: 'legacy' | 'manual_capture' =
  process.env.CHECKOUT_FLOW === 'manual_capture' ? 'manual_capture' : 'legacy';
export const IS_MANUAL_CAPTURE = CHECKOUT_FLOW === 'manual_capture';

// Stripe test-mode cards (https://docs.stripe.com/testing). Expiry and CVC accept any future date and three digits.
export const STRIPE_TEST_CARDS = {
  success: '4242424242424242',
  declined: '4000000000000002',
  requires3ds: '4000002500003155',
} as const;

// Stripe's built-in test PaymentMethod. Attaching it to the buyer's customer gives a real saved card.
export const SAVED_TEST_PAYMENT_METHOD = 'pm_card_visa';

const SELLER_ACCOUNTS = ['s1@ex.com', 's2@ex.com'] as const;

// One login per seller and worker: every test that creates a product would otherwise log in again, and the
// backend limits logins to a few per minute.
const sellerTokens = new Map<string, string>();

async function loginAt(request: APIRequestContext, email: string): Promise<string> {
  const cached = sellerTokens.get(email);
  if (cached) return cached;
  const res = await request.post(`${API_URL}/api/auth/login`, { data: { email, password: TEST_PASSWORD } });
  if (!res.ok()) throw new Error(`Login failed for ${email}: ${res.status()}`);
  const token = (await res.json()).token as string;
  sellerTokens.set(email, token);
  return token;
}

/**
 * A fresh in-stock product from the first seeded seller, so a test does not depend on which product happens to be
 * first in the catalog or on its stock.
 */
export async function createCheckoutProduct(
  request: APIRequestContext,
  label: string,
  price = 25,
): Promise<{ id: string; name: string }> {
  const name = `E2E ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const id = await createSimpleProduct(request, await loginAt(request, SELLER_ACCOUNTS[0]), name, { price });
  return { id, name };
}

/** Saves the Stripe test card to the buyer's profile. A duplicate is not added twice. */
export async function ensureSavedStripeCard(request: APIRequestContext): Promise<void> {
  const res = await request.post(`${API_URL}/api/auth/payment-methods`, {
    headers: { Authorization: `Bearer ${getBuyerToken()}` },
    data: {
      type: 'credit-card',
      brand: 'visa',
      last4: '4242',
      cardHolder: 'Test Buyer',
      expiryMonth: '12',
      expiryYear: '2030',
      setAsDefault: true,
      stripePaymentMethodId: SAVED_TEST_PAYMENT_METHOD,
    },
  });
  if (!res.ok()) throw new Error(`Saving the test card failed: ${res.status()} ${await res.text()}`);
}

/** One simple product from each of the two seeded sellers, for a two-seller checkout. */
export async function createProductsFromTwoSellers(request: APIRequestContext): Promise<[string, string]> {
  const stamp = Date.now();
  const first = await createSimpleProduct(request, await loginAt(request, SELLER_ACCOUNTS[0]), `E2E Seller One ${stamp}`, { price: 25 });
  const second = await createSimpleProduct(request, await loginAt(request, SELLER_ACCOUNTS[1]), `E2E Seller Two ${stamp}`, { price: 35 });
  return [first, second];
}

export interface BuyerOrder {
  _id: string;
  status: string;
  paymentStatus?: string | null;
  paymentFlowVersion?: 'legacy' | 'manual_capture';
  paymentMethod?: { type: string; last4?: string };
  paymentIntentId?: string | null;
  sellerId?: string | null;
  placedAt?: string | null;
  acceptBy?: string | null;
  subtotal?: number;
  tax?: number;
  shipping?: number;
  total?: number;
  items: Array<{ product: { _id?: string } | string }>;
}

/** How many items the buyer's server-side cart holds, across all sellers. */
export async function fetchBuyerCartItemCount(request: APIRequestContext): Promise<number> {
  const res = await request.get(`${API_URL}/api/cart`, {
    headers: { Authorization: `Bearer ${getBuyerToken()}` },
  });
  if (!res.ok()) throw new Error(`Fetching the cart failed: ${res.status()}`);
  const body = await res.json();
  return (body.sellers as Array<{ items?: unknown[] }>).reduce((sum, seller) => sum + (seller.items?.length ?? 0), 0);
}

export async function fetchBuyerOrders(request: APIRequestContext): Promise<BuyerOrder[]> {
  const res = await request.get(`${API_URL}/api/orders`, {
    headers: { Authorization: `Bearer ${getBuyerToken()}` },
  });
  if (!res.ok()) throw new Error(`Fetching orders failed: ${res.status()}`);
  const body = await res.json();
  return body.orders as BuyerOrder[];
}

/** Orders that contain any of the given products. */
export function ordersForProducts(orders: BuyerOrder[], productIds: string[]): BuyerOrder[] {
  return orders.filter(order => order.items.some(item => {
    const id = typeof item.product === 'string' ? item.product : item.product?._id;
    return !!id && productIds.includes(id);
  }));
}

/** A seller has this long to accept an order (backend SELLER_ACCEPT_WINDOW_MS). */
export const SELLER_ACCEPT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The buyer's orders right now, so the order a test places can be told apart from earlier ones. */
export async function knownOrderIds(request: APIRequestContext): Promise<Set<string>> {
  return new Set((await fetchBuyerOrders(request)).map(order => order._id));
}

/** The new orders for the products, as many as expected. They are read from the API, so wait for them. */
export async function placedOrders(
  request: APIRequestContext,
  known: Set<string>,
  productIds: string[],
  expected: number,
): Promise<BuyerOrder[]> {
  let found: BuyerOrder[] = [];
  await expect.poll(async () => {
    found = ordersForProducts((await fetchBuyerOrders(request)).filter(order => !known.has(order._id)), productIds);
    return found.length;
  }, { timeout: 15_000, message: 'the placed orders should appear in the buyer\'s orders' }).toBeGreaterThanOrEqual(expected);
  expect(found).toHaveLength(expected);
  return found;
}

export async function placedOrder(request: APIRequestContext, known: Set<string>, productId: string): Promise<BuyerOrder> {
  return (await placedOrders(request, known, [productId], 1))[0];
}

/** No order was placed for the products since `known` was taken. */
export async function expectNoNewOrders(request: APIRequestContext, known: Set<string>, productIds: string[]): Promise<void> {
  const newOrders = ordersForProducts((await fetchBuyerOrders(request)).filter(order => !known.has(order._id)), productIds);
  expect(newOrders).toHaveLength(0);
}

/** Waits until the server-side cart holds exactly this many items, so "cleared" later is a real change. */
export async function expectCartItemCount(request: APIRequestContext, count: number): Promise<void> {
  await expect.poll(() => fetchBuyerCartItemCount(request), { message: `the cart should hold ${count} item(s)` }).toBe(count);
}

export async function expectCartCleared(request: APIRequestContext): Promise<void> {
  await expectCartItemCount(request, 0);
}

/** Opens the cart and goes on to checkout. */
export async function openCheckoutFromCart(pages: { cartPage: CartPage; checkoutPage: CheckoutPage }): Promise<void> {
  await pages.cartPage.open();
  await pages.cartPage.proceedToCheckout();
  await pages.checkoutPage.root.waitFor();
}

/** Opens each product page, adds the product to the cart, and goes on to checkout. */
export async function addProductsAndOpenCheckout(
  pages: { request: APIRequestContext; productDetailPage: ProductDetailPage; cartPage: CartPage; checkoutPage: CheckoutPage },
  productIds: string[],
): Promise<void> {
  for (const productId of productIds) {
    await pages.productDetailPage.goto(productId);
    await pages.productDetailPage.addToCart();
  }
  await expectCartItemCount(pages.request, productIds.length);
  await openCheckoutFromCart(pages);
}

/** The signed-in buyer's user ID, read from the storage the app writes at login. */
export async function buyerUserId(page: Page): Promise<string> {
  const id = await page.evaluate(() => {
    const raw = localStorage.getItem('shopping_app_user_data');
    return raw ? (JSON.parse(raw).id as string | undefined) : undefined;
  });
  if (!id) throw new Error('Buyer user ID not found in local storage');
  return id;
}

/** Same key the app uses for its per-buyer checkout attempt (frontend/src/utils/checkoutAttempt.ts). */
export const checkoutAttemptKey = (userId: string): string => `checkout-attempt:${userId}`;
