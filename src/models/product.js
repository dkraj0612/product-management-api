import { v4 as uuidv4 } from 'uuid';

const VALID_CATEGORIES = ['electronics', 'clothing', 'food', 'books', 'other'];
const VALID_STATUSES = ['active', 'inactive', 'discontinued'];

const products = new Map();

function validateProduct(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      errors.push('name is required and must be a non-empty string');
    }
    if (!data.sku || typeof data.sku !== 'string' || data.sku.trim() === '') {
      errors.push('sku is required and must be a non-empty string');
    }
  }

  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim() === '')) {
    errors.push('name must be a non-empty string');
  }

  if (data.sku !== undefined && (typeof data.sku !== 'string' || data.sku.trim() === '')) {
    errors.push('sku must be a non-empty string');
  }

  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    errors.push('description must be a string');
  }

  if (data.category !== undefined) {
    if (!VALID_CATEGORIES.includes(data.category)) {
      errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
  }

  if (data.price !== undefined) {
    if (typeof data.price !== 'number' || data.price <= 0 || !Number.isFinite(data.price)) {
      errors.push('price must be a positive number');
    } else {
      const priceStr = data.price.toString();
      const decimalIndex = priceStr.indexOf('.');
      if (decimalIndex !== -1 && priceStr.length - decimalIndex - 1 > 2) {
        errors.push('price must have up to 2 decimal places');
      }
    }
  }

  if (data.stock !== undefined) {
    if (!Number.isInteger(data.stock) || data.stock < 0) {
      errors.push('stock must be a non-negative integer');
    }
  }

  if (data.status !== undefined) {
    if (!VALID_STATUSES.includes(data.status)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
  }

  return errors;
}

/**
 * Create a new product with a generated UUID.
 * Enforces SKU uniqueness among non-archived products.
 * Defaults: status='active', archivedAt=null, stock=0, description=''.
 * Price is rounded to 2 decimal places.
 * @param {Object} data - Product data
 * @param {string} data.name - Required, non-empty string
 * @param {string} data.sku - Required, non-empty string, unique among active products
 * @param {string} [data.description=''] - Optional description
 * @param {string} [data.category='other'] - Must be one of: electronics, clothing, food, books, other
 * @param {number} data.price - Required, positive number, max 2 decimal places
 * @param {number} [data.stock=0] - Non-negative integer
 * @param {string} [data.status='active'] - Must be one of: active, inactive, discontinued
 * @returns {Object} Created product with generated id, createdAt, and archivedAt=null
 * @throws {Error} If validation fails (missing required fields, invalid values)
 * @throws {Error} If SKU already exists on a non-archived product ('sku must be unique')
 */
function createProduct(data) {
  const errors = validateProduct(data);
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  const existingSku = Array.from(products.values()).find(p => p.sku === data.sku && !p.archivedAt);
  if (existingSku) {
    throw new Error('sku must be unique');
  }

  const product = {
    id: uuidv4(),
    name: data.name.trim(),
    sku: data.sku.trim(),
    description: data.description ? data.description.trim() : '',
    category: data.category || 'other',
    price: Number(data.price.toFixed(2)),
    stock: data.stock || 0,
    status: data.status || 'active',
    createdAt: new Date(),
    archivedAt: null
  };

  products.set(product.id, product);
  return product;
}

/**
 * Retrieve all non-archived products with optional filtering.
 * Soft-archived products (archivedAt set) are excluded from results.
 * @param {Object} [filters={}] - Filter criteria
 * @param {string} [filters.category] - Filter by category (electronics, clothing, food, books, other)
 * @param {string} [filters.status] - Filter by status (active, inactive, discontinued)
 * @param {number} [filters.minPrice] - Minimum price (inclusive)
 * @param {number} [filters.maxPrice] - Maximum price (inclusive)
 * @param {boolean} [filters.inStock] - true = stock > 0, false = stock === 0
 * @param {string} [filters.search] - Case-insensitive partial match on name or description
 * @returns {Array<Object>} Array of product objects matching all filters
 */
function findAll(filters = {}) {
  let result = Array.from(products.values()).filter(p => !p.archivedAt);

  if (filters.category) {
    result = result.filter(p => p.category === filters.category);
  }

  if (filters.status) {
    result = result.filter(p => p.status === filters.status);
  }

  if (filters.minPrice !== undefined) {
    result = result.filter(p => p.price >= filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    result = result.filter(p => p.price <= filters.maxPrice);
  }

  if (filters.inStock === true) {
    result = result.filter(p => p.stock > 0);
  } else if (filters.inStock === false) {
    result = result.filter(p => p.stock === 0);
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower)
    );
  }

  return result;
}

