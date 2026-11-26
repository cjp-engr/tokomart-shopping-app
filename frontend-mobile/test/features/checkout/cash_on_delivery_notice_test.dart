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

  testWidgets('is not a bright cream box in dark mode', (tester) async {
    Color cardColor() => ((tester
            .widget<Container>(find.byKey(keys.orders.cashOnDeliveryNotice))
            .decoration) as BoxDecoration)
        .color!;

    await tester.pumpWidget(MaterialApp(
        theme: ThemeData.light(),
        home: const Scaffold(body: CashOnDeliveryNoticeCard())));
    expect(cardColor(), const Color(0xFFFFFBEB));

    await tester.pumpWidget(MaterialApp(
        theme: ThemeData.dark(),
        home: const Scaffold(body: CashOnDeliveryNoticeCard())));
    await tester.pumpAndSettle(); // the theme change animates
    expect(cardColor(), isNot(const Color(0xFFFFFBEB)));
    expect(cardColor().a, lessThan(0.3));
  });
}
