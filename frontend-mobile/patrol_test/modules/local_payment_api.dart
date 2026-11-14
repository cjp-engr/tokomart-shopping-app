import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:toko_mart/core/config/api_config.dart';

import '../test_credentials.dart';

const localPaymentVerificationEnabled =
    bool.fromEnvironment('LOCAL_PAYMENT_VERIFICATION');
const localPaymentProductName = 'The Art of Programming';
const localPaymentSecondProductName = 'Local Verification Second Seller';
// The seller who owns the second product of the multi-seller checkout; the main fixture seller owns the first.
// An order item needs a product image, so a product bought in a checkout test must have one.
const localFixtureProductImage =
    'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500';
const localSecondSellerEmail =
    String.fromEnvironment('SECOND_SELLER_EMAIL', defaultValue: 's1@ex.com');

// One-time fixtures: fresh orders prepared by hand, see docs/local-payment-verification.md.
const localAcceptOrderId = String.fromEnvironment('LOCAL_ACCEPT_ORDER_ID');
const localCancelOrderId = String.fromEnvironment('LOCAL_CANCEL_ORDER_ID');
const localExpiredOrderId = String.fromEnvironment('LOCAL_EXPIRED_ORDER_ID');

/// API setup and assertions shared by the opt-in local Stripe UI tests.
/// Payment confirmation and buyer/seller actions still run through the UI.
final class LocalPaymentApi {
  LocalPaymentApi() {
    requireLocalApi();
  }

  final Dio _dio = Dio(BaseOptions(
    baseUrl: ApiConfig.baseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
  ));

  static void requireLocalApi() {
    final uri = Uri.parse(ApiConfig.baseUrl);
    if (uri.scheme != 'http' || uri.host != '10.0.2.2' || uri.port != 5001) {
      throw StateError(
          'Isolated local verification API on emulator port 5001 required');
    }
  }

  static String requireOrderId(String orderId) {
    if (orderId.isEmpty) {
      throw StateError('Explicit isolated local order required');
    }
    return orderId;
  }

  static Future<void> expectOrderPreparingAndCaptured({
    required String orderId,
  }) async {
    // ignore: avoid_print
    print(
        'Waiting up to 30 seconds for order $orderId to be preparing and captured');
    final api = LocalPaymentApi();
    try {
      await api.loginBuyer();
      await api.waitForCapture(orderId);
    } finally {
      api.close();
    }
  }

  /// Places a one-seller card order through the checkout session API, authorized with Stripe's published test card.
  static Future<String> createPendingCardOrder() async {
    final api = LocalPaymentApi();
    try {
      await api.loginBuyer();
      return await api._placeAuthorizedCardOrder();
    } finally {
      api.close();
    }
  }

  /// Like [createPendingCardOrder], then the seller accepts it through the API and the capture completes.
  static Future<String> createAcceptedCardOrder() async {
    final api = LocalPaymentApi();
    try {
      await api.loginBuyer();
      final orderId = await api._placeAuthorizedCardOrder();
      await api._acceptAsSeller(orderId);
      await api.waitForCapture(orderId);
      return orderId;
    } finally {
      api.close();
    }
  }

  Future<void> loginBuyer() async {
    final response = await _dio.post('/auth/login', data: {
      'email': TestCredentials.buyerEmail,
      'password': TestCredentials.password,
    });
    _dio.options.headers['Authorization'] = 'Bearer ${response.data['token']}';
  }

  Future<String> _placeAuthorizedCardOrder() async {
    final product = await _fixtureProduct();
    final created = await _dio.post(
      '/checkout/sessions',
      data: {
        'items': [
          {'productId': product['_id'], 'quantity': 1},
        ],
        'shippingAddress': {
          'street': '123 Test Street',
          'city': 'Manila',
          'state': 'Metro Manila',
          'zipCode': '1000',
          'phone': '+63 912 345 6789',
        },
        'paymentMethod': {'type': 'credit-card'},
      },
      options: Options(headers: {
        'Idempotency-Key':
            'local-fixture-${DateTime.now().microsecondsSinceEpoch}',
      }),
    );
    final session = _data(created.data);
    for (final seller in session['sellers'] as List) {
      await _authorizeWithTestCard(seller['clientSecret'] as String);
    }
    final confirmed =
        await _dio.post('/checkout/sessions/${session['id']}/confirm');
    final orders = _data(confirmed.data)['orders'] as List;
    if (orders.length != 1) {
      throw StateError('Expected exactly one order for the fixture product');
    }
    return orders.first['id'].toString();
  }

