import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import productModel from '../src/models/product.js';

describe('productModel', () => {
  beforeEach(() => {
    productModel.reset();
  });

  describe('create()', () => {
    test('returns a product with all required fields including a uuid id', () => {
      const product = productModel.create({
        name: 'Test Product',
        sku: 'TP-001',
        category: 'electronics',
        price: 29.99,
        stock: 100
      });

      assert.ok(product.id);
      assert.match(product.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      assert.strictEqual(product.name, 'Test Product');
      assert.strictEqual(product.sku, 'TP-001');
      assert.strictEqual(product.category, 'electronics');
      assert.strictEqual(product.price, 29.99);
      assert.strictEqual(product.stock, 100);
      assert.strictEqual(product.description, '');
      assert.ok(product.createdAt instanceof Date);
    });

    test('sets status to "active" and archivedAt to null by default', () => {
      const product = productModel.create({
        name: 'Test Product',
        sku: 'TP-002',
        category: 'electronics',
        price: 29.99,
        stock: 100
      });

      assert.strictEqual(product.status, 'active');
      assert.strictEqual(product.archivedAt, null);
    });

    test('throws if name is missing', () => {
      assert.throws(
        () => productModel.create({
          sku: 'TP-003',
          category: 'electronics',
          price: 29.99,
          stock: 100
        }),
        /name is required and must be a non-empty string/
      );
    });

    test('throws if sku is missing', () => {
      assert.throws(
        () => productModel.create({
          name: 'Test Product',
          category: 'electronics',
          price: 29.99,
          stock: 100
        }),
        /sku is required and must be a non-empty string/
      );
    });

    test('throws if price is zero', () => {
      assert.throws(
        () => productModel.create({
          name: 'Test Product',
          sku: 'TP-004',
          category: 'electronics',
          price: 0,
          stock: 100
        }),
        /price must be a positive number/
      );
    });

    test('throws if price is negative', () => {
      assert.throws(
        () => productModel.create({
          name: 'Test Product',
          sku: 'TP-005',
          category: 'electronics',
          price: -10,
          stock: 100
        }),
        /price must be a positive number/
      );
    });

    test('throws if a product with the same sku already exists', () => {
      productModel.create({
        name: 'Test Product',
        sku: 'TP-006',
        category: 'electronics',
        price: 29.99,
        stock: 100
      });

      assert.throws(
        () => productModel.create({
          name: 'Another Product',
          sku: 'TP-006',
          category: 'clothing',
          price: 19.99,
          stock: 50
        }),
        /sku must be unique/
      );
    });
  });

  describe('findAll({})', () => {
    test('returns all non-archived products', () => {
      const p1 = productModel.create({ name: 'Product 1', sku: 'P1', price: 10, stock: 5 });
      const p2 = productModel.create({ name: 'Product 2', sku: 'P2', price: 20, stock: 10 });
      productModel.delete(p1.id);

      const all = productModel.findAll({});

      assert.strictEqual(all.length, 1);
      assert.strictEqual(all[0].id, p2.id);
    });

    test('returns empty array when the store is empty', () => {
      const all = productModel.findAll({});

      assert.strictEqual(all.length, 0);
      assert.deepStrictEqual(all, []);
    });
  });

  describe('findAll({ category })', () => {
    test('returns only products matching the category', () => {
      productModel.create({ name: 'Electronics 1', sku: 'E1', category: 'electronics', price: 100, stock: 5 });
      productModel.create({ name: 'Clothing 1', sku: 'C1', category: 'clothing', price: 50, stock: 10 });
      productModel.create({ name: 'Electronics 2', sku: 'E2', category: 'electronics', price: 200, stock: 3 });

      const electronics = productModel.findAll({ category: 'electronics' });

      assert.strictEqual(electronics.length, 2);
      assert.ok(electronics.every(p => p.category === 'electronics'));
    });
  });

  describe('findAll({ minPrice, maxPrice })', () => {
    test('returns products with price within the range (inclusive)', () => {
      productModel.create({ name: 'Cheap', sku: 'CH1', price: 5, stock: 10 });
      productModel.create({ name: 'Mid', sku: 'MI1', price: 50, stock: 10 });
      productModel.create({ name: 'Expensive', sku: 'EX1', price: 100, stock: 10 });
      productModel.create({ name: 'Very Expensive', sku: 'VE1', price: 200, stock: 10 });

      const inRange = productModel.findAll({ minPrice: 10, maxPrice: 100 });

      assert.strictEqual(inRange.length, 2);
      assert.ok(inRange.some(p => p.name === 'Mid'));
      assert.ok(inRange.some(p => p.name === 'Expensive'));
      assert.ok(!inRange.some(p => p.name === 'Cheap'));
      assert.ok(!inRange.some(p => p.name === 'Very Expensive'));
    });

    test('works with only minPrice', () => {
      productModel.create({ name: 'Low', sku: 'L1', price: 5, stock: 10 });
      productModel.create({ name: 'High', sku: 'H1', price: 100, stock: 10 });

      const result = productModel.findAll({ minPrice: 50 });

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'High');
    });

    test('works with only maxPrice', () => {
      productModel.create({ name: 'Low', sku: 'L1', price: 5, stock: 10 });
      productModel.create({ name: 'High', sku: 'H1', price: 100, stock: 10 });

      const result = productModel.findAll({ maxPrice: 50 });

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'Low');
    });
  });

  describe('findAll({ inStock: "true" })', () => {
    test('returns only products with stock > 0', () => {
      productModel.create({ name: 'In Stock', sku: 'IS1', price: 10, stock: 5 });
      productModel.create({ name: 'Out of Stock', sku: 'OS1', price: 20, stock: 0 });
      productModel.create({ name: 'Also In Stock', sku: 'IS2', price: 30, stock: 1 });

      const inStock = productModel.findAll({ inStock: true });

      assert.strictEqual(inStock.length, 2);
      assert.ok(inStock.every(p => p.stock > 0));
    });
  });

  describe('findAll({ search: "wireless" })', () => {
    test('returns products whose name contains the term', () => {
      productModel.create({ name: 'Wireless Mouse', sku: 'WM1', price: 29.99, stock: 10 });
      productModel.create({ name: 'Wired Keyboard', sku: 'WK1', price: 49.99, stock: 5 });
      productModel.create({ name: 'Wireless Headphones', sku: 'WH1', price: 79.99, stock: 3 });

      const results = productModel.findAll({ search: 'wireless' });

      assert.strictEqual(results.length, 2);
      assert.ok(results.every(p => p.name.toLowerCase().includes('wireless')));
    });

    test('returns products whose description contains the term', () => {
      productModel.create({ name: 'Mouse', sku: 'M1', description: 'A wireless mouse', price: 29.99, stock: 10 });
      productModel.create({ name: 'Keyboard', sku: 'K1', description: 'Mechanical keyboard', price: 49.99, stock: 5 });

      const results = productModel.findAll({ search: 'wireless' });

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Mouse');
    });

    test('is case-insensitive', () => {
      productModel.create({ name: 'Wireless Mouse', sku: 'WM1', price: 29.99, stock: 10 });

      const results = productModel.findAll({ search: 'WIRELESS' });

      assert.strictEqual(results.length, 1);
    });
  });

  describe('findById(id)', () => {
    test('returns the correct product', () => {
      const created = productModel.create({ name: 'Test', sku: 'T1', price: 10, stock: 5 });

      const found = productModel.findById(created.id);

      assert.ok(found);
      assert.strictEqual(found.id, created.id);
      assert.strictEqual(found.name, 'Test');
    });

    test('returns null for unknown id', () => {
      const found = productModel.findById('00000000-0000-0000-0000-000000000000');

      assert.strictEqual(found, null);
    });

    test('returns null for an archived product id', () => {
      const created = productModel.create({ name: 'Test', sku: 'T1', price: 10, stock: 5 });
      productModel.delete(created.id);

      const found = productModel.findById(created.id);

      assert.strictEqual(found, null);
    });
  });

  describe('findBySku(sku)', () => {
    test('returns the correct product', () => {
      productModel.create({ name: 'Test Product', sku: 'TP-001', price: 10, stock: 5 });

      const found = productModel.findBySku('TP-001');

      assert.ok(found);
      assert.strictEqual(found.sku, 'TP-001');
      assert.strictEqual(found.name, 'Test Product');
    });

    test('returns null for unknown sku', () => {
      const found = productModel.findBySku('NONEXISTENT');

      assert.strictEqual(found, null);
    });
  });

  describe('update(id, patch)', () => {
    test('updates only the provided fields', () => {
      const created = productModel.create({
        name: 'Original',
        sku: 'ORIG-001',
        category: 'electronics',
        price: 100,
        stock: 10,
        description: 'Original description'
      });

      const updated = productModel.update(created.id, {
        name: 'Updated',
        price: 150
      });

      assert.strictEqual(updated.name, 'Updated');
      assert.strictEqual(updated.price, 150);
      assert.strictEqual(updated.sku, 'ORIG-001');
      assert.strictEqual(updated.category, 'electronics');
      assert.strictEqual(updated.stock, 10);
      assert.strictEqual(updated.description, 'Original description');
    });

    test('does not allow overwriting id', () => {
      const created = productModel.create({ name: 'Test', sku: 'T1', price: 10, stock: 5 });
      const originalId = created.id;

      const updated = productModel.update(created.id, { id: 'hacked-id' });

      assert.strictEqual(updated.id, originalId);
    });

    test('does not allow overwriting createdAt', () => {
      const created = productModel.create({ name: 'Test', sku: 'T1', price: 10, stock: 5 });
      const originalCreatedAt = created.createdAt;

      const updated = productModel.update(created.id, { createdAt: new Date('2020-01-01') });

      assert.strictEqual(updated.createdAt.getTime(), originalCreatedAt.getTime());
    });

    test('throws if sku is changed to an existing one', () => {
      productModel.create({ name: 'Product 1', sku: 'SKU-1', price: 10, stock: 5 });
      const p2 = productModel.create({ name: 'Product 2', sku: 'SKU-2', price: 20, stock: 10 });

      assert.throws(
        () => productModel.update(p2.id, { sku: 'SKU-1' }),
        /sku must be unique/
      );
    });
  });

  describe('delete(id)', () => {
    test('sets archivedAt (soft archive, record is kept)', () => {
      const created = productModel.create({ name: 'Test', sku: 'T1', price: 10, stock: 5 });

      const deleted = productModel.delete(created.id);

      assert.ok(deleted);
      assert.ok(deleted.archivedAt instanceof Date);
    });

    test('archived product excluded from findAll()', () => {
      const p1 = productModel.create({ name: 'Product 1', sku: 'P1', price: 10, stock: 5 });
      productModel.create({ name: 'Product 2', sku: 'P2', price: 20, stock: 10 });

      productModel.delete(p1.id);

      const all = productModel.findAll({});

      assert.strictEqual(all.length, 1);
      assert.strictEqual(all[0].sku, 'P2');
    });
  });

  describe('restore(id)', () => {
    test('clears archivedAt', () => {
      const created = productModel.create({ name: 'Test', sku: 'T1', price: 10, stock: 5 });
      productModel.delete(created.id);

      const restored = productModel.restore(created.id);

      assert.ok(restored);
      assert.strictEqual(restored.archivedAt, null);
    });

    test('restored product reappears in findAll()', () => {
      const created = productModel.create({ name: 'Test', sku: 'T1', price: 10, stock: 5 });
      productModel.delete(created.id);

      productModel.restore(created.id);

      const all = productModel.findAll({});

      assert.strictEqual(all.length, 1);
      assert.strictEqual(all[0].id, created.id);
    });
  });
});