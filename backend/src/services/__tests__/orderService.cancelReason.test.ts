import { afterEach, describe, expect, it, vi } from 'vitest';
import Order from '../../models/Order.js';
import { cancelOrderAsBuyer } from '../orderService.js';

const orderId = '65a000000000000000000001';
const buyerId = '65a000000000000000000002';

afterEach(() => vi.restoreAllMocks());

/** The buyer's cancellation reason is checked before any order is read (REQ-CAN-01). */
describe('cancelOrderAsBuyer cancellation reason limit', () => {
  it('refuses a reason of 501 characters with 400 invalid_cancel_reason, before reading the order', async () => {
    const find = vi.spyOn(Order, 'findById');
    await expect(cancelOrderAsBuyer(orderId, buyerId, 'a'.repeat(501)))
      .rejects.toMatchObject({ statusCode: 400, code: 'invalid_cancel_reason', message: 'Cancellation reason must be text of at most 500 characters' });
    expect(find).not.toHaveBeenCalled();
  });

  it('refuses a reason that is not text', async () => {
    const find = vi.spyOn(Order, 'findById');
    await expect(cancelOrderAsBuyer(orderId, buyerId, 123 as unknown as string))
      .rejects.toMatchObject({ statusCode: 400, code: 'invalid_cancel_reason' });
    expect(find).not.toHaveBeenCalled();
  });

  it.each([
    ['500 characters (upper boundary)', 'a'.repeat(500)],
    ['an empty string', ''],
    ['no reason at all', undefined],
  ])('lets %s through to the order lookup', async (_label, reason) => {
    const find = vi.spyOn(Order, 'findById').mockResolvedValue(null as never);
    await expect(cancelOrderAsBuyer(orderId, buyerId, reason))
      .rejects.toMatchObject({ statusCode: 404, message: 'Order not found' });
    expect(find).toHaveBeenCalledTimes(1);
  });
});
