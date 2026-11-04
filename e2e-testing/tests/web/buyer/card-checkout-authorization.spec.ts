// TC coverage: TC-143 — single seller, new card: payment reserved, order pending
//              TC-144 — single seller, saved card: payment reserved, order pending
//              TC-148 — two sellers: each seller's payment reserved, one order per seller
//              TC-146 — declined card: no order, buyer stays on review
//              TC-147 / TC-151 — 3DS cancelled, then resumed from the same session
//              TC-400 — expired session is not resumed
//
// Runs only when the backend and frontend use CHECKOUT_FLOW=manual_capture.

import type { Frame, Locator, Page } from '@playwright/test';

import type { CartPage } from '../../../pages/cart.page';
import type { CheckoutPage } from '../../../pages/checkout.page';
import type { ProductDetailPage } from '../../../pages/product-detail.page';
import { clearBuyerCart } from '../../../helpers/auth-state';
import { API_URL, DEFAULT_SHIPPING_ADDRESS } from '../../../helpers/test-data';
import {
  IS_MANUAL_CAPTURE,
  STRIPE_TEST_CARDS,
  buyerUserId,
  checkoutAttemptKey,
  createProductsFromTwoSellers,
  ensureSavedStripeCard,
  fetchBuyerOrders,
  ordersForProducts,
} from '../../../helpers/checkout-flow';
import { test, expect } from '../../../fixtures/base-fixture';

test.skip(!IS_MANUAL_CAPTURE, 'Authorization checkout runs only with CHECKOUT_FLOW=manual_capture');

// Each test changes the same buyer's cart and orders
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

test.beforeEach(async ({ request }) => {
  await clearBuyerCart(request, API_URL);
});

async function addProductsAndOpenCheckout(
  page: Page,
  productIds: string[],
  productDetailPage: ProductDetailPage,
  cartPage: CartPage,
  checkoutPage: CheckoutPage,
): Promise<void> {
  for (const productId of productIds) {
    await page.goto(`/products/${productId}`);
    await productDetailPage.root.waitFor();
    await productDetailPage.addToCart();
  }
  await cartPage.open();
  await cartPage.proceedToCheckout();
  await checkoutPage.root.waitFor();
}

/** The challenge frame that currently holds the named button, if Stripe has rendered it. */
async function findChallengeButton(page: Page, name: RegExp): Promise<{ frame: Frame; button: Locator } | undefined> {
  // The challenge page (FAIL / COMPLETE) and the modal around it (Cancel) are separate Stripe frames
  const isChallenge = (url: string) => /hooks\.stripe\.com|3d_secure|three-ds-2-challenge/i.test(url);
  for (const frame of page.frames().filter(f => isChallenge(f.url()))) {
    const button = frame.getByRole('button', { name }).first();
    if (await button.count()) return { frame, button };
  }
  return undefined;
}

/**
 * Stripe's 3D Secure challenge runs in frames served from Stripe's hosts, not from the checkout page. Click the
 * named button until `done` reports the result. Stripe draws the buttons before its challenge script (and its bot
 * check) is ready, and a click in that window is accepted by the browser but silently ignored by Stripe, so one
 * click is not enough. A fixed wait would be a guess; clicking again until the result shows is not.
 */
async function clickChallengeUntil(page: Page, name: RegExp, done: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await done()) return;
    const match = await findChallengeButton(page, name);
    if (match) await match.button.click({ timeout: 5_000 }).catch(() => undefined);
    // give Stripe a few seconds to react before clicking again
    const settled = Date.now() + 5_000;
    while (Date.now() < settled) {
      if (await done()) return;
      await page.waitForTimeout(500);
    }
  }
  throw new Error(`Clicking the Stripe challenge button ${name} did not lead to the expected result`);
}

async function openedSessionId(page: Page, userId: string): Promise<string | undefined> {
  return page.evaluate(key => {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw).sessionId as string | undefined) : undefined;
  }, checkoutAttemptKey(userId));
}