/**
 * Find a non-archived product by its UUID.
 * Returns null if product doesn't exist or is soft-archived (archivedAt set).
 * @param {string} id - Product UUID (v4)
 * @returns {Object|null} Product object or null if not found/archived
 */
function findById(id) {
  const product = products.get(id);
  if (!product || product.archivedAt) {
    return null;
  }
  return product;
}

/**
 * Find a non-archived product by SKU.
 * SKU must be unique among non-archived products.
 * Returns null if not found or if the matching product is archived.
 * @param {string} sku - Stock Keeping Unit (unique per active product)
 * @returns {Object|null} Product object or null if not found/archived
 */
function findBySku(sku) {
  return Array.from(products.values()).find(p => p.sku === sku && !p.archivedAt) || null;
}

/**
 * Update an existing non-archived product.
 * Immutable fields (id, createdAt, archivedAt) are preserved.
 * SKU can be changed but must remain unique among non-archived products.
 * Price is rounded to 2 decimal places if provided.
 * Returns null if product not found or is archived.
 * @param {string} id - Product UUID
 * @param {Object} patch - Partial product data to update
 * @param {string} [patch.name] - Non-empty string
 * @param {string} [patch.sku] - Non-empty string, must be unique among active products (excluding self)
 * @param {string} [patch.description] - String
 * @param {string} [patch.category] - One of: electronics, clothing, food, books, other
 * @param {number} [patch.price] - Positive number, max 2 decimal places
 * @param {number} [patch.stock] - Non-negative integer
 * @param {string} [patch.status] - One of: active, inactive, discontinued
 * @returns {Object|null} Updated product or null if not found/archived
 * @throws {Error} If validation fails (invalid values)
 * @throws {Error} If new SKU conflicts with another active product ('sku must be unique')
 */
function updateProduct(id, patch) {
  const product = products.get(id);
  if (!product || product.archivedAt) {
    return null;
  }

  if (patch.sku !== undefined && patch.sku !== product.sku) {
    const existingSku = Array.from(products.values()).find(p => p.sku === patch.sku && p.id !== id && !p.archivedAt);
    if (existingSku) {
      throw new Error('sku must be unique');
    }
  }

  const errors = validateProduct(patch, true);
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  const updated = {
    ...product,
    ...patch,
    id: product.id,
    createdAt: product.createdAt,
    archivedAt: product.archivedAt,
    price: patch.price !== undefined ? Number(patch.price.toFixed(2)) : product.price
  };

  products.set(id, updated);
  return updated;
}

/**
 * Soft-archive a product by setting archivedAt timestamp.
 * Product remains in store but is excluded from findAll, findById, findBySku.
 * Can be restored via restoreProduct().
 * Returns null if product not found or already archived.
 * @param {string} id - Product UUID
 * @returns {Object|null} Archived product with archivedAt set, or null if not found/already archived
 */
function deleteProduct(id) {
  const product = products.get(id);
  if (!product || product.archivedAt) {
    return null;
  }
  product.archivedAt = new Date();
  products.set(id, product);
  return product;
}

/**
 * Restore a soft-archived product by clearing archivedAt.
 * Product becomes visible again in findAll, findById, findBySku.
 * Returns null if product not found or not archived.
 * @param {string} id - Product UUID
 * @returns {Object|null} Restored product with archivedAt=null, or null if not found/not archived
 */
function restoreProduct(id) {
  const product = products.get(id);
  if (!product || !product.archivedAt) {
    return null;
  }
  product.archivedAt = null;
  products.set(id, product);
  return product;
}

/**
 * Clear all products from the in-memory store.
 * Test-only utility for resetting state between tests.
 * @returns {void}
 */
function reset() {
  products.clear();
}

export default {
  findAll,
  findById,
  findBySku,
  create: createProduct,
  update: updateProduct,
  delete: deleteProduct,
  restore: restoreProduct,
  reset
};