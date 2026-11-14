// TC coverage: TC-180 (buyer cancels a pending order), in part: a card order, confirmed without a reason.
// Opt-in local run: needs LOCAL_PAYMENT_VERIFICATION=true and nothing else: the test creates its own pending card order through the API (set LOCAL_CANCEL_ORDER_ID to cancel a given order instead; docs/local-payment-verification.md).
// Tags: local-stripe-verification, tc-180
import '../modules/local_payment_api.dart';
import '../test_app.dart';
import '../test_credentials.dart';

void main() {
  if (!localPaymentVerificationEnabled) return;
  testApp(
      'TC-180: Local manual capture: buyer cancels and sees the reservation released',
      tags: ['local-stripe-verification', 'tc-180'], ($, modules) async {
    LocalPaymentApi.requireLocalApi();
    final orderId = localCancelOrderId.isNotEmpty
        ? localCancelOrderId
        : await modules.orders.createPendingCardOrderThroughApi();
    await modules.auth.login(
        email: TestCredentials.buyerEmail, password: TestCredentials.password);
    await modules.orders.openOrdersTab();
    await modules.orders.openOrderDetails(orderId: orderId);
    await modules.orders.cancelOrderAndConfirm();
    await modules.orders.expectPaymentNoticeTitle('Reservation released');
  });
}
