import { describe, expect, it } from 'vitest';
import { validateWizardStep, type WizardStepData } from './wizardRules';

// The seller wizard's step checks (REQ-SEL-01, REQ-SEL-06): what stops "Next" on each step. The server checks the same
// fields again (API TC-304 to TC-311).
const base = (overrides: Partial<WizardStepData> = {}): WizardStepData => ({
  name: 'Desk lamp', category: 'Home & Garden', description: 'A lamp.',
  hasVariants: false, variantAttributes: [], price: '12.50', stock: '5',
  imageMode: 'url', imageUrl: 'https://example.com/lamp.png',
  shippingOptions: ['standard'], shippingFee: 'free', shippingFeeAmounts: {},
  ...overrides,
});
const noImages = { fileCount: 0, existingUrlCount: 0 };

describe('step 1: name and category', () => {
  it('passes with both', () => expect(validateWizardStep(1, base(), noImages)).toBeNull());
  it.each(['', '   '])('asks for a name when it is %j', (name) => {
    expect(validateWizardStep(1, base({ name }), noImages)).toBe('Product name is required.');
  });
  it('asks for a category', () => {
    expect(validateWizardStep(1, base({ category: '' }), noImages)).toBe('Category is required.');
  });
  it('checks the name before the category', () => {
    expect(validateWizardStep(1, base({ name: '', category: '' }), noImages)).toBe('Product name is required.');
  });
});

describe('step 2 without variants: price and stock', () => {
  it('passes with a price above 0 and a stock of 0 (the lower boundary of stock)', () => {
    expect(validateWizardStep(2, base({ price: '0.01', stock: '0' }), noImages)).toBeNull();
  });
  it.each(['', '0', '-1'])('refuses the price %j', (price) => {
    expect(validateWizardStep(2, base({ price }), noImages)).toBe('Price must be greater than 0.');
  });
  it.each(['', '-1'])('refuses the stock %j', (stock) => {
    expect(validateWizardStep(2, base({ stock }), noImages)).toBe('Stock quantity is required.');
  });
});

describe('step 2 with variants', () => {
  it('needs at least one attribute with a name and values', () => {
    const message = 'Add at least one attribute with values, or disable variants.';
    expect(validateWizardStep(2, base({ hasVariants: true, variantAttributes: [] }), noImages)).toBe(message);
    expect(validateWizardStep(2, base({ hasVariants: true, variantAttributes: [{ name: 'Size', values: [] }] }), noImages)).toBe(message);
    expect(validateWizardStep(2, base({ hasVariants: true, variantAttributes: [{ name: '  ', values: ['M'] }] }), noImages)).toBe(message);
  });
  it('passes with one named attribute that has a value, and ignores the product price', () => {
    expect(validateWizardStep(2, base({ hasVariants: true, price: '', variantAttributes: [{ name: 'Size', values: ['M'] }] }), noImages)).toBeNull();
  });
});

describe('step 3: description', () => {
  it('passes with a description', () => expect(validateWizardStep(3, base(), noImages)).toBeNull());
  it.each(['', '  '])('asks for a description when it is %j', (description) => {
    expect(validateWizardStep(3, base({ description }), noImages)).toBe('Description is required.');
  });
});

describe('step 4: images', () => {
  const message = 'Please add at least one product image.';
  it('needs a URL in URL mode', () => {
    expect(validateWizardStep(4, base({ imageMode: 'url', imageUrl: '  ' }), noImages)).toBe(message);
    expect(validateWizardStep(4, base({ imageMode: 'url' }), noImages)).toBeNull();
  });
  it('needs an uploaded file or an existing image in upload mode', () => {
    expect(validateWizardStep(4, base({ imageMode: 'upload', imageUrl: '' }), noImages)).toBe(message);
    expect(validateWizardStep(4, base({ imageMode: 'upload', imageUrl: '' }), { fileCount: 1, existingUrlCount: 0 })).toBeNull();
    expect(validateWizardStep(4, base({ imageMode: 'upload', imageUrl: '' }), { fileCount: 0, existingUrlCount: 2 })).toBeNull();
  });
  it('does not count the URL box in upload mode', () => {
    expect(validateWizardStep(4, base({ imageMode: 'upload', imageUrl: 'https://example.com/a.png' }), noImages)).toBe(message);
  });
});

describe('step 5: delivery options and fee', () => {
  it('needs at least one delivery option', () => {
    expect(validateWizardStep(5, base({ shippingOptions: [] }), noImages)).toBe('Please select at least one delivery option.');
  });
  it('needs a fee choice', () => {
    expect(validateWizardStep(5, base({ shippingFee: '' }), noImages)).toBe('Please select a shipping fee option.');
  });
  it('passes with free shipping and no amounts', () => {
    expect(validateWizardStep(5, base({ shippingFee: 'free' }), noImages)).toBeNull();
  });
  it('needs an amount for each chosen option when the buyer pays', () => {
    const buyerPays = { shippingFee: 'buyer_pays', shippingOptions: ['standard', 'express'] };
    expect(validateWizardStep(5, base({ ...buyerPays, shippingFeeAmounts: { standard: '5' } }), noImages))
      .toBe('Enter a shipping fee amount for each selected delivery option.');
    expect(validateWizardStep(5, base({ ...buyerPays, shippingFeeAmounts: { standard: '5', express: '  ' } }), noImages))
      .toBe('Enter a shipping fee amount for each selected delivery option.');
    expect(validateWizardStep(5, base({ ...buyerPays, shippingFeeAmounts: { standard: '5', express: 'abc' } }), noImages))
      .toBe('Enter a valid fee amount for each delivery option.');
    expect(validateWizardStep(5, base({ ...buyerPays, shippingFeeAmounts: { standard: '5', express: '15' } }), noImages)).toBeNull();
  });
  it('accepts an amount of 0 when the buyer pays', () => {
    expect(validateWizardStep(5, base({ shippingFee: 'buyer_pays', shippingFeeAmounts: { standard: '0' } }), noImages)).toBeNull();
  });
});

describe('other steps', () => {
  it('has no check on steps without a rule', () => {
    expect(validateWizardStep(6, base({ name: '', category: '' }), noImages)).toBeNull();
  });
});
