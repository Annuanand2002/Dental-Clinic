function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error('[error]', err);
  const status = err.statusCode || err.status || 500;
  const body = {
    message: err.message || 'Internal Server Error'
  };
  if (err.code === 'INSUFFICIENT_STOCK' && err.available != null) {
    body.available = err.available;
  }
  res.status(status).json(body);
}

module.exports = { notFoundHandler, errorHandler };

