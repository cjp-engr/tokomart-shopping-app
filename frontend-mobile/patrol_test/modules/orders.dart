import 'package:patrol/patrol.dart';
import 'package:toko_mart/keys.dart';

import 'local_payment_api.dart';
import 'module.dart';

final class Orders extends Module {
  Orders(super.$);

  Future<String> createPendingCardOrderThroughApi() async {
    $.log('Creating a pending card order through the API');
    final orderId = await LocalPaymentApi.createPendingCardOrder();
    $.log('Created pending card order $orderId');
    return orderId;
  }

  Future<String> createAcceptedCardOrderThroughApi() async {
    $.log(
        'Creating a card order through the API and accepting it as the seller');
    final orderId = await LocalPaymentApi.createAcceptedCardOrder();
    $.log('Created and accepted card order $orderId');
    return orderId;
  }

  Future<void> openOrdersTab() async {
    $.log('Opening the buyer Orders tab');
    await $(keys.orders.ordersNavTab).tap();
  }

  Future<void> openOrderDetails({required String orderId}) async {
    $.log('Opening the details of order $orderId');
    await $(keys.orders.orderCard(orderId)).scrollTo().tap();
  }

  Future<void> cancelOrderAndConfirm() async {
    $.log('Cancelling the order and confirming the dialog');
    await $(keys.orders.cancelOrderButton).scrollTo().tap();
    await $(keys.widgets.dialogConfirmButton).tap();
  }

  Future<void> expectPaymentNoticeTitle(String title) async {
    $.log('Expecting the payment notice "$title"');
    await (await $(keys.orders.paymentNoticeTitle(title)).scrollTo())
        .waitUntilVisible();
  }
}
