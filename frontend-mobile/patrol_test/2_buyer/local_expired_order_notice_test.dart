// TC coverage: TC-401 (an order the seller never accepted shows "Reservation released"), in part: the notice title only.
// Opt-in local run: needs LOCAL_PAYMENT_VERIFICATION=true and a fresh LOCAL_EXPIRED_ORDER_ID, an order whose acceptance deadline
// has passed after the automatic cancellation ran (docs/local-payment-verification.md).
// Tags: local-stripe-verification, tc-401
import '../modules/local_payment_api.dart';
import '../test_app.dart';
import '../test_credentials.dart';

void main() {
  if (!localPaymentVerificationEnabled) return;
  testApp(
      'TC-401: Local manual capture: buyer sees the reservation released on an expired order',
      tags: ['local-stripe-verification', 'tc-401'], ($, modules) async {
    LocalPaymentApi.requireLocalApi();
    final orderId = LocalPaymentApi.requireOrderId(localExpiredOrderId);
    await modules.auth.login(
        email: TestCredentials.buyerEmail, password: TestCredentials.password);
    await modules.orders.openOrdersTab();
    await modules.orders.openOrderDetails(orderId: orderId);
    await modules.orders.expectPaymentNoticeTitle('Reservation released');
  });
}
