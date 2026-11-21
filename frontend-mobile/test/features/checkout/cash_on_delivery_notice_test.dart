import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toko_mart/features/checkout/widgets/cash_on_delivery_notice.dart';
import 'package:toko_mart/features/refunds/data/refund_models.dart';
import 'package:toko_mart/keys.dart';

void main() {
  testWidgets(
      'tells the buyer to inspect the items before they accept and pay, with the same wording as the refund section',
      (tester) async {
    await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: CashOnDeliveryNoticeCard())));

    expect(find.byKey(keys.orders.cashOnDeliveryNotice), findsOneWidget);
    expect(find.text(cashOnDeliveryNoticeTitle), findsOneWidget);
    expect(find.text('Inspect before you pay'), findsOneWidget);
    expect(find.text(cashOnDeliveryNoRefundNotice), findsOneWidget);
    expect(find.textContaining('inspect your items'), findsOneWidget);
    expect(find.textContaining('damaged or missing'), findsOneWidget);
    expect(find.textContaining('decline the delivery'), findsOneWidget);
  });
}
