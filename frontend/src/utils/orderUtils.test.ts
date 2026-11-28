import { describe, expect, it } from 'vitest';
import { formatDeliveryOption, formatPaymentMethodType, getStatusConfig, resolveSelectedDeliveryOption } from './orderUtils';

// The labels the seller and the buyer read on an order (TC-051).
describe('the payment method label', () => {
  it.each([
    ['cash-on-delivery', 'Cash on Delivery'],
    ['credit-card', 'Credit Card'],
    ['debit-card', 'Debit Card'],
    ['paypal', 'PayPal'],
  ])('shows %s as "%s"', (type, label) => {
    expect(formatPaymentMethodType(type)).toBe(label);
  });
  it('never shows the stored slug: an unknown type is turned into words', () => {
    expect(formatPaymentMethodType('bank-transfer')).toBe('Bank Transfer');
    expect(formatPaymentMethodType('wallet')).toBe('Wallet');
  });
});

describe('the delivery option label', () => {
  it.each([['standard', 'Standard'], ['express', 'Express'], ['pickup', 'Pickup']])('shows %s as "%s"', (option, label) => {
    expect(formatDeliveryOption(option)).toBe(label);
  });
  it('turns an unknown option into words', () => {
    expect(formatDeliveryOption('same-day')).toBe('Same Day');
  });
});

describe('the status label', () => {
  it.each([
    ['pending', 'Pending', 'warning'], ['preparing', 'Preparing', 'warning'], ['processing', 'Processing', 'primary'],
    ['shipped', 'Shipped', 'primary'], ['delivered', 'Delivered', 'success'], ['cancelled', 'Cancelled', 'danger'],
  ])('shows %s as "%s" in the %s style', (status, label, variant) => {
    expect(getStatusConfig(status)).toMatchObject({ label, variant });
  });
  it('shows an unknown status as it is, in a neutral style', () => {
    expect(getStatusConfig('on-hold')).toMatchObject({ label: 'on-hold', variant: 'gray' });
  });
});

describe('the delivery option of an order', () => {
  it('prefers the per-seller selection map, as a plain object or a Map', () => {
    expect(resolveSelectedDeliveryOption({ deliverySelections: { s1: 'express' }, selectedDeliveryOption: 'standard' })).toBe('express');
    expect(resolveSelectedDeliveryOption({ deliverySelections: new Map([['s1', 'pickup']]) })).toBe('pickup');
  });
  it('falls back to the single selected option, then to nothing', () => {
    expect(resolveSelectedDeliveryOption({ selectedDeliveryOption: 'standard' })).toBe('standard');
    expect(resolveSelectedDeliveryOption({ deliverySelections: {} })).toBeUndefined();
    expect(resolveSelectedDeliveryOption({})).toBeUndefined();
  });
});
