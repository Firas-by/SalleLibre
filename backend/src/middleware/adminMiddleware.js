function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'ADMINISTRATEUR') {
    return res.status(403).json({
      succes: false,
      erreur: 'Accès interdit. Seul un administrateur de la scolarité est habilité à effectuer cette opération.'
    });
  }
  next;
  next();
}

module.exports = { adminMiddleware };
