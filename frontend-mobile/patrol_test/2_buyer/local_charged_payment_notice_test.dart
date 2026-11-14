// TC coverage: TC-179 (payment notices on order detail), in part: only "Payment charged".
// Opt-in local run: needs LOCAL_PAYMENT_VERIFICATION=true and nothing else: the test creates a card order through the API and has
// the seller accept it (set LOCAL_ACCEPT_ORDER_ID to use an already accepted order instead; docs/local-payment-verification.md).
// Tags: local-stripe-verification, tc-179
import '../modules/local_payment_api.dart';
import '../test_app.dart';
import '../test_credentials.dart';

void main() {
  if (!localPaymentVerificationEnabled) return;
  testApp(
      'TC-179: Local manual capture: buyer sees payment charged on an accepted order',
      tags: ['local-stripe-verification', 'tc-179'], ($, modules) async {
    LocalPaymentApi.requireLocalApi();
    final orderId = localAcceptOrderId.isNotEmpty
        ? localAcceptOrderId
        : await modules.orders.createAcceptedCardOrderThroughApi();
    await modules.auth.login(
        email: TestCredentials.buyerEmail, password: TestCredentials.password);
    await modules.orders.openOrdersTab();
    await modules.orders.openOrderDetails(orderId: orderId);
    await modules.orders.expectPaymentNoticeTitle('Payment charged');
  });
}
