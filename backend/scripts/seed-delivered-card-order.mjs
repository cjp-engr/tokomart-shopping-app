// Seeds one DELIVERED card order, paid in Stripe test mode, for the opt-in TC-164 refund journey.
//
//   DELIVERED_REFUND_DB_URI=mongodb://127.0.0.1:27018/<name>_test?replicaSet=rs0&directConnection=true \
//     node --import tsx scripts/seed-delivered-card-order.mjs <buyer-email> <seller-email>
//
// It prints one JSON line: { orderId, productId, productName, buyerId, sellerId }.
// Safety: it refuses any database that is not on localhost port 27018 with a name ending in `_test`, and any Stripe
// key that is not a test key. Never run it against the standalone database on port 27017.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Stripe from 'stripe';

const [buyerEmail, sellerEmail] = process.argv.slice(2);
if (!buyerEmail || !sellerEmail) throw new Error('Usage: seed-delivered-card-order.mjs <buyer-email> <seller-email>');
const uri = process.env.DELIVERED_REFUND_DB_URI;
if (!uri) throw new Error('DELIVERED_REFUND_DB_URI is required');
const target = new URL(uri.replace(/^mongodb:/, 'http:'));
assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname), 'The database must be on localhost');
assert.equal(target.port, '27018', 'The database must be the test replica set on port 27018');
assert.match(target.pathname, /_test$/, 'The database name must end with _test');

const env = dotenv.parse(fs.readFileSync(new URL('../.env', import.meta.url)));
const key = process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY;
if (!key?.startsWith('sk_test_')) throw new Error('A Stripe test secret key is required');
process.env.STRIPE_SECRET_KEY = key;
process.env.DELIVERED_REFUNDS_ENABLED = 'true';
process.env.SELLER_SEES_MANUAL_CAPTURE = 'true';
const stripe = new Stripe(key);

const { default: Order } = await import('../src/models/Order.ts');
const { default: Product } = await import('../src/models/Product.ts');
const { default: User } = await import('../src/models/User.ts');
const { default: CheckoutSession } = await import('../src/models/CheckoutSession.ts');
const { acceptOrder } = await import('../src/services/orderAcceptance.ts');
const { updateSellerOrderStatus } = await import('../src/services/sellerService.ts');
const { confirmOrderReceived } = await import('../src/services/orderService.ts');

try {
  await mongoose.connect(uri);
  assert.ok((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'The database must be a replica set');
  const buyer = await User.findOne({ email: buyerEmail });
  const seller = await User.findOne({ email: sellerEmail });
  assert.ok(buyer, `No buyer with that email in ${target.pathname.slice(1)}`);
  assert.ok(seller, `No seller with that email in ${target.pathname.slice(1)}`);
  const buyerId = buyer._id; const sellerId = seller._id;
  const oid = new mongoose.Types.ObjectId(); const sid = new mongoose.Types.ObjectId();

  const product = await Product.create({
    sellerId, name: `E2E refund journey ${Date.now()}`, description: 'Stripe test fixture only', category: 'Home & Garden',
    price: 10, image: 'test.png', stock: 8, soldCount: 2,
  });
  const order = await Order.create({
    _id: oid, userId: buyerId, sellerId, checkoutSessionId: sid.toString(),
    items: [{ product: product._id, productName: product.name, productPrice: 10, quantity: 2, productImage: 'test.png' }],
    shippingAddress: { street: 'Test address', city: 'Test city', state: 'Test state', zipCode: '100', country: 'PH' },
    paymentMethod: { type: 'credit-card', last4: '4242' }, subtotal: 20, productDiscount: 0, discount: 0, tax: 1.6, shipping: 5, total: 26.6,
    status: 'awaiting_payment', paymentFlowVersion: 'manual_capture', paymentStatus: 'awaiting_authorization', amountMinor: 2660, currency: 'usd',
  });
  const intent = await stripe.paymentIntents.create({
    amount: 2660, currency: 'usd', capture_method: 'manual', payment_method: 'pm_card_visa', payment_method_types: ['card'], confirm: true,
    metadata: { checkoutSessionId: sid.toString(), sellerId: sellerId.toString(), draftOrderId: order.id },
  }, { idempotencyKey: `e2e-refund-journey:${order.id}` });
  assert.equal(intent.livemode, false);
  assert.equal(intent.status, 'requires_capture');
  await CheckoutSession.create({
    _id: sid, buyerId, idempotencyKey: order.id, requestHash: order.id, status: 'placed', expiresAt: new Date(Date.now() + 3600000),
    sellers: [{ sellerId, draftOrderId: oid, amountMinor: 2660, currency: 'usd', paymentIntentId: intent.id, status: 'authorized' }],
    stockReservations: [{ productId: product._id, quantity: 2 }],
  });
  await Order.updateOne({ _id: oid }, { $set: {
    status: 'pending', paymentStatus: 'authorized', paymentIntentId: intent.id,
    authorizedAt: new Date(), placedAt: new Date(), acceptBy: new Date(Date.now() + 3600000), authorizationExpiresAt: new Date(Date.now() + 86400000),
  } });
  assert.equal((await acceptOrder({ orderId: order.id, sellerId: sellerId.toString() })).kind, 'completed');
  await updateSellerOrderStatus(order.id, sellerId.toString(), 'processing');
  await updateSellerOrderStatus(order.id, sellerId.toString(), 'shipped');
  await confirmOrderReceived(order.id, buyerId.toString());

  console.log(JSON.stringify({ orderId: order.id, productId: product.id, productName: product.name, buyerId: buyerId.toString(), sellerId: sellerId.toString() }));
} finally {
  await mongoose.disconnect();
}
