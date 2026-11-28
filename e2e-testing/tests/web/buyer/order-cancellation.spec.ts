// TC coverage: TC-153 — A buyer cancels a pending Cash on Delivery order
//
// The one buyer-cancel journey on web (shift-left review 2026-11-28). It is a Cash on Delivery order, so the test
// needs no Stripe and runs under either CHECKOUT_FLOW. The rules underneath (the stock comes back once, a second
// request changes nothing, who may cancel and when) are integration tests in the backend; this test shows only
// what the buyer does and sees.
//
// The order is placed through the API: checkout has its own tests, and this one is about what comes after it.

import { getBuyerToken } from '../../../helpers/auth-state';
import {
  createCheckoutProduct,
  fetchBuyerOrder,
  fetchProductStock,
  placeCodOrderViaApi,
} from '../../../helpers/checkout-flow';
import { API_URL } from '../../../helpers/test-data';
import { test, expect } from '../../../fixtures/base-fixture';

test.describe('TC-153: Buyer cancels a pending COD order', () => {
  test('cancelling from the order list marks the order cancelled and gives the stock back once',
    { tag: ['@TC-153', '@buyer', '@orders', '@cancellation'] },
    async ({ page, request, myOrdersPage, orderDetailPage }) => {
      const product = await createCheckoutProduct(request, 'Buyer cancel');
      const stockBefore = await fetchProductStock(request, product.id);
      const order = await placeCodOrderViaApi(request, product.id);

      await test.step('The pending order holds one unit of stock and can be cancelled', async () => {
        expect(order).toMatchObject({ status: 'pending', paymentStatus: 'not_required' });
        expect(await fetchProductStock(request, product.id)).toBe(stockBefore - 1);
        await myOrdersPage.open();
        await myOrdersPage.expectOrdersListed([order._id]);
        await expect(myOrdersPage.orderCard(order._id).getByRole('button', { name: 'Cancel Order', exact: true })).toBeVisible();
      });

      await test.step('Cancel the order without giving a reason', async () => {
        await myOrdersPage.orderCard(order._id).getByRole('button', { name: 'Cancel Order', exact: true }).click();
        await page.getByRole('button', { name: 'Yes, Cancel Order', exact: true }).click();
      });

      await test.step('The card says the order was cancelled, with no reason, and the cancel button is gone', async () => {
        const card = myOrdersPage.orderCard(order._id);
        await expect(card.getByText('This order has been cancelled', { exact: true })).toBeVisible();
        await expect(card.getByText(/^Reason:/)).toHaveCount(0);
        await expect(card.getByRole('button', { name: 'Cancel Order', exact: true })).toHaveCount(0);
      });

      await test.step('The order is cancelled by the buyer and the stock is back', async () => {
        const stored = await fetchBuyerOrder(request, order._id);
        expect(stored.status).toBe('cancelled');
        expect(stored.cancelledByRole).not.toBe('seller');
        expect(await fetchProductStock(request, product.id)).toBe(stockBefore);
      });

      await test.step('The detail page shows no payment notice for a cash order', async () => {
        await orderDetailPage.goto(order._id);
        await expect(orderDetailPage.statusBadge).toContainText(/cancelled/i);
        await expect(orderDetailPage.paymentNotice).toHaveCount(0);
      });

      await test.step('Cancelling again changes nothing and does not return the stock a second time', async () => {
        const again = await request.put(`${API_URL}/api/orders/${order._id}/status`, {
          headers: { Authorization: `Bearer ${getBuyerToken()}` },
          data: {},
        });
        expect(again.ok()).toBe(true);
        expect(await fetchProductStock(request, product.id)).toBe(stockBefore);
      });
    });
});
