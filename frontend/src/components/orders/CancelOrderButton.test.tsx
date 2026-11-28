import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CancelOrderButton } from './CancelOrderButton';
import type { Order } from '../../types/order';

// The "Cancel Order" button on a buyer's order card (REQ-CAN-01, REQ-CAN-02): it follows `canBuyerCancel`.
function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1', userId: 'u1', items: [], status: 'pending', paymentMethod: { type: 'cash-on-delivery' },
    paymentFlowVersion: 'legacy', paymentStatus: 'not_required', ...overrides,
  } as unknown as Order;
}
const render = (o: Order) => renderToStaticMarkup(<CancelOrderButton order={o} onCancel={vi.fn()} />);

describe('the buyer cancel button', () => {
  it('is shown on a pending Cash on Delivery order', () => {
    expect(render(order())).toContain('Cancel Order');
  });

  it('is shown on a pending card order whose payment is only reserved', () => {
    expect(render(order({ paymentMethod: { type: 'credit-card' }, paymentFlowVersion: 'manual_capture', paymentStatus: 'authorized' } as Partial<Order>))).toContain('Cancel Order');
  });

  it('is shown on a pending legacy order with no payment status', () => {
    expect(render(order({ paymentFlowVersion: 'legacy', paymentStatus: undefined }))).toContain('Cancel Order');
  });

  it.each(['preparing', 'processing', 'shipped', 'delivered', 'cancelled'])('is hidden once the order is %s', (status) => {
    expect(render(order({ status } as Partial<Order>))).toBe('');
  });

  it('is hidden while the seller is capturing the payment (the seller already took the order)', () => {
    expect(render(order({ paymentMethod: { type: 'credit-card' }, paymentFlowVersion: 'manual_capture', paymentStatus: 'capture_pending' } as Partial<Order>))).toBe('');
  });

  it.each(['refund_pending', 'refunded', 'failed'])('is hidden when the payment is %s', (paymentStatus) => {
    expect(render(order({ paymentStatus } as Partial<Order>))).toBe('');
  });
});
