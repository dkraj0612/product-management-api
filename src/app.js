import express from 'express';
import productRoutes from './routes/products.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

function createApp() {
  const app = express();

  app.use(express.json());

  app.use('/products', productRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;