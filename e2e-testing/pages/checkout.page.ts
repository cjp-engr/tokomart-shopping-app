import { expect, Locator, Page } from '@playwright/test';

/** The shipping fields the checkout form requires, with the message the app shows when one holds only spaces. */
export const REQUIRED_SHIPPING_FIELDS: ReadonlyArray<{ label: RegExp; message: string }> = [
  { label: /street address/i, message: 'Street address is required' },
  { label: /city/i, message: 'City is required' },
  { label: /state/i, message: 'State is required' },
  { label: /zip/i, message: 'ZIP code is required' },
  { label: /phone/i, message: 'Phone number is required' },
];

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export interface NewCardData {
  type?: string; // 'credit-card' | 'debit-card' | 'paypal' — defaults to 'credit-card'
  cardNumber: string;
  cardHolder: string;
  expiryMonth: string; // zero-padded e.g. '12'
  expiryYear: string;  // four-digit e.g. '2028'
  cvv: string;
}

export class CheckoutPage {
  readonly page: Page;
  readonly root: Locator;
  readonly shippingSection: Locator;
  readonly paymentSection: Locator;
  readonly placeOrderButton: Locator;
  /** Manual-capture review panel: disclosure, per-seller amounts and status. */
  readonly authorizationPanel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByTestId('checkout-page');
    this.shippingSection = page.getByTestId('shipping-section');
    this.paymentSection = page.getByTestId('payment-section');
    this.placeOrderButton = page.getByTestId('place-order-btn');
    this.authorizationPanel = page.getByTestId('card-authorization-panel');
  }

  async openNewAddressForm(): Promise<void> {
    await this.page.getByRole('button', { name: /new address/i }).click();
  }

  /** An address or contact input, found by its label inside the shipping section. */
  shippingField(label: RegExp): Locator {
    return this.shippingSection.getByLabel(label);
  }

  /** A validation message the page shows under the shipping form. */
  shippingError(message: string): Locator {
    return this.shippingSection.getByText(message);
  }

  /** Clicks Continue to Payment without waiting for the payment step, for tests that expect to be stopped. */
  async clickContinueToPayment(): Promise<void> {
    await this.page.getByRole('button', { name: /continue to payment/i }).click();
  }

  /** Puts the same text in every required shipping field. */
  async fillRequiredShippingFields(text: string): Promise<void> {
    for (const { label } of REQUIRED_SHIPPING_FIELDS) {
      await this.shippingField(label).fill(text);
    }
  }

  /**
   * After an empty submit: the browser stopped the form. The required inputs are HTML required fields, so the
   * browser reports each as missing, gives the first the focus, and shows its own message ("Please fill out this
   * field"). The app's own messages do not appear.
   */
  async expectRequiredShippingFieldsMissing(): Promise<void> {
    for (const { label } of REQUIRED_SHIPPING_FIELDS) {
      const field = this.shippingField(label);
      await expect(field).toHaveJSProperty('required', true);
      expect(await field.evaluate(element => (element as HTMLInputElement).validity.valueMissing)).toBe(true);
    }
    await expect(this.shippingField(REQUIRED_SHIPPING_FIELDS[0].label)).toBeFocused();
  }

  /** After a submit with spaces only: the browser accepted it, so the app shows its own message for each field. */
  async expectRequiredShippingMessages(): Promise<void> {
    for (const { message } of REQUIRED_SHIPPING_FIELDS) {
      await expect(this.shippingError(message)).toBeVisible();
    }
  }

  /** The form never reached payment or review, so Place Order is not offered. */
  async expectStoppedBeforePayment(): Promise<void> {
    await expect(this.paymentSection).toBeHidden();
    await expect(this.placeOrderButton).toBeHidden();
    await expect(this.page).toHaveURL(/\/checkout/);
  }

  async fillNewShippingAddress(address: ShippingAddress): Promise<void> {
    await this.openNewAddressForm();
    await this.page.getByLabel(/street address/i).fill(address.street);
    await this.page.getByLabel(/city/i).fill(address.city);
    await this.page.getByLabel(/state/i).fill(address.state);
    await this.page.getByLabel(/zip/i).fill(address.zip);
    await this.page.getByLabel(/phone/i).fill(address.phone);
  }

  async continueToPayment(): Promise<void> {
    await this.clickContinueToPayment();
    await this.paymentSection.waitFor();
  }

  /** Use when buyer has saved cards and should pay with the default/first saved card. */
  async selectSavedCard(): Promise<void> {
    // Button accessible name is "Saved Card Use a saved card" (two text nodes) — use substring match
    const savedCardBtn = this.page.getByRole('button', { name: /saved card/i });
    if (await savedCardBtn.isVisible()) {
      await savedCardBtn.click();
    }
    // First saved card is auto-selected by the UI — no further action needed
  }

  /** Use when buyer should pay with COD or enter a new card. */
  async selectPaymentMethod(method: string): Promise<void> {
    // Button accessible name is "New Card Enter a different card" — use substring match
    const newCardBtn = this.page.getByRole('button', { name: /new card/i });
    if (await newCardBtn.isVisible()) {
      await newCardBtn.click();
    }
    await this.page.locator('select[name="type"]').selectOption(method);
  }

  /** Use when buyer should pay with a new card and fill all card fields. */
  async fillNewCardForm(data: NewCardData): Promise<void> {
    // Button accessible name is "New Card Enter a different card" — use substring match
    const newCardBtn = this.page.getByRole('button', { name: /new card/i });
    if (await newCardBtn.isVisible()) {
      await newCardBtn.click();
    }
    await this.page.locator('select[name="type"]').selectOption(data.type ?? 'credit-card');
    await this.page.getByLabel(/card number/i).fill(data.cardNumber);
    await this.page.getByLabel(/cardholder name/i).fill(data.cardHolder);
    await this.page.locator('select[name="expiryMonth"]').selectOption(data.expiryMonth);
    await this.page.locator('select[name="expiryYear"]').selectOption(data.expiryYear);
    await this.page.getByLabel(/cvv/i).fill(data.cvv);
  }

  /**
   * Enters a card in the Stripe Element used by the new-card form. Selects the New Card option first when
   * the buyer has saved cards.
   */
  async fillStripeCard(cardNumber: string): Promise<void> {
    const newCardBtn = this.page.getByRole('button', { name: /new card/i });
    if (await newCardBtn.isVisible()) {
      await newCardBtn.click();
    }
    const cardFrame = this.page.frameLocator('iframe[name*="__privateStripeFrame"]').first();
    await cardFrame.locator('[placeholder="Card number"]').fill(cardNumber);
    await cardFrame.locator('[placeholder="MM / YY"]').fill('12 / 30');
    await cardFrame.locator('[placeholder="CVC"]').fill('123');
  }

  async continueToReview(): Promise<void> {
    await this.page.getByRole('button', { name: /review order/i }).click();
    await this.placeOrderButton.waitFor();
  }

  async placeOrder(): Promise<void> {
    await this.placeOrderButton.click();
  }

  /** Full COD path after landing on checkout-page. */
  async completeCodCheckout(address: ShippingAddress): Promise<void> {
    await this.root.waitFor();
    await this.fillNewShippingAddress(address);
    await this.continueToPayment();
    await this.selectPaymentMethod('cash-on-delivery');
    await this.continueToReview();
    await this.placeOrder();
  }
}
