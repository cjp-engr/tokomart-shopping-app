// TC-103: buyer completes new credit checkout with variant product
// Opt-in local run: needs LOCAL_PAYMENT_VERIFICATION=true (the isolated API on 10.0.2.2:5001 and Stripe test mode).
// The card is typed into the native Stripe sheet.
// Tags: checkout-variant-new-cc, local-stripe-verification, tc-103
import '../modules/local_payment_api.dart';
import '../test_app.dart';
import '../test_credentials.dart';

void main() {
  if (!localPaymentVerificationEnabled) return;
  testApp('TC-103: buyer completes new credit checkout with variant product',
      initializeStripe: true,
      tags: ['checkout-variant-new-cc', 'local-stripe-verification', 'tc-103'],
      ($, modules) async {
    final api = LocalPaymentApi();
    await api.loginBuyer();
    await api.emptyCart();
    final before = await api.orderIds();
    await modules.auth.login(
        email: TestCredentials.buyerEmail, password: TestCredentials.password);
    await modules.products.addVariantProductToCart('E2E Test Variant Tee');
    await modules.products.navigateToCart();
    await modules.checkout.proceedToCheckout();
    await modules.checkout.fillShippingAddress();
    await modules.checkout.selectCreditCard();
    await modules.checkout.placeOrder();
    await modules.checkout.enterNativeStripeCard();
    await modules.checkout.submitPayment();
    await modules.checkout
        .expectOrdersScreen(timeout: const Duration(seconds: 90));
    await api.verifyAuthorizedOrders(
        previousOrderIds: before,
        sellerCount: 1,
        selectedAttributes: {'Size': 'M'});
    api.close();
  });
}
