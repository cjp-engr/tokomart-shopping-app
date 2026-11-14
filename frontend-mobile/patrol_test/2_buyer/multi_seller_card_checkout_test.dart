// TC-083: Multi-seller checkout creates separate orders (mobile), card leg: one authorized order and one hold per seller.
// Opt-in local run: needs LOCAL_PAYMENT_VERIFICATION=true (the isolated API on 10.0.2.2:5001 and Stripe test mode).
// The second seller's product is created through the API and removed at the end; the buyer's saved test card is created
// through the API when missing.
// Tags: checkout-multi-seller, checkout, local-stripe-verification, tc-083
import '../modules/api_clients.dart';
import '../modules/local_payment_api.dart';
import '../test_app.dart';
import '../test_credentials.dart';

void main() {
  if (!localPaymentVerificationEnabled) return;
  testApp(
      'TC-083: buyer completes multi-seller checkout with saved credit card',
      initializeStripe: true,
      tags: [
        'checkout-multi-seller',
        'checkout',
        'local-stripe-verification',
        'tc-083'
      ], ($, modules) async {
    final secondProductName =
        '$localPaymentSecondProductName ${DateTime.now().millisecondsSinceEpoch}';
    final secondSeller = SellerApiClient();
    await secondSeller.login(localSecondSellerEmail, TestCredentials.password);
    final secondProductId = await secondSeller.createSimpleProduct(
        secondProductName,
        image: localFixtureProductImage);
    final api = LocalPaymentApi();
    await api.loginBuyer();
    await api.prepareCart({localPaymentProductName, secondProductName});
    final cardId = await api.savedCardId();
    final before = await api.orderIds();
    await modules.auth.login(
        email: TestCredentials.buyerEmail, password: TestCredentials.password);
    await modules.products.openCartFromHome();
    await modules.checkout.proceedToCheckout();
    await modules.checkout.fillShippingAddress();
    await modules.checkout.selectCreditCard();
    await modules.checkout.placeOrder();
    await modules.checkout.selectSavedCard(cardId: cardId);
    await modules.checkout.submitPayment();
    await modules.checkout
        .expectOrdersScreen(timeout: const Duration(seconds: 90));
    await api.verifyAuthorizedOrders(previousOrderIds: before, sellerCount: 2);
    api.close();
    await secondSeller.deleteProduct(secondProductId);
  });
}
