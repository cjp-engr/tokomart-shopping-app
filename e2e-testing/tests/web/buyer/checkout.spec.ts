// TC coverage: TC-022 — Checkout with Cash on Delivery
//              TC-023 — Checkout with saved credit card
//              TC-024 — Checkout with new card entry
//              TC-025 — Multi-seller checkout creates separate orders (E2E leg; the API leg is in orders.api.spec.ts)
//              TC-029 — Checkout blocked with missing address fields
//              TC-500 — The Stripe card field renders on the payment step
//
// Every test creates its own in-stock product through the API, so it does not depend on which product is first in
// the catalog or on its stock. TC-022 still finds its product through the product list, as a buyer would.
//
// Runs under either CHECKOUT_FLOW. Checks that only hold for the authorization flow (the payment is reserved,
// not charged) run only when CHECKOUT_FLOW=manual_capture.

import type { APIRequestContext } from '@playwright/test';

import type { MyOrdersPage } from '../../../pages/my-orders/my-orders.page';
import type { OrderDetailPage } from '../../../pages/order-detail.page';
import { clearBuyerCart } from '../../../helpers/auth-state';
import { API_URL, DEFAULT_SHIPPING_ADDRESS } from '../../../helpers/test-data';
import {
  IS_MANUAL_CAPTURE,
  SELLER_ACCEPT_WINDOW_MS,
  STRIPE_TEST_CARDS,
  addProductsAndOpenCheckout,
  createCheckoutProduct,
  createProductsFromTwoSellers,
  ensureSavedStripeCard,
  expectCartCleared,
  expectCartItemCount,
  expectNoNewOrders,
  fetchBuyerCartItemCount,
  knownOrderIds,
  openCheckoutFromCart,
  ordersForProducts,
  placedOrder,
  placedOrders,
} from '../../../helpers/checkout-flow';
import { test, expect } from '../../../fixtures/base-fixture';

// All tests mutate the same buyer's server-side cart — run sequentially to avoid races
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await clearBuyerCart(request, API_URL);
});

/**
 * A card order is pending, is listed in the order history, shows its payment on the detail page, and under
 * manual_capture holds the payment. A saved card shows its last four digits. A new card is typed into Stripe's
 * secure frame, so the order keeps no last four digits and the page shows only the card type.
 */
async function expectCardOrderPlaced(
  pages: { request: APIRequestContext; myOrdersPage: MyOrdersPage; orderDetailPage: OrderDetailPage },
  known: Set<string>,
  productId: string,
  last4: string | null,
): Promise<void> {
  const { request, myOrdersPage, orderDetailPage } = pages;
  const order = await placedOrder(request, known, productId);
  expect(order).toMatchObject({ status: 'pending', paymentMethod: { type: 'credit-card' } });
  if (last4) expect(order.paymentMethod?.last4).toBe(last4);
  if (IS_MANUAL_CAPTURE) {
    expect(order).toMatchObject({ paymentFlowVersion: 'manual_capture', paymentStatus: 'authorized' });
  }

  await myOrdersPage.expectOrdersListed([order._id]);
  await orderDetailPage.goto(order._id);
  await orderDetailPage.expectCardPayment(last4);
  if (IS_MANUAL_CAPTURE) await orderDetailPage.expectPaymentReserved();
  await expectCartCleared(request);
}

test.describe('TC-022: Checkout COD', () => {
  test('buyer completes checkout with Cash on Delivery',
    { tag: ['@TC-022', '@buyer', '@checkout', '@simple', '@smoke'] },
    async ({ page, request, productListPage, productDetailPage, cartPage, checkoutPage, myOrdersPage, orderDetailPage }) => {
      const known = await knownOrderIds(request);
      const product = await createCheckoutProduct(request, 'Checkout COD');

      await test.step('Find the product in the product list and add it to the cart', async () => {
        await productListPage.goto();
        await productListPage.search(product.name);
        await productListPage.productCard(product.id).click();
        await productDetailPage.root.waitFor();
        await productDetailPage.addToCart();
        await expectCartItemCount(request, 1);
      });

      await test.step('Open cart and proceed to checkout', async () => {
        await openCheckoutFromCart({ cartPage, checkoutPage });
      });

      await test.step('Fill shipping address, select Cash on Delivery, and place order', async () => {
        await checkoutPage.fillNewShippingAddress(DEFAULT_SHIPPING_ADDRESS);
        await checkoutPage.continueToPayment();
        await checkoutPage.selectPaymentMethod('cash-on-delivery');
        await checkoutPage.continueToReview();
        await checkoutPage.placeOrder();
      });

      await test.step('Verify redirect to orders page', async () => {
        await expect(page).toHaveURL(/\/orders/, { timeout: 15_000 });
        await myOrdersPage.expectLoaded();
      });

      await test.step('The order is pending, needs no payment, and keeps its seller and 24-hour deadline', async () => {
        const order = await placedOrder(request, known, product.id);
        expect(order).toMatchObject({ status: 'pending', paymentStatus: 'not_required', paymentMethod: { type: 'cash-on-delivery' } });
        // Nothing to authorize or charge: no payment intent was created
        expect(order.paymentIntentId ?? null).toBeNull();
        expect(order.sellerId).toBeTruthy();
        expect(Date.parse(order.acceptBy!) - Date.parse(order.placedAt!)).toBe(SELLER_ACCEPT_WINDOW_MS);

        await myOrdersPage.expectOrdersListed([order._id]);
        await orderDetailPage.goto(order._id);
        await orderDetailPage.expectCashOnDelivery();
      });

      await test.step('The cart is cleared', async () => {
        await expectCartCleared(request);
      });
    });
});

