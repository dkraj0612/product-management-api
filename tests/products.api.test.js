import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import createApp from '../src/app.js';
import productModel from '../src/models/product.js';

let app;
let server;
let product1;
let product2;

function resetAndSeed() {
  productModel.reset();
  product1 = productModel.create({
    name: 'Wireless Mouse',
    sku: 'WM-001',
    category: 'electronics',
    price: 29.99,
    stock: 150,
    description: 'A wireless mouse for gaming'
  });
  product2 = productModel.create({
    name: 'Cotton T-Shirt',
    sku: 'CT-001',
    category: 'clothing',
    price: 19.99,
    stock: 0,
    description: 'Comfortable cotton t-shirt'
  });
}

beforeEach(() => {
  app = createApp();
  server = app.listen(0);
  resetAndSeed();
});

after(() => {
  if (server) server.close();
});

describe('GET /products', () => {
  test('returns 200 and an array', async () => {
    const res = await request(server).get('/products');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  test('returns only non-archived products', async () => {
    productModel.delete(product1.id);

    const res = await request(server).get('/products');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].id, product2.id);
  });

  test('?category=electronics returns only matching products', async () => {
    const res = await request(server).get('/products?category=electronics');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].category, 'electronics');
    assert.strictEqual(res.body.data[0].sku, 'WM-001');
  });

  test('?category=unknown returns 422 (not in enum)', async () => {
    const res = await request(server).get('/products?category=unknown');
    assert.strictEqual(res.status, 422);
    assert.ok(res.body.error.includes('category'));
  });

  test('?minPrice and ?maxPrice filter correctly', async () => {
    // Create products at different price points
    productModel.create({ name: 'Cheap', sku: 'CH-001', category: 'other', price: 5, stock: 10 });
    productModel.create({ name: 'Mid', sku: 'MI-001', category: 'other', price: 50, stock: 10 });
    productModel.create({ name: 'Expensive', sku: 'EX-001', category: 'other', price: 100, stock: 10 });

    const res = await request(server).get('/products?minPrice=10&maxPrice=80');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 2); // Wireless Mouse (29.99) + Mid (50)
    const prices = res.body.data.map(p => p.price);
    assert.ok(prices.every(p => p >= 10 && p <= 80));
  });

  test('?minPrice=abc (non-numeric) returns 422', async () => {
    const res = await request(server).get('/products?minPrice=abc');
    assert.strictEqual(res.status, 422);
    assert.ok(res.body.error.includes('minPrice'));
  });

  test('?maxPrice=abc (non-numeric) returns 422', async () => {
    const res = await request(server).get('/products?maxPrice=xyz');
    assert.strictEqual(res.status, 422);
    assert.ok(res.body.error.includes('maxPrice'));
  });

  test('?inStock=true returns products with stock > 0', async () => {
    const res = await request(server).get('/products?inStock=true');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].stock, 150);
  });

  test('?inStock=invalid returns 422', async () => {
    const res = await request(server).get('/products?inStock=maybe');
    assert.strictEqual(res.status, 422);
    assert.ok(res.body.error.includes('inStock'));
  });

  test('?search=<term> matches on name and description', async () => {
    // Search by name
    let res = await request(server).get('/products?search=wireless');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].name, 'Wireless Mouse');

    // Search by description
    res = await request(server).get('/products?search=cotton');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].name, 'Cotton T-Shirt');

    // Case insensitive
    res = await request(server).get('/products?search=WIRELESS');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
  });
});

