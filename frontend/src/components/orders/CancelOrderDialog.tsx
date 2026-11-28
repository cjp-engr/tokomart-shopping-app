import { Button } from '../common/Button';

interface CancelOrderDialogProps {
  open: boolean;
  reason: string;
  /** The cancellation is being sent. */
  loading: boolean;
  error: string | null;
  onReasonChange: (reason: string) => void;
  onKeep: () => void;
  onConfirm: () => void;
}

/** The buyer's confirmation before cancelling an order; the reason is optional. */
export function CancelOrderDialog({ open, reason, loading, error, onReasonChange, onKeep, onConfirm }: CancelOrderDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Cancel Order</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to cancel this order? This action cannot be undone.
        </p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <textarea
          value={reason}
          onChange={e => onReasonChange(e.target.value)}
          placeholder="Reason for cancellation (optional)"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-red-400 mb-4"
        />
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onKeep} disabled={loading}>
            Keep Order
          </Button>
          <Button variant="danger" size="sm" loading={loading} onClick={onConfirm}>
            Yes, Cancel Order
          </Button>
        </div>
      </div>
    </div>
  );
}
