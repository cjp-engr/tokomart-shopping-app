import { Button } from '../common/Button';
import { canBuyerCancel } from '../../utils/orderPayment';
import type { Order } from '../../types/order';

/** The "Cancel Order" button on a buyer's order card, shown only while the order can still be cancelled. */
export function CancelOrderButton({ order, onCancel }: { order: Order; onCancel: () => void }) {
  if (!canBuyerCancel(order)) return null;
  return (
    <Button variant="danger" size="sm" onClick={onCancel}>
      Cancel Order
    </Button>
  );
}