test.describe('TC-023: Checkout with saved credit card', () => {
  test('buyer completes checkout with saved credit card',
    { tag: ['@TC-023', '@buyer', '@checkout', '@simple', '@smoke'] },
    async ({ page, request, productDetailPage, cartPage, checkoutPage, myOrdersPage, orderDetailPage }) => {
      const known = await knownOrderIds(request);
      const product = await createCheckoutProduct(request, 'Checkout saved card');

      await test.step('Ensure buyer has a saved card backed by a Stripe PaymentMethod', async () => {
        await ensureSavedStripeCard(request);
      });

      await test.step('Add the product to the cart and open checkout', async () => {
        await addProductsAndOpenCheckout({ request, productDetailPage, cartPage, checkoutPage }, [product.id]);
      });

      await test.step('Fill shipping address, select saved card, and place order', async () => {
        await checkoutPage.fillNewShippingAddress(DEFAULT_SHIPPING_ADDRESS);
        await checkoutPage.continueToPayment();
        await checkoutPage.selectSavedCard();
        await checkoutPage.continueToReview();
        await checkoutPage.placeOrder();
      });

      await test.step('Verify redirect to orders page', async () => {
        await expect(page).toHaveURL(/\/orders/, { timeout: 15_000 });
        await myOrdersPage.expectLoaded();
      });

      await test.step('The order is pending and its detail page shows the saved card', async () => {
        await expectCardOrderPlaced({ request, myOrdersPage, orderDetailPage }, known, product.id, '4242');
      });
    });
});

test.describe('TC-024: Checkout with new card entry', () => {
  test('buyer completes checkout with new card entry',
    { tag: ['@TC-024', '@buyer', '@checkout', '@simple', '@smoke'] },
    async ({ page, request, productDetailPage, cartPage, checkoutPage, myOrdersPage, orderDetailPage }) => {
      const known = await knownOrderIds(request);
      const product = await createCheckoutProduct(request, 'Checkout new card');

      await test.step('Add the product to the cart and open checkout', async () => {
        await addProductsAndOpenCheckout({ request, productDetailPage, cartPage, checkoutPage }, [product.id]);
      });

      await test.step('Fill shipping address, enter new card details, and place order', async () => {
        await checkoutPage.fillNewShippingAddress(DEFAULT_SHIPPING_ADDRESS);
        await checkoutPage.continueToPayment();
        await checkoutPage.fillStripeCard(STRIPE_TEST_CARDS.success);
        await checkoutPage.continueToReview();
        await checkoutPage.placeOrder();
      });

      await test.step('Verify redirect to orders page', async () => {
        await expect(page).toHaveURL(/\/orders/, { timeout: 15_000 });
        await myOrdersPage.expectLoaded();
      });

      await test.step('The order is pending and its detail page shows the card type', async () => {
        await expectCardOrderPlaced({ request, myOrdersPage, orderDetailPage }, known, product.id, null);
      });
    });
});

