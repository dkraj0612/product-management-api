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

function createProduct(data) {
  const errors = validateProduct(data);
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  const existingSku = Array.from(products.values()).find(p => p.sku === data.sku);
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
    createdAt: new Date()
  };

  products.set(product.id, product);
  return product;
}

function findAll(filters = {}) {
  let result = Array.from(products.values());

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

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(searchLower) ||
      p.sku.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower)
    );
  }

  return result;
}

function findById(id) {
  return products.get(id) || null;
}

function findBySku(sku) {
  return Array.from(products.values()).find(p => p.sku === sku) || null;
}

function updateProduct(id, patch) {
  const product = products.get(id);
  if (!product) {
    return null;
  }

  if (patch.sku !== undefined && patch.sku !== product.sku) {
    const existingSku = Array.from(products.values()).find(p => p.sku === patch.sku && p.id !== id);
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
    price: patch.price !== undefined ? Number(patch.price.toFixed(2)) : product.price
  };

  products.set(id, updated);
  return updated;
}

function deleteProduct(id) {
  const product = products.get(id);
  if (!product) {
    return false;
  }
  products.delete(id);
  return true;
}

export default {
  findAll,
  findById,
  findBySku,
  create: createProduct,
  update: updateProduct,
  delete: deleteProduct
};