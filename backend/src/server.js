const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const { anonymiserSignalementsAnciens } = require('./services/signalementService');

// Initialisation de la base de données
require('./database/db');

const app = express();
const PORT = process.env.PORT || 3005;

// Middlewares fondamentaux
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging succinct des requêtes entrantes
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Santé et méta-données API
app.get('/api', (req, res) => {
  res.json({
    nom: 'SalleLibre API',
    version: '1.0.0',
    statut: 'OPERATIONNEL',
    description: 'API REST du système SalleLibre pour le repérage et le signalement des salles de révision',
    horodatage: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    succes: true,
    statut: 'UP',
    horodatage: new Date().toISOString()
  });
});

// Montage des routes d'API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/salles', require('./routes/salleRoutes'));
app.use('/api/signalements', require('./routes/signalementRoutes'));
app.use('/api/sessions-etude', require('./routes/sessionRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Service statique de l'application Web (HTML5/CSS/JS natif - Ponytail Standard)
const publicDir = path.resolve(__dirname, '../public');
console.log(`📱 [Web Client] Application Web servie depuis ${publicDir}`);
app.use(express.static(publicDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Gestionnaire d'erreurs 404 (Route non trouvée)
app.use((req, res) => {
  res.status(404).json({
    succes: false,
    erreur: `Endpoint introuvable : ${req.method} ${req.originalUrl}`
  });
});

// Gestionnaire global des exceptions (Robustesse NFR-08)
app.use((err, req, res, next) => {
  console.error('❌ Erreur non interceptée :', err);
  res.status(err.status || 500).json({
    succes: false,
    erreur: err.message || 'Erreur interne du serveur SalleLibre.'
  });
});

// Tâche de fond automatique : Anonymisation RGPD des signalements de plus de 24h
// S'exécute toutes les heures
const INTERVALLE_ANONYMISATION = 60 * 60 * 1000;
const anonymTimer = setInterval(() => {
  try {
    const res = anonymiserSignalementsAnciens(24);
    if (res.enregistrementsAnonymises > 0) {
      console.log(`🧹 [RGPD Cron] ${res.enregistrementsAnonymises} signalements anciens ont été anonymisés.`);
    }
  } catch (err) {
    console.error('⚠️ Erreur lors de l anonymisation automatique :', err);
  }
}, INTERVALLE_ANONYMISATION);
if (anonymTimer.unref) anonymTimer.unref();

let server;
if (require.main === module) {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur SalleLibre démarré sur http://localhost:${PORT}`);
    console.log(`📡 Endpoints disponibles :`);
    console.log(`   - GET  /api/health`);
    console.log(`   - POST /api/auth/login`);
    console.log(`   - GET  /api/salles/disponibles`);
    console.log(`   - POST /api/signalements`);
    console.log(`   - POST /api/admin/emplois-du-temps/import`);
  });
}

module.exports = { app, server };
