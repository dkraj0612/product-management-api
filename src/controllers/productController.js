import productModel from '../models/product.js';

function createResponse(success, data = null, error = null, statusCode = 200) {
  return { success, data, error };
}

export async function getAllProducts(req, res, next) {
  try {
    const filters = {
      category: req.query.category,
      status: req.query.status,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      search: req.query.search
    };

    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const products = productModel.findAll(filters);
    res.json(createResponse(true, products));
  } catch (err) {
    next(err);
  }
}

export async function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    const product = productModel.findById(id);

    if (!product) {
      return res.status(404).json(createResponse(false, null, 'Product not found'));
    }

    res.json(createResponse(true, product));
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    const product = productModel.create(req.body);
    res.status(201).json(createResponse(true, product));
  } catch (err) {
    if (err.message.includes('sku must be unique')) {
      return res.status(409).json(createResponse(false, null, err.message));
    }
    if (err.message.includes('required') || err.message.includes('must be') || err.message.includes('must have')) {
      return res.status(400).json(createResponse(false, null, err.message));
    }
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const updated = productModel.update(id, req.body);

    if (!updated) {
      return res.status(404).json(createResponse(false, null, 'Product not found'));
    }

    res.json(createResponse(true, updated));
  } catch (err) {
    if (err.message.includes('sku must be unique')) {
      return res.status(409).json(createResponse(false, null, err.message));
    }
    if (err.message.includes('must be') || err.message.includes('must have')) {
      return res.status(400).json(createResponse(false, null, err.message));
    }
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = productModel.delete(id);

    if (!deleted) {
      return res.status(404).json(createResponse(false, null, 'Product not found'));
    }

    res.json(createResponse(true, { message: 'Product deleted successfully' }));
  } catch (err) {
    next(err);
  }
}