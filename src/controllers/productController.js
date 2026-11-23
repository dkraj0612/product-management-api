import productModel from '../models/product.js';
import { catchAsync } from '../middleware/catchAsync.js';

/**
 * Creates a standardized API response object.
 * @param {boolean} success - Whether the operation succeeded
 * @param {*} [data=null] - Response payload
 * @param {string} [error=null] - Error message if failed
 * @param {number} [statusCode=200] - HTTP status code
 * @returns {{success: boolean, data: *, error: string|null}} Response object
 */
function createResponse(success, data = null, error = null, statusCode = 200) {
  return { success, data, error };
}

/**
 * Maps model validation errors to appropriate HTTP status codes.
 * @param {Error} err - Error thrown by model
 * @param {import("express").Response} res - Express response object
 * @returns {import("express").Response} JSON error response
 * @throws {Error} Re-throws unrecognized errors
 */
function handleModelError(err, res) {
  if (err.message.includes('sku must be unique')) {
    return res.status(409).json(createResponse(false, null, err.message));
  }
  if (err.message.includes('required') || err.message.includes('must be') || err.message.includes('must have')) {
    return res.status(400).json(createResponse(false, null, err.message));
  }
  throw err;
}

/**
 * GET /products - Retrieve all non-archived products with optional filtering.
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.category] - Filter by category
 * @param {string} [req.query.status] - Filter by status
 * @param {string} [req.query.minPrice] - Minimum price filter
 * @param {string} [req.query.maxPrice] - Maximum price filter
 * @param {string} [req.query.inStock] - 'true' or 'false'
 * @param {string} [req.query.search] - Search term for name/description
 * @param {import("express").Response} res - Express response object
 * @param {import("express").NextFunction} next - Express next middleware
 * @returns {Promise<void>} JSON response with product array
 * @status 200 - Success, returns array of products (empty if none match)
 */
export const getAllProducts = catchAsync(async (req, res) => {
  const filters = {
    category: req.query.category,
    status: req.query.status,
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    inStock: req.query.inStock === 'true' ? true : req.query.inStock === 'false' ? false : undefined,
    search: req.query.search
  };

  Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

  const products = productModel.findAll(filters);
  res.json(createResponse(true, products));
});

/**
 * GET /products/:id - Retrieve a single product by ID.
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Product UUID
 * @param {import("express").Response} res - Express response object
 * @param {import("express").NextFunction} next - Express next middleware
 * @returns {Promise<void>} JSON response with product object
 * @status 200 - Success, returns product
 * @status 404 - Product not found or archived
 */
export const getProductById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = productModel.findById(id);

  if (!product) {
    return res.status(404).json(createResponse(false, null, 'Product not found'));
  }

  res.json(createResponse(true, product));
});

/**
 * POST /products - Create a new product.
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.body - Product data
 * @param {string} req.body.name - Required, non-empty
 * @param {string} req.body.sku - Required, non-empty, unique
 * @param {string} [req.body.description] - Optional
 * @param {string} [req.body.category] - Optional, defaults to 'other'
 * @param {number} req.body.price - Required, positive, max 2 decimals
 * @param {number} [req.body.stock] - Optional, defaults to 0
 * @param {string} [req.body.status] - Optional, defaults to 'active'
 * @param {import("express").Response} res - Express response object
 * @param {import("express").NextFunction} next - Express next middleware
 * @returns {Promise<void>} JSON response with created product
 * @status 201 - Created, returns product with generated id and createdAt
 * @status 400 - Validation error (missing/invalid required fields)
 * @status 409 - SKU already exists on a non-archived product
 */
export const createProduct = catchAsync(async (req, res) => {
  try {
    const product = productModel.create(req.body);
    return res.status(201).json(createResponse(true, product));
  } catch (err) {
    return handleModelError(err, res);
  }
});

const ALLOWED_UPDATE_FIELDS = ['name', 'description', 'category', 'price', 'stock', 'status'];

/**
 * PATCH /products/:id - Partially update a product.
 * Immutable fields (id, sku, createdAt, archivedAt) cannot be modified.
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Product UUID
 * @param {Object} req.body - Partial product data to update
 * @param {string} [req.body.name] - Non-empty string
 * @param {string} [req.body.description] - String
 * @param {string} [req.body.category] - One of: electronics, clothing, food, books, other
 * @param {number} [req.body.price] - Positive number, max 2 decimals
 * @param {number} [req.body.stock] - Non-negative integer
 * @param {string} [req.body.status] - One of: active, inactive, discontinued
 * @param {import("express").Response} res - Express response object
 * @param {import("express").NextFunction} next - Express next middleware
 * @returns {Promise<void>} JSON response with updated product
 * @status 200 - Success, returns updated product
 * @status 400 - Empty body or no valid fields to update
 * @status 404 - Product not found or archived
 * @status 409 - New SKU conflicts with another active product
 */
export const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json(createResponse(false, null, 'Request body cannot be empty'));
  }

  const { id: _, sku: __, ...allowedFields } = req.body;

  const filteredFields = {};
  for (const key of Object.keys(allowedFields)) {
    if (ALLOWED_UPDATE_FIELDS.includes(key)) {
      filteredFields[key] = allowedFields[key];
    }
  }

  if (Object.keys(filteredFields).length === 0) {
    return res.status(400).json(createResponse(false, null, 'No valid fields to update'));
  }

  try {
    const updated = productModel.update(id, filteredFields);

    if (!updated) {
      return res.status(404).json(createResponse(false, null, 'Product not found'));
    }

    return res.json(createResponse(true, updated));
  } catch (err) {
    return handleModelError(err, res);
  }
});

/**
 * DELETE /products/:id - Soft-archive a product.
 * Sets archivedAt timestamp; product excluded from listings but can be restored.
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Product UUID
 * @param {import("express").Response} res - Express response object
 * @param {import("express").NextFunction} next - Express next middleware
 * @returns {Promise<void>} JSON response with success message
 * @status 200 - Success, returns { message: 'Product deleted successfully' }
 * @status 404 - Product not found or already archived
 */
export const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const deleted = productModel.delete(id);

  if (!deleted) {
    return res.status(404).json(createResponse(false, null, 'Product not found'));
  }

  res.json(createResponse(true, { message: 'Product deleted successfully' }));
});

/**
 * DELETE /products/:id/restore - Restore a soft-archived product.
 * Clears archivedAt; product becomes visible in listings again.
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Product UUID
 * @param {import("express").Response} res - Express response object
 * @param {import("express").NextFunction} next - Express next middleware
 * @returns {Promise<void>} JSON response with restored product
 * @status 200 - Success, returns restored product
 * @status 404 - Product not found or not archived
 */
export const restoreProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const restored = productModel.restore(id);

  if (!restored) {
    return res.status(404).json(createResponse(false, null, 'Product not found or not archived'));
  }

  res.json(createResponse(true, restored));
});