test.describe('Manual-capture card checkout', () => {
  test('TC-143: single seller, new card — payment is reserved and the order is pending',
    { tag: ['@TC-143', '@buyer', '@checkout', '@authorization'] },
    async ({ page, request, productDetailPage, cartPage, checkoutPage }) => {
      const [productId] = await createProductsFromTwoSellers(request);

      await test.step('Add one seller product and reach payment', async () => {
        await addProductsAndOpenCheckout(page, [productId], productDetailPage, cartPage, checkoutPage);
        await checkoutPage.fillNewShippingAddress(DEFAULT_SHIPPING_ADDRESS);
        await checkoutPage.continueToPayment();
        await checkoutPage.fillStripeCard(STRIPE_TEST_CARDS.success);
        await checkoutPage.continueToReview();
      });

      await test.step('Review shows the authorization disclosure and the seller amount', async () => {
        await expect(checkoutPage.authorizationPanel).toBeVisible();
        await expect(checkoutPage.authorizationPanel).toContainText(/reserved now and charged when/i);
        await expect(checkoutPage.authorizationPanel.locator('li')).toHaveCount(1);
      });

      await test.step('Place the order and land on the orders page', async () => {
        await checkoutPage.placeOrder();
        await expect(page).toHaveURL(/\/orders/, { timeout: 60_000 });
        await expect(page.getByTestId('orders-page')).toBeVisible();
      });

      await test.step('The order holds the payment; nothing is captured yet', async () => {
        const [order] = ordersForProducts(await fetchBuyerOrders(request), [productId]);
        expect(order).toBeDefined();
        expect(order).toMatchObject({
          status: 'pending',
          paymentFlowVersion: 'manual_capture',
          paymentStatus: 'authorized',
        });
      });
    });

  test('TC-144: single seller, saved card — payment is reserved and the order is pending',
    { tag: ['@TC-144', '@buyer', '@checkout', '@authorization'] },
    async ({ page, request, productDetailPage, cartPage, checkoutPage }) => {
      await ensureSavedStripeCard(request);
      const [productId] = await createProductsFromTwoSellers(request);

      await test.step('Add one seller product and pay with the saved card', async () => {
        await addProductsAndOpenCheckout(page, [productId], productDetailPage, cartPage, checkoutPage);
        await checkoutPage.fillNewShippingAddress(DEFAULT_SHIPPING_ADDRESS);
        await checkoutPage.continueToPayment();
        await checkoutPage.selectSavedCard();
        await checkoutPage.continueToReview();
        await checkoutPage.placeOrder();
      });

      await test.step('Order is placed with the payment reserved', async () => {
        await expect(page).toHaveURL(/\/orders/, { timeout: 60_000 });
        const [order] = ordersForProducts(await fetchBuyerOrders(request), [productId]);
        expect(order).toMatchObject({ status: 'pending', paymentStatus: 'authorized' });
      });
    });

  test('TC-148: two sellers — each payment is reserved and each seller gets its own order',
    { tag: ['@TC-148', '@buyer', '@checkout', '@authorization', '@multi-seller'] },
    async ({ page, request, productDetailPage, cartPage, checkoutPage }) => {
      const productIds = await createProductsFromTwoSellers(request);

      await test.step('Add a product from each seller and reach review', async () => {
        await addProductsAndOpenCheckout(page, productIds, productDetailPage, cartPage, checkoutPage);
        await checkoutPage.fillNewShippingAddress(DEFAULT_SHIPPING_ADDRESS);
        await checkoutPage.continueToPayment();
        await checkoutPage.fillStripeCard(STRIPE_TEST_CARDS.success);
        await checkoutPage.continueToReview();
      });

      await test.step('Review lists both sellers', async () => {
        await expect(checkoutPage.authorizationPanel.locator('li')).toHaveCount(2);
      });

      await test.step('Place the order; both payments are reserved', async () => {
        await checkoutPage.placeOrder();
        await expect(page).toHaveURL(/\/orders/, { timeout: 90_000 });
        const orders = ordersForProducts(await fetchBuyerOrders(request), productIds);
        expect(orders).toHaveLength(2);
        for (const order of orders) {
          expect(order).toMatchObject({ status: 'pending', paymentStatus: 'authorized' });
        }
      });
    });

  test('TC-146: declined card — no order is placed and the buyer stays on review',
    { tag: ['@TC-146', '@buyer', '@checkout', '@authorization'] },
    async ({ page, request, productDetailPage, cartPage, checkoutPage }) => {
      const [productId] = await createProductsFromTwoSellers(request);
      const ordersBefore = ordersForProducts(await fetchBuyerOrders(request), [productId]).length;

      await test.step('Add a product and pay with a card that is declined', async () => {
        await addProductsAndOpenCheckout(page, [productId], productDetailPage, cartPage, checkoutPage);
        await checkoutPage.fillNewShippingAddress(DEFAULT_SHIPPING_ADDRESS);
        await checkoutPage.continueToPayment();
        await checkoutPage.fillStripeCard(STRIPE_TEST_CARDS.declined);
        await checkoutPage.continueToReview();
        await checkoutPage.placeOrder();
      });

      await test.step('The buyer sees the decline and stays on review', async () => {
        await expect(checkoutPage.authorizationPanel.getByRole('alert')).toContainText(/declined/i, { timeout: 60_000 });
        await expect(checkoutPage.placeOrderButton).toBeVisible();
      });

      await test.step('No order was created', async () => {
        const ordersAfter = ordersForProducts(await fetchBuyerOrders(request), [productId]).length;
        expect(ordersAfter).toBe(ordersBefore);
      });
    });

  test('TC-147: 3DS cancelled, then resumed from the same session',
    { tag: ['@TC-147', '@TC-151', '@buyer', '@checkout', '@authorization', '@resume'] },
    async ({ page, request, productDetailPage, cartPage, checkoutPage }) => {
      const [productId] = await createProductsFromTwoSellers(request);

      await test.step('Start checkout with a card that needs 3DS and cancel the verification', async () => {
        await addProductsAndOpenCheckout(page, [productId], productDetailPage, cartPage, checkoutPage);
        await checkoutPage.fillNewShippingAddress(DEFAULT_SHIPPING_ADDRESS);
        await checkoutPage.continueToPayment();
        await checkoutPage.fillStripeCard(STRIPE_TEST_CARDS.requires3ds);
        await checkoutPage.continueToReview();
        await checkoutPage.placeOrder();

        // Cancel through the modal's own Cancel button, which does not depend on Stripe's test challenge page
        const alert = checkoutPage.authorizationPanel.getByRole('alert');
        await clickChallengeUntil(page, /^cancel$/i, async () => (await alert.count()) > 0);
        await expect(alert).toContainText(/verification|not completed/i, { timeout: 60_000 });
      });

      await test.step('The session is kept for resume and no order exists yet', async () => {
        const userId = await buyerUserId(page);
        await expect.poll(() => openedSessionId(page, userId)).toBeTruthy();
        const ordersSoFar = ordersForProducts(await fetchBuyerOrders(request), [productId]);
        expect(ordersSoFar).toHaveLength(0);
      });

      await test.step('Reload, reach review again and see the seller still awaiting payment', async () => {
        await page.reload();
        await checkoutPage.root.waitFor();
        await checkoutPage.fillNewShippingAddress(DEFAULT_SHIPPING_ADDRESS);
        await checkoutPage.continueToPayment();
        await checkoutPage.fillStripeCard(STRIPE_TEST_CARDS.requires3ds);
        await checkoutPage.continueToReview();
        await expect(checkoutPage.authorizationPanel).toContainText(/awaiting payment/i);
      });

      await test.step('Complete verification and place the order', async () => {
        await checkoutPage.placeOrder();
        await clickChallengeUntil(page, /complete/i, async () => /\/orders/.test(page.url()));
        await expect(page).toHaveURL(/\/orders/, { timeout: 90_000 });
        const [order] = ordersForProducts(await fetchBuyerOrders(request), [productId]);
        expect(order).toMatchObject({ status: 'pending', paymentStatus: 'authorized' });
      });
    });

  test('TC-400: an expired checkout is not resumed and its attempt is cleared',
    { tag: ['@TC-400', '@buyer', '@checkout', '@authorization'] },
    async ({ page, request, productDetailPage, cartPage, checkoutPage }) => {
      const [productId] = await createProductsFromTwoSellers(request);

      await page.goto('/');
      const userId = await buyerUserId(page);
      const key = checkoutAttemptKey(userId);

      await test.step('Store an attempt whose session the server reports as expired', async () => {
        await page.route(`${API_URL}/api/checkout/sessions/**`, route => route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'sess-expired', status: 'expired', expiresAt: new Date(Date.now() - 60_000).toISOString(), sellers: [] },
          }),
        }));
        await page.evaluate(
          ([storageKey, value]) => sessionStorage.setItem(storageKey, value),
          [key, JSON.stringify({ idempotencyKey: 'checkout-e2e-expired-0001', sessionId: 'sess-expired' })],
        );
      });

      await test.step('Reach checkout review; the stored attempt is dropped', async () => {
        await addProductsAndOpenCheckout(page, [productId], productDetailPage, cartPage, checkoutPage);
        await checkoutPage.fillNewShippingAddress(DEFAULT_SHIPPING_ADDRESS);
        await checkoutPage.continueToPayment();
        await checkoutPage.fillStripeCard(STRIPE_TEST_CARDS.success);
        await checkoutPage.continueToReview();
        await expect.poll(() => page.evaluate(storageKey => sessionStorage.getItem(storageKey), key)).toBeNull();
        await expect(checkoutPage.authorizationPanel).not.toContainText(/awaiting payment/i);
      });

      await page.unroute(`${API_URL}/api/checkout/sessions/**`);
    });
});
