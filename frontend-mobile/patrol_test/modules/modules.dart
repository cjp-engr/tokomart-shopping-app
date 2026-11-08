import 'package:patrol/patrol.dart';

import 'auth.dart';
import 'checkout.dart';
import 'orders.dart';
import 'products.dart';
import 'seller.dart';

final class Modules {
  Modules(this._$);
  final PatrolIntegrationTester _$;

  late final auth = Auth(_$);
  late final checkout = Checkout(_$);
  late final orders = Orders(_$);
  late final products = Products(_$);
  late final seller = Seller(_$);
}
