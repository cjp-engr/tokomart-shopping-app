import { Info } from 'lucide-react';
import { cashOnDeliveryNoRefundNotice, cashOnDeliveryNoticeTitle } from '../../utils/refund';

/** Shown under Cash on Delivery at checkout: inspect the items before accepting the order and paying. */
export function CashOnDeliveryNotice() {
  return (
    <div
      data-testid="cod-inspect-notice"
      role="note"
      className="flex items-start gap-3 p-4 mb-5 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100"
    >
      <Info className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden />
      <div>
        <p className="font-semibold">{cashOnDeliveryNoticeTitle}</p>
        <p className="mt-1">{cashOnDeliveryNoRefundNotice}</p>
      </div>
    </div>
  );
}
