import 'package:flutter_test/flutter_test.dart';
import 'package:toko_mart/features/refunds/data/refund_models.dart';

void main() {
  test('shipping requires all remaining units and a seller-fault reason', () {
    final view = RefundEligibility.fromJson({
      'shippingRefundableMinor': 500,
      'lines': [
        {
          'lineId': 'a',
          'quantityAvailable': 2,
          'availableUnitAmountsMinor': [1080, 1079]
        }
      ]
    });
    expect(view.quote({'a': 1}, reason: 'damaged'), 1080);
    expect(view.quote({'a': 2}, reason: 'damaged'), 2659);
    expect(view.quote({'a': 2}, reason: 'other'), 2159);
    expect(view.shippingQuote({'a': 2}, 'wrong_item'), 500);
    expect(view.shippingQuote({'a': 3}, 'damaged'), 0);
    expect(refundReasons.containsKey('change_of_mind'), isFalse);
    expect(RefundRequestData.fromJson({'shippingMinor': 500}).shipping, 500);
    expect(RefundRequestData.fromJson({}).shipping, 0);
  });
  test('quotes selected unit amounts, keeping remainder cents deterministic',
      () {
    final view = RefundEligibility.fromJson({
      'eligible': true,
      'requestsEnabled': true,
      'currency': 'usd',
      'lines': [
        {
          'lineId': 'a',
          'productName': 'Mug',
          'quantityAvailable': 3,
          'availableUnitAmountsMinor': [34, 33, 33]
        },
      ]
    });
    expect(view.quote({'a': 2}), 67);
    expect(view.quote({'a': 4}), isNull);
    expect(view.quote({'other': 1}), isNull);
    expect(view.quote({'a': -1}), isNull);
  });
  test(
      'handles optional older fields and provider review states without promising settlement',
      () {
    final request = RefundRequestData.fromJson({
      'id': 'r',
      'state': 'needs_review',
      'amountMinor': 1080,
      'currency': 'usd',
      'units': []
    });
    expect(request.canDecide, isFalse);
    expect(request.stateLabel, 'Refund needs payment review');
    expect(RefundEligibility.fromJson({}).requestsEnabled, isFalse);
    expect(refundMoney(500, 'jpy'), contains('500'));
  });
  test(
      'tells Cash on Delivery buyers to inspect the items before they accept and pay',
      () {
    final message = refundEligibilityMessage('unsupported_payment',
        paymentType: 'cash-on-delivery');
    expect(message,
        contains('Cash on Delivery orders cannot be refunded in the app'));
    expect(message, contains('inspect your items'));
    expect(message, contains('right items'));
    expect(message, contains('damaged or missing'));
    expect(message, contains('decline the delivery'));
    const generic = 'This payment method does not support in-app refunds.';
    expect(
        refundEligibilityMessage('unsupported_payment', paymentType: 'paypal'),
        generic);
    expect(refundEligibilityMessage('unsupported_payment'), generic);
    expect(
        refundEligibilityMessage('window_closed',
            paymentType: 'cash-on-delivery'),
        'The seven-day refund request window has ended.');
    expect(refundEligibilityMessage('something_new'),
        'This order is not eligible for a refund request.');
  });
}
