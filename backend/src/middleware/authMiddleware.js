const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'salle_libre_super_secret_key_2026';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      succes: false,
      erreur: 'Authentification requise. Jeton Bearer manquant ou invalide.'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      succes: false,
      erreur: 'Jeton de session expiré ou invalide.'
    });
  }
}

function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch {
      // Ignore si le jeton optionnel est invalide
    }
  }
  next();
}

module.exports = { authMiddleware, optionalAuthMiddleware, JWT_SECRET };
