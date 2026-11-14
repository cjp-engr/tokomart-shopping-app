// TC-097: buyer completes checkout with new credit card
// Opt-in local run: needs LOCAL_PAYMENT_VERIFICATION=true (the isolated API on 10.0.2.2:5001 and Stripe test mode).
// The card is typed into the native Stripe sheet.
// Tags: checkout-new-cc, checkout, local-stripe-verification, tc-097
import '../modules/local_payment_api.dart';
import '../test_app.dart';
import '../test_credentials.dart';

void main() {
  if (!localPaymentVerificationEnabled) return;
  testApp('TC-097: buyer completes checkout with new credit card',
      initializeStripe: true,
      tags: [
        'checkout-new-cc',
        'checkout',
        'local-stripe-verification',
        'tc-097'
      ], ($, modules) async {
    final api = LocalPaymentApi();
    await api.loginBuyer();
    await api.emptyCart();
    final before = await api.orderIds();
    await modules.auth.login(
        email: TestCredentials.buyerEmail, password: TestCredentials.password);
    await modules.products.addSimpleProductToCart('The Art of Programming');
    await modules.products.navigateToCart();
    await modules.checkout.proceedToCheckout();
    await modules.checkout.fillShippingAddress();
    await modules.checkout.selectCreditCard();
    await modules.checkout.placeOrder();
    await modules.checkout.enterNativeStripeCard();
    await modules.checkout.submitPayment();
    await modules.checkout
        .expectOrdersScreen(timeout: const Duration(seconds: 90));
    await api.verifyAuthorizedOrders(previousOrderIds: before, sellerCount: 1);
    api.close();
  });
}
