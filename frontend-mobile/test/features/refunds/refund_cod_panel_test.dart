import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:toko_mart/features/refunds/data/refund_api.dart';
import 'package:toko_mart/features/refunds/data/refund_models.dart';
import 'package:toko_mart/features/refunds/presentation/refund_request_panel.dart';
import 'package:toko_mart/keys.dart';

class MockRefundApi extends Mock implements RefundApi {}

RefundEligibility _notRefundable(String reason) => RefundEligibility.fromJson(
    {'eligible': false, 'requestsEnabled': true, 'reason': reason});

void main() {
  late MockRefundApi api;

  setUp(() {
    api = MockRefundApi();
    when(() => api.history('o')).thenAnswer((_) async => []);
  });

  Future<void> pumpPanel(WidgetTester tester, {String? paymentType}) async {
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: SingleChildScrollView(
                child: RefundRequestPanel(
                    orderId: 'o', api: api, paymentType: paymentType)))));
    await tester.pumpAndSettle();
  }

  testWidgets(
      'a Cash on Delivery order shows the inspect-before-paying notice and no refund policy',
      (tester) async {
    when(() => api.eligibility('o'))
        .thenAnswer((_) async => _notRefundable('unsupported_payment'));
    await pumpPanel(tester, paymentType: 'cash-on-delivery');

    expect(find.byKey(keys.orders.cashOnDeliveryNotice), findsOneWidget);
    expect(find.text(cashOnDeliveryNoRefundNotice), findsOneWidget);
    expect(find.text('Refund policy & shipping'), findsNothing);
  });

  testWidgets(
      'a card order that cannot be refunded any more keeps the refund policy',
      (tester) async {
    when(() => api.eligibility('o'))
        .thenAnswer((_) async => _notRefundable('window_closed'));
    await pumpPanel(tester, paymentType: 'credit-card');

    expect(find.text('The seven-day refund request window has ended.'),
        findsOneWidget);
    expect(find.text('Refund policy & shipping'), findsOneWidget);
    expect(find.byKey(keys.orders.cashOnDeliveryNotice), findsNothing);
  });
}
