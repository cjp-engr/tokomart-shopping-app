import { refundButton, refundField, refundSecondary } from '../orders/RefundPresentation';
import type { RefundRequest } from '../../types/refund';
import { refundMoney } from '../../utils/refund';

interface RefundDecisionProps {
  request: RefundRequest;
  /** The seller pressed Reject request and is typing the reason. */
  rejecting: boolean;
  reason: string;
  /** A decision is being saved or the list is loading. */
  disabled: boolean;
  onReasonChange: (reason: string) => void;
  /** First press starts the rejection (asks for a reason); the press after that confirms it. */
  onReject: () => void;
  onApprove: () => void;
}

/** What the seller can do with one request on the Return/Refund tab: approve, reject with a reason, or read why not. */
export function RefundDecision({ request, rejecting, reason, disabled, onReasonChange, onReject, onApprove }: RefundDecisionProps) {
  if (request.state !== 'requested') return null;
  if (!request.canDecide) {
    return <p className="border-t border-gray-100 px-5 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">Refund decisions are currently unavailable.</p>;
  }
  return (
    <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-700">
      <p className="mb-4 text-xs leading-relaxed text-gray-600 dark:text-gray-300">Approval starts the refund immediately. The buyer keeps the item.</p>
      {rejecting && (
        <label className="mb-4 block text-sm font-semibold">
          Reason for rejecting
          <textarea
            aria-label={`Rejection reason for ${request.id}`} disabled={disabled} maxLength={1000}
            value={reason} onChange={e => onReasonChange(e.target.value)}
            className={refundField} autoFocus
          />
        </label>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className={refundSecondary} disabled={disabled || (rejecting && !reason.trim())} onClick={onReject}>
          {rejecting ? 'Confirm rejection' : 'Reject request'}
        </button>
        <button type="button" className={refundButton} disabled={disabled} onClick={onApprove}>
          Approve {refundMoney(request.amountMinor, request.currency)}
        </button>
      </div>
    </div>
  );
}