test.describe('TC-025: Multi-seller checkout creates separate orders', () => {
  test('buyer checks out a cart with two sellers and gets one order per seller',
    { tag: ['@TC-025', '@buyer', '@checkout', '@multi-seller'] },
    async ({ page, request, productDetailPage, cartPage, checkoutPage, myOrdersPage }) => {
      const known = await knownOrderIds(request);
      const productIds = await createProductsFromTwoSellers(request);

      await test.step('Add one product from each seller and open checkout', async () => {
        await addProductsAndOpenCheckout({ request, productDetailPage, cartPage, checkoutPage }, productIds);
      });

      await test.step('Pay with Cash on Delivery and place the order', async () => {
        await checkoutPage.fillNewShippingAddress(DEFAULT_SHIPPING_ADDRESS);
        await checkoutPage.continueToPayment();
        await checkoutPage.selectPaymentMethod('cash-on-delivery');
        await checkoutPage.continueToReview();
        await checkoutPage.placeOrder();
        await expect(page).toHaveURL(/\/orders/, { timeout: 15_000 });
        await myOrdersPage.expectLoaded();
      });

      await test.step('There is one order per seller, each with its own amounts, and both are listed', async () => {
        const orders = await placedOrders(request, known, productIds, 2);
        // each product is in exactly one order, and the two orders belong to two different sellers
        for (const productId of productIds) expect(ordersForProducts(orders, [productId])).toHaveLength(1);
        expect(new Set(orders.map(order => order.sellerId)).size).toBe(2);

        for (const order of orders) {
          expect(order).toMatchObject({ status: 'pending', paymentStatus: 'not_required' });
          // 8% tax on the order's own subtotal; the total adds that tax and the order's own shipping
          expect(order.tax).toBeCloseTo(order.subtotal! * 0.08, 2);
          expect(order.total).toBeCloseTo(order.subtotal! + order.tax! + order.shipping!, 2);
        }
        // the two products cost 25 and 35, so the subtotals differ and are not shared between the orders
        expect(orders.map(order => order.subtotal).sort()).toEqual([25, 35]);
        await myOrdersPage.expectOrdersListed(orders.map(order => order._id));
      });

      await test.step('The cart is cleared', async () => {
        await expectCartCleared(request);
      });
    });
});

test.describe('TC-029: Checkout blocked with missing address fields', () => {
  test('empty required fields are stopped by the browser before payment and no order is placed',
    { tag: ['@TC-029', '@buyer', '@checkout', '@validation'] },
    async ({ request, productDetailPage, cartPage, checkoutPage }) => {
      const known = await knownOrderIds(request);
      const product = await createCheckoutProduct(request, 'Checkout address');

      await test.step('Open the new address form, leave it empty and try to continue', async () => {
        await addProductsAndOpenCheckout({ request, productDetailPage, cartPage, checkoutPage }, [product.id]);
        await checkoutPage.openNewAddressForm();
        await checkoutPage.clickContinueToPayment();
      });

      await test.step('The address fields are required, are reported as missing, and the first one has the focus', async () => {
        await checkoutPage.expectRequiredShippingFieldsMissing();
      });

      await test.step('The buyer stays on the address step and no order was placed', async () => {
        await checkoutPage.expectStoppedBeforePayment();
        await expectNoNewOrders(request, known, [product.id]);
        expect(await fetchBuyerCartItemCount(request)).toBeGreaterThan(0);
      });
    });

  test("fields with only spaces pass the browser check but show the app's own errors",
    { tag: ['@TC-029', '@buyer', '@checkout', '@validation'] },
    async ({ request, productDetailPage, cartPage, checkoutPage }) => {
      const known = await knownOrderIds(request);
      const product = await createCheckoutProduct(request, 'Checkout address spaces');

      await test.step('Fill every address field and the phone with spaces and try to continue', async () => {
        await addProductsAndOpenCheckout({ request, productDetailPage, cartPage, checkoutPage }, [product.id]);
        await checkoutPage.openNewAddressForm();
        await checkoutPage.fillRequiredShippingFields('   ');
        await checkoutPage.clickContinueToPayment();
      });

      await test.step("Each field shows the app's own required message", async () => {
        await checkoutPage.expectRequiredShippingMessages();
      });

      await test.step('The buyer stays on the address step and no order was placed', async () => {
        await checkoutPage.expectStoppedBeforePayment();
        await expectNoNewOrders(request, known, [product.id]);
        expect(await fetchBuyerCartItemCount(request)).toBeGreaterThan(0);
      });
    });
});

test.describe('TC-500: The Stripe card field renders on the payment step', () => {
  test('choosing Credit Card shows the Stripe card field',
    { tag: ['@TC-500', '@buyer', '@checkout', '@stripe', '@ui-state'] },
    async ({ request, productDetailPage, cartPage, checkoutPage }) => {
      const product = await createCheckoutProduct(request, 'Stripe card field');

      await test.step('Add the product to the cart, open checkout and reach the payment step', async () => {
        await addProductsAndOpenCheckout({ request, productDetailPage, cartPage, checkoutPage }, [product.id]);
        await checkoutPage.fillNewShippingAddress(DEFAULT_SHIPPING_ADDRESS);
        await checkoutPage.continueToPayment();
      });

      await test.step('Choose Credit Card', async () => {
        await checkoutPage.selectPaymentMethod('credit-card');
      });

      await test.step('The Stripe card field is shown with its card number input', async () => {
        await checkoutPage.expectStripeCardFieldVisible();
      });
    });
});
