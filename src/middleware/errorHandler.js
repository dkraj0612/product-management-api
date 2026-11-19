function createResponse(success, data = null, error = null) {
  return { success, data, error };
}

export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json(createResponse(false, null, 'Invalid JSON payload'));
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json(createResponse(false, null, err.message));
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  res.status(statusCode).json(createResponse(false, null, message));
}

export function notFoundHandler(req, res) {
  res.status(404).json(createResponse(false, null, `Route ${req.method} ${req.path} not found`));
}