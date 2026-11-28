/**
 * The discount that `POST /api/coupons/validate` quotes for an order amount (REQ-CPN-03, REQ-CPN-05).
 *
 * A percentage coupon takes its share of the order amount, stopped at `maxDiscount` when there is one. A fixed coupon
 * takes its value. The amount is not capped at the order amount here (see TC-237 and TC-253); the order itself
 * does cap a fixed coupon (`applyCoupon` in `orderService.ts`).
 */
export function couponDiscountFor(
  coupon: { discountType: 'percentage' | 'fixed'; discountValue: number; maxDiscount?: number | null },
  orderAmount?: number | null,
): number {
  if (coupon.discountType === 'percentage') {
    const discount = (orderAmount ?? 0) * (coupon.discountValue / 100);
    return coupon.maxDiscount ? Math.min(discount, coupon.maxDiscount) : discount;
  }
  return coupon.discountValue;
}
