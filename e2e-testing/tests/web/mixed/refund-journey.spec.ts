// TC coverage: TC-164 — A delivered card order is refunded: the buyer requests, the seller approves, the refund settles.
//
// The one refund journey on web (shift-left review 2026-11-28). Everything under it is an integration test in the
// backend (what can be refunded, the amounts, the settlement, the races); this test shows the two screens and the
// words the people see.
//
// OPT-IN. It pays in Stripe TEST mode and needs a backend started with
//   DELIVERED_REFUNDS_ENABLED=true  SELLER_SEES_MANUAL_CAPTURE=true  CHECKOUT_FLOW=manual_capture
// on a replica-set database whose name ends in `_test` (port 27018). Run it with
//   DELIVERED_REFUND_VERIFICATION=true
//   DELIVERED_REFUND_DB_URI=mongodb://127.0.0.1:27018/<name>_test?replicaSet=rs0&directConnection=true
// where the URI names the same database the backend uses. Never point it at the standalone database on port 27017.
//
// The delivered order is made by backend/scripts/seed-delivered-card-order.mjs, which pays and captures a real
// Stripe test-mode PaymentIntent. The buyer refunds one of the two units: $10 plus tax, and no shipping, because
// shipping is refunded only when every item is selected.

import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { BUYER_EMAIL, SELLER_EMAIL } from '../../../helpers/api-client';
import { fetchBuyerOrder } from '../../../helpers/checkout-flow';
import { test, expect } from '../../../fixtures/base-fixture';

test.skip(process.env.DELIVERED_REFUND_VERIFICATION !== 'true', 'Opt-in Stripe test-mode verification only');
test.setTimeout(180_000);

test.describe('TC-164: A delivered card order is refunded after the seller approves', () => {
  test('the buyer requests a refund for one unit, the seller approves it, and it settles',
    { tag: ['@TC-164', '@buyer', '@seller', '@refund', '@stripe'] },
    async ({ browser, baseURL, request }) => {
      const dbUri = process.env.DELIVERED_REFUND_DB_URI;
      if (!dbUri) throw new Error('DELIVERED_REFUND_DB_URI is required: the database the backend under test uses');

      const seeded = JSON.parse(execFileSync(process.execPath, [
        '--import', 'tsx', 'scripts/seed-delivered-card-order.mjs', BUYER_EMAIL, SELLER_EMAIL,
      ], { cwd: path.resolve(__dirname, '../../../../backend'), env: { ...process.env, DELIVERED_REFUND_DB_URI: dbUri }, encoding: 'utf8' })
        .trim().split('\n').pop()!) as { orderId: string; productName: string };

      const buyerContext = await browser.newContext({ baseURL, storageState: '.auth/buyer.json' });
      const sellerContext = await browser.newContext({ baseURL, storageState: '.auth/seller.json' });
      try {
        const buyer = await buyerContext.newPage();
        const seller = await sellerContext.newPage();

        await test.step('The buyer opens the delivered order and requests a refund for one of the two units', async () => {
          await buyer.goto(`/orders/${seeded.orderId}`);
          await expect(buyer.getByRole('heading', { name: 'Request a refund' })).toBeVisible({ timeout: 15_000 });
          await buyer.getByRole('button', { name: `Increase refund quantity for ${seeded.productName}` }).click();
          await expect(buyer.getByText('$10.80 refund')).toBeVisible();
          await buyer.getByLabel('Tell the seller what happened').fill('The box arrived crushed.');
          await buyer.getByRole('button', { name: 'Submit refund request' }).click();
        });

        await test.step('The request waits for the seller', async () => {
          await expect(buyer.getByText('Awaiting seller review').first()).toBeVisible({ timeout: 15_000 });
        });

        await test.step('The seller opens Return/Refund, sees the exact amount and approves', async () => {
          await seller.goto('/seller?tab=refunds');
          const card = seller.getByTestId(/^refund-card-/).filter({ hasText: seeded.productName });
          await expect(card).toBeVisible({ timeout: 15_000 });
          await card.getByRole('button', { name: /^Approve \$10\.80/ }).click();
          await seller.getByRole('button', { name: 'Approve refund', exact: true }).click();
        });

        await test.step('The request moves to the Approved group and says the refund is completed once Stripe confirms', async () => {
          await seller.getByTestId('refund-group-approved').click();
          const card = seller.getByTestId(/^refund-card-/).filter({ hasText: seeded.productName });
          await expect(card).toBeVisible({ timeout: 30_000 });
          await expect(card).toContainText('Refund completed and confirmed', { timeout: 90_000 });
        });

        await test.step('The buyer sees the order as partly refunded', async () => {
          await buyer.reload();
          await expect(buyer.getByText('Partially refunded').first()).toBeVisible({ timeout: 15_000 });
          expect((await fetchBuyerOrder(request, seeded.orderId)).paymentStatus).toBe('partially_refunded');
        });
      } finally {
        await buyerContext.close();
        await sellerContext.close();
      }
    });
});
