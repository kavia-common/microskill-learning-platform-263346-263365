module.exports = {
  // PUBLIC_INTERFACE
  check(req, res) {
    /** Health check endpoint. */
    res.json({
      status: 'ok',
      message: 'Service is healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  }
};
