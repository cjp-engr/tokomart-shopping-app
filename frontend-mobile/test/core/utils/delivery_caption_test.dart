import 'package:flutter_test/flutter_test.dart';
import 'package:toko_mart/core/utils/order_utils.dart';

void main() {
  group('deliveryCaption', () {
    test('a delivered order shows the day it was delivered, not the estimate',
        () {
      final caption = deliveryCaption(
          status: 'delivered',
          estimatedDelivery: '2026-11-28T12:00:00Z',
          deliveredAt: DateTime.utc(2026, 11, 21, 12));
      expect(caption.label, 'Delivered on');
      expect(caption.date, 'Nov 21, 2026');
    });

    test('an order that is not delivered yet keeps the estimate', () {
      for (final status in ['pending', 'preparing', 'processing', 'shipped']) {
        final caption = deliveryCaption(
            status: status, estimatedDelivery: '2026-11-28T12:00:00Z');
        expect(caption.label, 'Estimated Delivery', reason: status);
        expect(caption.date, 'Nov 28, 2026', reason: status);
      }
    });

    test(
        'a delivered order without a recorded delivery date falls back to the estimate',
        () {
      final caption = deliveryCaption(
          status: 'delivered', estimatedDelivery: '2026-11-28T12:00:00Z');
      expect(caption.label, 'Estimated Delivery');
      expect(caption.date, 'Nov 28, 2026');
    });
  });
}
