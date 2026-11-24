const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const { parserEtValiderCsv } = require('../services/csvParserService');
const { anonymiserSignalementsAnciens } = require('../services/signalementService');
const { db } = require('../database/db');

// Configuration du stockage temporaire mémoire pour multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 Mo max
});

// Toutes les routes de ce routeur requièrent le rôle ADMINISTRATEUR
router.use(authMiddleware);
router.use(adminMiddleware);

// 1. Importation d'emploi du temps CSV (B3.1, B3.2)
// Accepte un fichier multipart ('fichier') OU du texte brut dans le corps JSON ('csvContent')
router.post('/emplois-du-temps/import', upload.single('fichier'), (req, res) => {
  try {
    let csvData = '';

    if (req.file) {
      csvData = req.file.buffer.toString('utf-8');
    } else if (req.body && req.body.csvContent) {
      csvData = req.body.csvContent;
    } else {
      return res.status(400).json({
        succes: false,
        erreur: 'Aucun contenu CSV fourni. Veuillez téléverser un fichier multipart "fichier" ou envoyer le texte "csvContent".'
      });
    }

    const resultat = parserEtValiderCsv(csvData);

    res.json(resultat);
  } catch (err) {
    res.status(err.status || 400).json({
      succes: false,
      erreur: err.message,
      numeroLigne: err.numeroLigne || null,
      contenuLigne: err.contenuLigne || null
    });
  }
});

// 2. Consultation de tous les créneaux enregistrés
router.get('/creneaux', (req, res) => {
  const creneaux = db.prepare(`
    SELECT c.*, s.batiment, s.capacite 
    FROM creneaux c
    JOIN salles s ON c.salleNumero = s.numero
    ORDER BY c.jour ASC, c.heureDebut ASC
  `).all();

  res.json({
    succes: true,
    total: creneaux.length,
    creneaux
  });
});

// 3. Déclenchement de l'anonymisation des signalements (> 24h)
router.post('/anonymiser', (req, res) => {
  const { heures = 24 } = req.body;
  const resultat = anonymiserSignalementsAnciens(Number(heures));
  res.json(resultat);
});

// 4. Statistiques globales pour le tableau de bord de la scolarité
router.get('/stats', (req, res) => {
  const totalSalles = db.prepare('SELECT COUNT(*) as c FROM salles').get().c;
  const totalCreneaux = db.prepare('SELECT COUNT(*) as c FROM creneaux').get().c;
  const totalSignalements = db.prepare('SELECT COUNT(*) as c FROM signalements').get().c;
  const totalEtudiants = db.prepare("SELECT COUNT(*) as c FROM utilisateurs WHERE role = 'ETUDIANT'").get().c;
  const signalementsAnonymes = db.prepare('SELECT COUNT(*) as c FROM signalements WHERE etudiantId IS NULL').get().c;

  res.json({
    succes: true,
    statistiques: {
      totalSalles,
      totalCreneaux,
      totalSignalements,
      signalementsAnonymes,
      totalEtudiants
    }
  });
});

module.exports = router;
