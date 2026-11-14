// TC coverage: TC-182 (seller accepts a pending card order), in part: the test taps Accept and the API confirms capture.
// Opt-in local run: needs LOCAL_PAYMENT_VERIFICATION=true and nothing else: the test creates its own pending card order through the API (set LOCAL_ACCEPT_ORDER_ID to accept a given order instead; docs/local-payment-verification.md).
// Tags: local-stripe-verification, tc-182
import '../modules/local_payment_api.dart';
import '../test_app.dart';
import '../test_credentials.dart';

void main() {
  if (!localPaymentVerificationEnabled) return;
  testApp('TC-182: Local manual capture: seller accepts Android checkout',
      tags: ['local-stripe-verification', 'tc-182'], ($, modules) async {
    LocalPaymentApi.requireLocalApi();
    final orderId = localAcceptOrderId.isNotEmpty
        ? localAcceptOrderId
        : await modules.orders.createPendingCardOrderThroughApi();
    await modules.auth.login(
        email: TestCredentials.sellerEmail, password: TestCredentials.password);
    await modules.seller.navigateToDashboard();
    await modules.seller.acceptOrderAndStartPreparing(orderId: orderId);
    await LocalPaymentApi.expectOrderPreparingAndCaptured(orderId: orderId);
  });
}
