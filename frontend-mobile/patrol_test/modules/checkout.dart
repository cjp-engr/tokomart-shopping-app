import 'package:flutter/rendering.dart';
import 'package:patrol/patrol.dart';
import 'package:toko_mart/keys.dart';

import 'module.dart';

final class Checkout extends Module {
  Checkout(super.$);

  Future<void> proceedToCheckout() async {
    await $(keys.cart.checkoutButton).tap();
  }

  Future<void> fillShippingAddress({
    String street = '123 Test Street',
    String city = 'Manila',
    String state = 'Metro Manila',
    String zip = '1000',
  }) async {
    await $(keys.orders.checkoutNewAddressOption).scrollTo().tap();
    await $(keys.orders.checkoutStreetField).scrollTo().enterText(street);
    await $(keys.orders.checkoutCityField).scrollTo().enterText(city);
    await $(keys.orders.checkoutStateField).scrollTo().enterText(state);
    await $(keys.orders.checkoutZipField).scrollTo().enterText(zip);
  }

  Future<void> selectCOD() async {
    await $(keys.orders.paymentOption('cash-on-delivery'))
        .scrollTo(scrollDirection: AxisDirection.down)
        .tap();
  }

  Future<void> selectCreditCard() async {
    await $(keys.orders.paymentOption('credit-card'))
        .scrollTo(scrollDirection: AxisDirection.down)
        .tap();
  }

  Future<void> placeOrder() async {
    await $(keys.orders.placeOrderButton)
        .scrollTo(scrollDirection: AxisDirection.down)
        .tap();
  }

  Future<void> selectSavedCard({required String cardId}) async {
    $.log('Choosing the saved card $cardId');
    await $(keys.orders.paymentSavedCardsTab).scrollTo().tap();
    await $(keys.orders.savedPaymentCard(cardId)).scrollTo().tap();
  }

  Future<void> enterNativeStripeCard({
    String cardNumber = '4242424242424242',
    String expiry = '1230',
    String cvc = '123',
    String postalCode = '10001',
  }) async {
    $.log('Entering the Stripe test card in the native payment sheet');
    await _enterNativeText('et_card_number', cardNumber);
    await _enterNativeText('et_expiry', expiry);
    await _enterNativeText('et_cvc', cvc);
    await _enterNativeText('postal_code', postalCode);
  }

  Future<void> submitPayment() async {
    $.log('Submitting the payment');
    await $(keys.orders.paymentSubmitButton).scrollTo().tap();
  }

  Future<void> expectOrdersScreen({Duration? timeout}) async {
    await $(keys.orders.ordersScreen).waitUntilVisible(timeout: timeout);
  }

  Future<void> _enterNativeText(String viewId, String text) async {
    await $.platform.android.enterText(
      AndroidSelector(resourceName: 'com.example.TokoMart:id/$viewId'),
      text: text,
      keyboardBehavior: KeyboardBehavior.alternative,
    );
  }
}
