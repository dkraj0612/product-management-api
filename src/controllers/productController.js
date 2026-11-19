import productModel from '../models/product.js';
import { catchAsync } from '../middleware/catchAsync.js';

function createResponse(success, data = null, error = null, statusCode = 200) {
  return { success, data, error };
}

function handleModelError(err, res) {
  if (err.message.includes('sku must be unique')) {
    return res.status(409).json(createResponse(false, null, err.message));
  }
  if (err.message.includes('required') || err.message.includes('must be') || err.message.includes('must have')) {
    return res.status(400).json(createResponse(false, null, err.message));
  }
  throw err;
}

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

export const getProductById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = productModel.findById(id);

  if (!product) {
    return res.status(404).json(createResponse(false, null, 'Product not found'));
  }

  res.json(createResponse(true, product));
});

export const createProduct = catchAsync(async (req, res) => {
  try {
    const product = productModel.create(req.body);
    return res.status(201).json(createResponse(true, product));
  } catch (err) {
    return handleModelError(err, res);
  }
});

export const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  try {
    const updated = productModel.update(id, req.body);

    if (!updated) {
      return res.status(404).json(createResponse(false, null, 'Product not found'));
    }

    return res.json(createResponse(true, updated));
  } catch (err) {
    return handleModelError(err, res);
  }
});

export const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const deleted = productModel.delete(id);

  if (!deleted) {
    return res.status(404).json(createResponse(false, null, 'Product not found'));
  }

  res.json(createResponse(true, { message: 'Product deleted successfully' }));
});

export const restoreProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const restored = productModel.restore(id);

  if (!restored) {
    return res.status(404).json(createResponse(false, null, 'Product not found or not archived'));
  }

  res.json(createResponse(true, restored));
});