import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('../../services/refundService', () => ({ refundService: { eligibility: vi.fn(), history: vi.fn(), create: vi.fn() }, RefundApiError: class extends Error {} }));
import { RefundRequestPanel } from './RefundRequestPanel';

describe('refund panel on the order page', () => {
  it('has no refresh button; the refund details load when the page opens', () => {
    const html = renderToStaticMarkup(<RefundRequestPanel orderId="o" />);
    expect(html).toContain('Item refunds');
    expect(html).not.toContain('Refresh refunds');
    expect(html).not.toMatch(/<button/);
  });
});

describe('refund policy on the order page', () => {
  it('is shown for card orders and when the payment type is unknown', () => {
    expect(renderToStaticMarkup(<RefundRequestPanel orderId="o" paymentType="credit-card" />)).toContain('Refund policy');
    expect(renderToStaticMarkup(<RefundRequestPanel orderId="o" />)).toContain('Refund policy');
  });
  it('is not shown for Cash on Delivery orders, which cannot be refunded in the app', () => {
    const html = renderToStaticMarkup(<RefundRequestPanel orderId="o" paymentType="cash-on-delivery" />);
    expect(html).toContain('Item refunds');
    expect(html).not.toContain('Refund policy');
  });
});
