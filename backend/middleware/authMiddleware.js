const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware to require authentication via JWT Bearer token
 */
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. No token provided.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role,
      name: decoded.name,
      email: decoded.email
    };
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
};

/**
 * Middleware for optional authentication
 * Attaches user to request if valid token present, otherwise passes through
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers['authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        id: decoded.id,
        role: decoded.role,
        name: decoded.name,
        email: decoded.email
      };
    } catch (err) {
      // Ignore invalid token for optional auth, leave req.user undefined
    }
  }
  next();
};

/**
 * Middleware to require specific role(s)
 * @param  {...string} roles Allowed roles e.g. 'MANAGER', 'CUSTOMER'
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  JWT_SECRET
};