  Future<void> _acceptAsSeller(String orderId) async {
    final seller = Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
    ));
    try {
      final login = await seller.post('/auth/login', data: {
        'email': TestCredentials.sellerEmail,
        'password': TestCredentials.password,
      });
      seller.options.headers['Authorization'] = 'Bearer ${login.data['token']}';
      await seller
          .put('/seller/orders/$orderId/status', data: {'status': 'preparing'});
    } finally {
      seller.close();
    }
  }

  Future<Map<String, dynamic>> _fixtureProduct() async {
    final response = await _dio
        .get('/products', queryParameters: {'search': localPaymentProductName});
    final matches = (response.data['products'] as List)
        .where((product) => product['name'] == localPaymentProductName)
        .toList();
    if (matches.length != 1) {
      throw StateError('Local seller fixture product missing or duplicated');
    }
    return Map<String, dynamic>.from(matches.first as Map);
  }

  Future<void> _authorizeWithTestCard(String clientSecret) async {
    final publishableKey = await _publishableKey();
    final intentId = clientSecret.split('_secret_').first;
    final response = await Dio().post(
      'https://api.stripe.com/v1/payment_intents/$intentId/confirm',
      data: {
        'client_secret': clientSecret,
        'payment_method_data[type]': 'card',
        'payment_method_data[card][token]': 'tok_visa',
        'return_url': 'https://example.com/return',
      },
      options: Options(
        contentType: Headers.formUrlEncodedContentType,
        headers: {'Authorization': 'Bearer $publishableKey'},
      ),
    );
    if (response.data['status'] != 'requires_capture') {
      throw StateError('The test card did not reach requires_capture');
    }
  }

  static Map<String, dynamic> _data(dynamic body) {
    final map = Map<String, dynamic>.from(body as Map);
    final data = map['data'];
    return data is Map ? Map<String, dynamic>.from(data) : map;
  }

  Future<void> prepareCart(Set<String> productNames) async {
    final selected = <dynamic>[];
    var page = 1;
    var pages = 1;
    do {
      final response =
          await _dio.get('/products', queryParameters: {'page': page});
      final products = response.data['products'] as List;
      selected.addAll(
          products.where((product) => productNames.contains(product['name'])));
      pages = (response.data['pages'] as num).toInt();
      page += 1;
    } while (page <= pages);
    if (selected.length != productNames.length) {
      throw StateError('Local seller fixture products missing or duplicated');
    }
    await _dio.put('/cart', data: {
      'items': selected
          .map((product) => {
                'productId': product['_id'],
                'quantity': 1,
                'isSelected': true,
              })
          .toList(),
    });
  }

  /// The buyer's saved card; Stripe's published test card is saved first when the buyer has none.
  Future<String> savedCardId() async {
    var cards = await _savedCards();
    if (cards.isEmpty) {
      await _saveTestCard();
      cards = await _savedCards();
    }
    return cards.first['_id'].toString();
  }

  Future<List> _savedCards() async =>
      (await _dio.get('/auth/payment-methods')).data['data']['paymentMethods']
          as List;

  Future<void> _saveTestCard() async {
    final response = await Dio().post(
      'https://api.stripe.com/v1/payment_methods',
      data: {'type': 'card', 'card[token]': 'tok_visa'},
      options: Options(
        contentType: Headers.formUrlEncodedContentType,
        headers: {'Authorization': 'Bearer ${await _publishableKey()}'},
      ),
    );
    final card = response.data['card'] as Map;
    await _dio.post('/auth/payment-methods', data: {
      'type': 'credit-card',
      'brand': card['brand'],
      'last4': card['last4'],
      'cardHolder': 'Test Buyer',
      'expiryMonth': '${card['exp_month']}',
      'expiryYear': '${card['exp_year']}',
      'setAsDefault': true,
      'stripePaymentMethodId': response.data['id'],
    });
  }

  Future<void> emptyCart() async {
    await _dio.put('/cart', data: {'items': []});
  }

  Future<String> _publishableKey() async {
    if (!dotenv.isInitialized) await dotenv.load(fileName: '.env');
    final key = dotenv.env['STRIPE_PUBLISHABLE_KEY'] ?? '';
    if (!key.startsWith('pk_test_')) {
      throw StateError('A Stripe test publishable key is required');
    }
    return key;
  }

  Future<List<Map<String, dynamic>>> orders() async {
    final response = await _dio.get('/orders');
    return (response.data['orders'] as List)
        .map((order) => Map<String, dynamic>.from(order as Map))
        .toList();
  }

  Future<Set<String>> orderIds() async =>
      (await orders()).map((order) => order['_id'].toString()).toSet();

  Future<void> verifyAuthorizedOrders({
    required Set<String> previousOrderIds,
    required int sellerCount,
    Map<String, String>? selectedAttributes,
  }) async {
    final created = (await orders())
        .where((order) => !previousOrderIds.contains(order['_id']))
        .toList();
    if (created.length != sellerCount ||
        created.any((order) =>
            order['paymentStatus'] != 'authorized' ||
            order['paymentFlowVersion'] != 'manual_capture')) {
      throw StateError(
          'Expected one authorized manual-capture order per seller');
    }
    if (selectedAttributes != null &&
        !created
            .every((order) => _carriesAttributes(order, selectedAttributes))) {
      throw StateError('Expected each order item to carry $selectedAttributes');
    }
    for (final order in created) {
      // IDs correlate UI results with Stripe test records; never print secrets.
      // ignore: avoid_print
      print('LOCAL_MOBILE_ORDER ${order['_id']} ${order['paymentIntentId']}');
    }
  }

  bool _carriesAttributes(
      Map<String, dynamic> order, Map<String, String> selectedAttributes) {
    return (order['items'] as List).any((item) {
      final attributes = item['selectedAttributes'];
      return attributes is Map &&
          selectedAttributes.entries
              .every((entry) => attributes[entry.key] == entry.value);
    });
  }

  Future<void> waitForCapture(String orderId) async {
    final deadline = DateTime.now().add(const Duration(seconds: 30));
    while (true) {
      final order =
          (await orders()).firstWhere((order) => order['_id'] == orderId);
      if (order['status'] == 'preparing' &&
          order['paymentStatus'] == 'captured') {
        return;
      }
      if (DateTime.now().isAfter(deadline)) {
        throw StateError('Seller acceptance did not capture payment');
      }
      // Capture is asynchronous; poll the server until completion or timeout.
      await Future<void>.delayed(const Duration(milliseconds: 250));
    }
  }

  void close() => _dio.close();
}