describe('GET /products/:id', () => {
  test('returns 200 with the correct product', async () => {
    const res = await request(server).get(`/products/${product1.id}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.id, product1.id);
    assert.strictEqual(res.body.data.name, 'Wireless Mouse');
    assert.strictEqual(res.body.data.sku, 'WM-001');
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(server).get('/products/00000000-0000-0000-0000-000000000000');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Product not found');
  });

  test('returns 404 for an archived product id', async () => {
    productModel.delete(product1.id);

    const res = await request(server).get(`/products/${product1.id}`);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Product not found');
  });
});

describe('POST /products', () => {
  test('returns 201 with the created product including id and createdAt', async () => {
    const res = await request(server)
      .post('/products')
      .send({
        name: 'New Product',
        sku: 'NP-001',
        category: 'electronics',
        price: 49.99,
        stock: 25
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.data.id);
    assert.match(res.body.data.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    assert.ok(res.body.data.createdAt);
    assert.strictEqual(res.body.data.name, 'New Product');
    assert.strictEqual(res.body.data.sku, 'NP-001');
    assert.strictEqual(res.body.data.price, 49.99);
    assert.strictEqual(res.body.data.stock, 25);
    assert.strictEqual(res.body.data.status, 'active');
    assert.strictEqual(res.body.data.archivedAt, null);
  });

  test('returns 400 when name is missing', async () => {
    const res = await request(server)
      .post('/products')
      .send({
        sku: 'NP-002',
        category: 'electronics',
        price: 49.99,
        stock: 25
      });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('name'));
  });

  test('returns 400 when sku is missing', async () => {
    const res = await request(server)
      .post('/products')
      .send({
        name: 'New Product',
        category: 'electronics',
        price: 49.99,
        stock: 25
      });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('sku'));
  });

  test('returns 400 when price is negative', async () => {
    const res = await request(server)
      .post('/products')
      .send({
        name: 'New Product',
        sku: 'NP-003',
        category: 'electronics',
        price: -10,
        stock: 25
      });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('price'));
  });

  test('returns 400 when price is zero', async () => {
    const res = await request(server)
      .post('/products')
      .send({
        name: 'Free Product',
        sku: 'FP-001',
        category: 'electronics',
        price: 0,
        stock: 10
      });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('price'));
  });

  test('accepts stock = 0 (out of stock is valid)', async () => {
    const res = await request(server)
      .post('/products')
      .send({
        name: 'Out of Stock Item',
        sku: 'OOS-001',
        category: 'electronics',
        price: 99.99,
        stock: 0
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.stock, 0);
    assert.strictEqual(res.body.data.name, 'Out of Stock Item');
  });

  test('returns 409 when sku already exists', async () => {
    await request(server)
      .post('/products')
      .send({
        name: 'New Product',
        sku: 'WM-001', // Already exists from seed
        category: 'electronics',
        price: 49.99,
        stock: 25
      });

    const res = await request(server)
      .post('/products')
      .send({
        name: 'Another Product',
        sku: 'WM-001',
        category: 'clothing',
        price: 29.99,
        stock: 10
      });

    assert.strictEqual(res.status, 409);
    assert.ok(res.body.error.includes('sku must be unique'));
  });

  test('two concurrent POSTs with same SKU - only one succeeds', async () => {
    const payload = {
      name: 'Concurrent Product',
      sku: 'CONCURRENT-001',
      category: 'electronics',
      price: 19.99,
      stock: 5
    };

    const [res1, res2] = await Promise.all([
      request(server).post('/products').send(payload),
      request(server).post('/products').send(payload)
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepStrictEqual(statuses, [201, 409]);

    // Verify only one product was created
    const listRes = await request(server).get('/products');
    const concurrentProducts = listRes.body.data.filter(p => p.sku === 'CONCURRENT-001');
    assert.strictEqual(concurrentProducts.length, 1);
  });
});

describe('PATCH /products/:id', () => {
  test('returns 200 with only the patched fields changed', async () => {
    const res = await request(server)
      .patch(`/products/${product1.id}`)
      .send({
        name: 'Updated Mouse',
        price: 39.99
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.name, 'Updated Mouse');
    assert.strictEqual(res.body.data.price, 39.99);
    // Unchanged fields
    assert.strictEqual(res.body.data.sku, 'WM-001');
    assert.strictEqual(res.body.data.category, 'electronics');
    assert.strictEqual(res.body.data.stock, 150);
    assert.strictEqual(res.body.data.description, 'A wireless mouse for gaming');
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(server)
      .patch('/products/00000000-0000-0000-0000-000000000000')
      .send({ name: 'Test' });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Product not found');
  });

  test('returns 400 when the body is empty', async () => {
    const res = await request(server)
      .patch(`/products/${product1.id}`)
      .send({});

    assert.strictEqual(res.status, 400);
  });

  test('returns 400 when trying to update only id (immutable field)', async () => {
    const newId = '11111111-1111-1111-1111-111111111111';
    const res = await request(server)
      .patch(`/products/${product1.id}`)
      .send({ id: newId });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('No valid fields to update'));
  });

  test('returns 400 when trying to update only sku (immutable field)', async () => {
    const res = await request(server)
      .patch(`/products/${product1.id}`)
      .send({ sku: 'NEW-SKU' });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('No valid fields to update'));
  });

  test('returns 400 when trying to update sku to existing one', async () => {
    const res = await request(server)
      .patch(`/products/${product1.id}`)
      .send({ sku: 'CT-001' }); // product2's SKU

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('No valid fields to update'));
  });

  test('strips unknown fields from patch', async () => {
    const res = await request(server)
      .patch(`/products/${product1.id}`)
      .send({
        name: 'Updated Mouse',
        unknownField: 'should be ignored',
        anotherUnknown: 123
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.name, 'Updated Mouse');
    assert.strictEqual(res.body.data.sku, 'WM-001');
    assert.ok(!('unknownField' in res.body.data));
    assert.ok(!('anotherUnknown' in res.body.data));
  });

  test('returns 404 when patching an archived product', async () => {
    await request(server).delete(`/products/${product1.id}`);

    const res = await request(server)
      .patch(`/products/${product1.id}`)
      .send({ name: 'Should Fail' });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Product not found');
  });
});

describe('DELETE /products/:id', () => {
  test('returns 200 with success message', async () => {
    const res = await request(server).delete(`/products/${product1.id}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.message, 'Product deleted successfully');
  });

  test('subsequent GET /products/:id returns 404', async () => {
    await request(server).delete(`/products/${product1.id}`);

    const res = await request(server).get(`/products/${product1.id}`);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Product not found');
  });

  test('archived product excluded from GET /products', async () => {
    await request(server).delete(`/products/${product1.id}`);

    const res = await request(server).get('/products');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].id, product2.id);
  });
});

describe('DELETE /products/:id/restore', () => {
  test('returns 200 and product reappears in GET /products', async () => {
    await request(server).delete(`/products/${product1.id}`);

    const res = await request(server).delete(`/products/${product1.id}/restore`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.id, product1.id);
    assert.strictEqual(res.body.data.archivedAt, null);

    const listRes = await request(server).get('/products');
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(listRes.body.data.length, 2);
  });

  test('returns 404 when restoring a product that was never archived', async () => {
    const res = await request(server).delete(`/products/${product1.id}/restore`);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Product not found or not archived');
  });
});