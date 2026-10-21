import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/prisma.js';
import { config } from '../../src/config.js';

type AuthResponse = {
  token: string;
  user: { id: string; email: string; cacaoBalance: number };
};

type ProductList = {
  products: Array<{ id: string; name: string; cacaoPrice: number; stock: number }>;
};

const suffix = Date.now().toString(36);
const email = `e2e.deposit.${suffix}@bancocacao.test`;
const password = 'e2e-test-pass-123';

let server: Server;
let baseUrl = '';
let token = '';
let userId = '';

async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: T }> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const body = (await res.json()) as T;
  return { status: res.status, body };
}

describe('E2E API: depósito y canje de cacao', () => {
  before(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('No server address');
    baseUrl = `http://127.0.0.1:${addr.port}`;

    const registered = await api<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        name: 'E2E Deposit User',
        password,
        role: 'CLIENT',
      }),
    });
    assert.equal(registered.status, 201, JSON.stringify(registered.body));
    token = registered.body.token;
    userId = registered.body.user.id;
    assert.equal(registered.body.user.cacaoBalance, 0);
  });

  after(async () => {
    try {
      if (userId) {
        await prisma.redemption.deleteMany({ where: { userId } });
        await prisma.ledgerEntry.deleteMany({
          where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        });
        await prisma.user.deleteMany({ where: { id: userId } });
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await prisma.$disconnect();
    }
  });

  it('deposita MXN y acredita cacao según la tasa', async () => {
    const amountMxn = 20;
    const expectedCacao = Math.floor(amountMxn * config.cacaoPerMxn);

    const deposit = await api<{
      cacaoCredited: number;
      cacaoBalance: number;
      amountMxn: number;
      entry: { type: string; amountCacao: number };
    }>('/api/wallet/deposit', {
      method: 'POST',
      token,
      body: JSON.stringify({ amountMxn }),
    });

    assert.equal(deposit.status, 201, JSON.stringify(deposit.body));
    assert.equal(deposit.body.amountMxn, amountMxn);
    assert.equal(deposit.body.cacaoCredited, expectedCacao);
    assert.equal(deposit.body.cacaoBalance, expectedCacao);
    assert.equal(deposit.body.entry.type, 'DEPOSIT');
    assert.equal(deposit.body.entry.amountCacao, expectedCacao);

    const balance = await api<{ cacaoBalance: number; cacaoPerMxn: number }>(
      '/api/wallet/balance',
      { token },
    );
    assert.equal(balance.status, 200);
    assert.equal(balance.body.cacaoBalance, expectedCacao);
    assert.equal(balance.body.cacaoPerMxn, config.cacaoPerMxn);

    const ledger = await api<{ entries: Array<{ type: string; amountCacao: number }> }>(
      '/api/wallet/ledger',
      { token },
    );
    assert.equal(ledger.status, 200);
    assert.ok(ledger.body.entries.some((e) => e.type === 'DEPOSIT' && e.amountCacao === expectedCacao));
  });

  it('canjea un producto con cacao y descuenta saldo y stock', async () => {
    const list = await api<ProductList>('/api/products', { token });
    assert.equal(list.status, 200);
    const products = list.body.products;
    assert.ok(products.length > 0, 'Se requiere al menos un producto seed');

    const product = products
      .filter((p) => p.stock > 0)
      .sort((a, b) => a.cacaoPrice - b.cacaoPrice)[0];
    assert.ok(product, 'No hay producto con stock');

    const before = await api<{ cacaoBalance: number }>('/api/wallet/balance', { token });
    assert.ok(
      before.body.cacaoBalance >= product.cacaoPrice,
      `Saldo insuficiente para canje: ${before.body.cacaoBalance} < ${product.cacaoPrice}`,
    );

    const stockBefore = product.stock;
    const balanceBefore = before.body.cacaoBalance;

    const redeem = await api<{
      cacaoBalance: number;
      redemption: { cacaoPaid: number; quantity: number; productId: string };
      entry: { type: string };
    }>('/api/products/redeem', {
      method: 'POST',
      token,
      body: JSON.stringify({ productId: product.id, quantity: 1 }),
    });

    assert.equal(redeem.status, 201, JSON.stringify(redeem.body));
    assert.equal(redeem.body.entry.type, 'REDEEM');
    assert.equal(redeem.body.redemption.productId, product.id);
    assert.equal(redeem.body.redemption.quantity, 1);
    assert.equal(redeem.body.redemption.cacaoPaid, product.cacaoPrice);
    assert.equal(redeem.body.cacaoBalance, balanceBefore - product.cacaoPrice);

    const afterProducts = await api<ProductList>('/api/products', { token });
    const updated = afterProducts.body.products.find((p) => p.id === product.id);
    assert.ok(updated);
    assert.equal(updated!.stock, stockBefore - 1);

    const ledger = await api<{ entries: Array<{ type: string; amountCacao: number }> }>(
      '/api/wallet/ledger',
      { token },
    );
    assert.ok(
      ledger.body.entries.some(
        (e) => e.type === 'REDEEM' && e.amountCacao === product.cacaoPrice,
      ),
    );
  });

  it('rechaza canje si el saldo de cacao es insuficiente', async () => {
    const list = await api<ProductList>('/api/products', { token });
    const expensive =
      list.body.products.find((p) => p.stock > 0 && p.cacaoPrice > 0) ?? list.body.products[0];
    assert.ok(expensive);

    // Vaciar saldo de forma controlada: transferir no; ajustar depositando 0 no sirve.
    // Intentamos canjear una cantidad imposible.
    const balance = await api<{ cacaoBalance: number }>('/api/wallet/balance', { token });
    const qty = Math.floor(balance.body.cacaoBalance / expensive.cacaoPrice) + 5;

    const redeem = await api<{ error: string }>('/api/products/redeem', {
      method: 'POST',
      token,
      body: JSON.stringify({ productId: expensive.id, quantity: Math.max(qty, 50) }),
    });

    assert.equal(redeem.status, 400);
    assert.match(redeem.body.error, /insuficiente|Stock/i);
  });
});
