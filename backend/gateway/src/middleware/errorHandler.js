function errorHandler(err, req, res, next) {
  console.error(err);
  const sequelizeStatus = err.name === 'SequelizeUniqueConstraintError' ? 409
    : ['SequelizeValidationError', 'SequelizeForeignKeyConstraintError'].includes(err.name) ? 400 : null;
  const status = err.status || sequelizeStatus || 500;
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : (err.message || 'Internal server error');
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
