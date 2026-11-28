import { describe, expect, it } from 'vitest';
import { couponDiscountFor } from '../couponRules.js';

// The discount `POST /api/coupons/validate` quotes (REQ-CPN-03, REQ-CPN-05).
describe('couponDiscountFor', () => {
  describe('a percentage coupon', () => {
    it.each([
      [10, 100, 10],
      [10, 49.5, 4.95],
      [100, 80, 80],
      [0, 80, 0],
    ])('takes %s%% of an order of $%s: $%s', (discountValue, orderAmount, expected) => {
      expect(couponDiscountFor({ discountType: 'percentage', discountValue }, orderAmount)).toBeCloseTo(expected, 10);
    });

    it('stops at the maximum discount (the cap, and one cent either side)', () => {
      const coupon = { discountType: 'percentage' as const, discountValue: 50, maxDiscount: 20 };
      expect(couponDiscountFor(coupon, 39.98)).toBeCloseTo(19.99, 10);
      expect(couponDiscountFor(coupon, 40)).toBe(20);
      expect(couponDiscountFor(coupon, 40.02)).toBe(20);
      expect(couponDiscountFor(coupon, 1000)).toBe(20);
    });

    it('has no cap when the maximum discount is missing or 0', () => {
      expect(couponDiscountFor({ discountType: 'percentage', discountValue: 50 }, 1000)).toBe(500);
      expect(couponDiscountFor({ discountType: 'percentage', discountValue: 50, maxDiscount: 0 }, 1000)).toBe(500);
    });

    it('quotes 0 when the order amount is not given', () => {
      expect(couponDiscountFor({ discountType: 'percentage', discountValue: 10 })).toBe(0);
    });

    // Current behaviour, recorded rather than approved: a percentage over 100 is not capped (TC-253).
    it('does not cap a percentage over 100 at the order amount (current behaviour, TC-253)', () => {
      expect(couponDiscountFor({ discountType: 'percentage', discountValue: 150 }, 100)).toBe(150);
    });
  });

  describe('a fixed coupon', () => {
    it('takes the fixed amount', () => {
      expect(couponDiscountFor({ discountType: 'fixed', discountValue: 5 }, 100)).toBe(5);
    });
    it('ignores the maximum discount, which only applies to percentages', () => {
      expect(couponDiscountFor({ discountType: 'fixed', discountValue: 5, maxDiscount: 2 }, 100)).toBe(5);
    });
    // Current behaviour, recorded rather than approved: the quote is not capped at the order amount (TC-237).
    // The order itself is: `applyCoupon` in `orderService.ts` uses Math.min(value, subtotal).
    it('does not cap the fixed amount at the order amount (current behaviour, TC-237)', () => {
      expect(couponDiscountFor({ discountType: 'fixed', discountValue: 50 }, 20)).toBe(50);
    });
  });
});
