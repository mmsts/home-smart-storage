const jwt = require('jsonwebtoken');

const SECRET = 'home-smart-storage-secret-2024';

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, message: '登录已过期' });
  }
}

// Optional auth - sets req.user if token present but doesn't block
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      req.user = jwt.verify(token, SECRET);
    } catch (e) {}
  }
  next();
}

module.exports = { generateToken, authMiddleware, optionalAuth, SECRET };
