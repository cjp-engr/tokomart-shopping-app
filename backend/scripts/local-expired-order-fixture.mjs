// Run with: node --import tsx scripts/local-expired-order-fixture.mjs
// Creates one card order through the checkout session API, moves its acceptance deadline into the past, waits for the
// running backend's acceptance scanner to cancel it and release the hold, then prints the order id.
// Intentionally fixed to the isolated local verification API and database; it must not target hosted data.
import crypto from 'node:crypto';
import fs from 'node:fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import Order from '../src/models/Order.ts';

const verificationDatabase = 'mongodb://127.0.0.1:27018/tokomart_local_payments_20261017?replicaSet=rs0';
const api = 'http://localhost:5001/api';
const productName = 'The Art of Programming';
const pollEveryMs = 5000;

const config = dotenv.parse(fs.readFileSync(new URL('../.env', import.meta.url)));
if (!config.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  throw new Error('Stripe test key required');
}
const stripe = new Stripe(config.STRIPE_SECRET_KEY, { maxNetworkRetries: 0, timeout: 15000 });
const scannerIntervalMs = Number(config.ACCEPTANCE_SCAN_INTERVAL_MS) || 60 * 1000;

// The buyer is the seeded test account the Patrol tests use; read it from the shared defaults, never print it.
const credentials = fs.readFileSync(new URL('../../frontend-mobile/patrol_test/test_credentials.dart', import.meta.url), 'utf8');
const credential = (name, fallback) =>
  process.env[name] ?? new RegExp(`'${name}',\\s*defaultValue:\\s*'([^']*)'`).exec(credentials)?.[1] ?? fallback;

async function call(path, { method = 'GET', token, body, headers = {} } = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${json.error?.code ?? json.message ?? 'no detail'}`);
  }
  return json.data ?? json;
}

async function placeAuthorizedOrder() {
  const login = await call('/auth/login', {
    method: 'POST',
    body: { email: credential('BUYER_EMAIL'), password: credential('TEST_PASSWORD') },
  });
  const token = login.token;
  const search = await call(`/products?search=${encodeURIComponent(productName)}`);
  const matches = (search.products ?? []).filter(product => product.name === productName);
  if (matches.length !== 1) throw new Error('The fixture product is missing or duplicated');

  const session = await call('/checkout/sessions', {
    method: 'POST',
    token,
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: {
      items: [{ productId: matches[0]._id, quantity: 1 }],
      shippingAddress: { street: '123 Test Street', city: 'Manila', state: 'Metro Manila', zipCode: '1000', phone: '+63 912 345 6789' },
      paymentMethod: { type: 'credit-card' },
    },
  });
  for (const seller of session.sellers) {
    const intent = await stripe.paymentIntents.confirm(seller.clientSecret.split('_secret_')[0], {
      payment_method: 'pm_card_visa',
      return_url: 'https://example.com/return',
    });
    if (intent.livemode) throw new Error('Unexpected live-mode payment');
    if (intent.status !== 'requires_capture') throw new Error(`The test card ended in ${intent.status}`);
  }
  const confirmed = await call(`/checkout/sessions/${session.id}/confirm`, { method: 'POST', token });
  if (confirmed.orders?.length !== 1) throw new Error('Expected exactly one order for the fixture product');
  return confirmed.orders[0].id;
}

await fetch(`${api.replace(/\/api$/, '')}/health`).then(
  response => { if (!response.ok) throw new Error('The local API on port 5001 is not healthy'); },
  () => { throw new Error('The local API on port 5001 is not running'); },
);
await mongoose.connect(verificationDatabase);
try {
  const orderId = await placeAuthorizedOrder();
  console.log(`Created pending card order ${orderId}`);

  const moved = await Order.updateOne(
    { _id: orderId, status: 'pending', paymentFlowVersion: 'manual_capture', paymentStatus: 'authorized' },
    { $set: { acceptBy: new Date(Date.now() - 1000) } },
  );
  if (moved.modifiedCount !== 1) throw new Error('No eligible local order matched');
  console.log(`Moved its acceptance deadline into the past; waiting up to ${Math.round((scannerIntervalMs * 2 + 30000) / 1000)} s for the scanner`);

  const deadline = Date.now() + scannerIntervalMs * 2 + 30000;
  let order;
  while (Date.now() < deadline) {
    order = await Order.findById(orderId).lean();
    if (order?.status === 'cancelled' && order.paymentStatus === 'released') {
      console.log(JSON.stringify({ orderId, status: order.status, paymentStatus: order.paymentStatus }));
      console.log(`LOCAL_EXPIRED_ORDER_ID=${orderId}`);
      process.exitCode = 0;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, pollEveryMs));
  }
  if (!(order?.status === 'cancelled' && order.paymentStatus === 'released')) {
    throw new Error(`The scanner did not release the order in time (status ${order?.status}, payment ${order?.paymentStatus}); is the backend running?`);
  }
} finally {
  await mongoose.disconnect();
}
