import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct
} from '../controllers/productController.js';
import { validateCreate, validateUpdate, validateFilters } from '../validators/productValidator.js';

const router = Router();

router.get('/', validateFilters, getAllProducts);
router.get('/:id', getProductById);
router.post('/', validateCreate, createProduct);
router.patch('/:id', validateUpdate, updateProduct);
router.delete('/:id', deleteProduct);
router.delete('/:id/restore', restoreProduct);

export default router;