// TC coverage: TC-049 — A seller cancels a pending Cash on Delivery order with a reason
//
// The one seller-cancel journey on web (shift-left review 2026-11-28). The order is Cash on Delivery, so the test
// needs no Stripe and runs under either CHECKOUT_FLOW. The rules underneath (the required reason and its length, who
// may cancel, the race with acceptance, the stock coming back once) are integration tests in the backend; this
// test shows only what the seller does and what the buyer then sees.
//
// The product belongs to the seller this project is signed in as (SELLER_EMAIL); the order is placed by the buyer
// through the API, because checkout has its own tests.

import { getSellerToken } from '../../../helpers/auth-state';
import {
  fetchBuyerOrder,
  fetchProductStock,
  placeCodOrderViaApi,
} from '../../../helpers/checkout-flow';
import { createSimpleProduct } from '../../../helpers/product-factory';
import { test, expect } from '../../../fixtures/base-fixture';

const REASON = 'Out of stock at the warehouse';

test.describe('TC-049: Seller cancels a pending COD order with a reason', () => {
  test('the seller must give a reason, and the buyer then sees it',
    { tag: ['@TC-049', '@seller', '@orders', '@cancellation'] },
    async ({ page, browser, baseURL, request }) => {
      const name = `E2E Seller cancel ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const productId = await createSimpleProduct(request, getSellerToken(), name);
      const stockBefore = await fetchProductStock(request, productId);
      const order = await placeCodOrderViaApi(request, productId);

      await test.step('Open the pending order as its seller', async () => {
        await page.goto(`/seller/orders/${order._id}`);
        await expect(page.getByTestId('seller-order-status-badge')).toContainText(/pending/i);
        await expect(page.getByTestId('seller-cancel-order-btn')).toBeVisible();
      });

      await test.step('The cancel dialog asks for a reason and will not confirm without one', async () => {
        await page.getByTestId('seller-cancel-order-btn').click();
        await expect(page.getByTestId('seller-cancel-reason')).toBeVisible();
        await expect(page.getByTestId('seller-cancel-confirm')).toBeDisabled();
      });

      await test.step('Give a reason and confirm', async () => {
        await page.getByTestId('seller-cancel-reason').fill(REASON);
        await expect(page.getByTestId('seller-cancel-confirm')).toBeEnabled();
        await page.getByTestId('seller-cancel-confirm').click();
      });

      await test.step('The order is cancelled, shows the reason, and cannot be cancelled again', async () => {
        await expect(page.getByTestId('seller-order-status-badge')).toContainText(/cancelled/i);
        await expect(page.getByText(`Reason: ${REASON}`)).toBeVisible();
        await expect(page.getByTestId('seller-cancel-order-btn')).toHaveCount(0);
      });

      await test.step('The buyer\'s order is cancelled by the seller with that reason, and the stock is back', async () => {
        const stored = await fetchBuyerOrder(request, order._id);
        expect(stored).toMatchObject({ status: 'cancelled', cancelledByRole: 'seller', cancelReason: REASON });
        expect(await fetchProductStock(request, productId)).toBe(stockBefore);
      });

      await test.step('The buyer sees "Cancelled by the seller" and the reason in their orders', async () => {
        const buyer = await browser.newContext({ baseURL, storageState: '.auth/buyer.json' });
        try {
          const buyerPage = await buyer.newPage();
          await buyerPage.goto('/orders');
          const card = buyerPage.getByTestId(`order-card-${order._id}`);
          await expect(card.getByText('Cancelled by the seller', { exact: true })).toBeVisible({ timeout: 15_000 });
          await expect(card.getByText(`Reason: ${REASON}`)).toBeVisible();
        } finally {
          await buyer.close();
        }
      });
    });
});
