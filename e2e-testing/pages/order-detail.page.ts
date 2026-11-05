import { expect, Locator, Page } from '@playwright/test';

export class OrderDetailPage {
  readonly page: Page;
  readonly root: Locator;
  readonly statusBadge: Locator;
  /** Explains the payment state, for example "Payment reserved" under manual capture. */
  readonly paymentNotice: Locator;
  /** The seller's acceptance deadline, shown while the order is waiting for the seller. */
  readonly acceptanceDeadline: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByTestId('order-detail-page');
    this.statusBadge = page.getByTestId('order-status-badge');
    this.paymentNotice = page.getByTestId('payment-status-notice');
    this.acceptanceDeadline = page.getByTestId('acceptance-deadline');
  }

  async goto(orderId: string): Promise<void> {
    await this.page.goto(`/orders/${orderId}`);
    await this.root.waitFor();
  }

  /** The payment line reads "Cash on Delivery". */
  async expectCashOnDelivery(): Promise<void> {
    await expect(this.root.getByText('Cash on Delivery', { exact: true })).toBeVisible();
  }

  /**
   * The payment line reads "Credit Card ending in <last4>" for a saved card. A card typed into Stripe's frame
   * is stored without its last four digits, so the line is only "Credit Card" (pass null).
   */
  async expectCardPayment(last4: string | null): Promise<void> {
    const line = this.root.getByText(last4 ? `Credit Card ending in ${last4}` : 'Credit Card', { exact: !last4 });
    await expect(line).toBeVisible();
  }

  /** Manual capture: the notice says the payment is reserved, and the seller's deadline is shown. */
  async expectPaymentReserved(): Promise<void> {
    await expect(this.paymentNotice).toContainText(/reserved/i);
    await expect(this.acceptanceDeadline).toBeVisible();
  }

  orderItem(productId: string): Locator {
    return this.page.getByTestId(`order-item-${productId}`);
  }

  async expectVariantLine(
    productId: string,
    size: string,
    unitPrice: string,
  ): Promise<void> {
    const item = this.orderItem(productId);
    await expect(item).toBeVisible();
    await expect(item).toContainText(`Size: ${size}`);
    await expect(item).toContainText(`${unitPrice} each`);
  }
}
