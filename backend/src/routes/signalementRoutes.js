const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { creerSignalement } = require('../services/signalementService');
const { db } = require('../database/db');

// 1. Soumission d'un signalement par un étudiant connecté (B2.1, B2.2, B2.4)
router.post('/', authMiddleware, (req, res) => {
  try {
    const { salleNumero, etat, ambiance, customDate } = req.body;
    const etudiantId = req.user.identifiant;

    const result = creerSignalement({
      salleNumero,
      etudiantId,
      etat,
      ambiance,
      customDate
    });

    res.status(201).json({
      succes: true,
      ...result
    });
  } catch (err) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      succes: false,
      erreur: err.message || 'Erreur lors de l enregistrement du signalement.',
      cooldown: Boolean(err.cooldown),
      minutesRestantes: err.minutesRestantes || null
    });
  }
});

// 2. Flux d'activité en direct sur le campus (Live Activity Feed)
router.get('/flux', (req, res) => {
  const activites = db.prepare(`
    SELECT s.id, s.salleNumero, s.etat, s.ambiance, s.dateHeure,
           sa.batiment, sa.capacite,
           CASE WHEN s.etudiantId IS NULL THEN 'Étudiant Anonyme' ELSE u.nom END as auteurNom
    FROM signalements s
    JOIN salles sa ON s.salleNumero = sa.numero
    LEFT JOIN utilisateurs u ON s.etudiantId = u.identifiant
    ORDER BY s.dateHeure DESC
    LIMIT 30
  `).all();

  res.json({
    succes: true,
    total: activites.length,
    flux: activites
  });
});

// 2. Derniers signalements à l'échelle du campus
router.get('/recents', (req, res) => {
  const signalements = db.prepare(`
    SELECT s.id, s.salleNumero, s.etat, s.dateHeure,
           CASE WHEN s.etudiantId IS NULL THEN 'Anonyme' ELSE u.nom END as auteurNom,
           sa.batiment
    FROM signalements s
    LEFT JOIN utilisateurs u ON s.etudiantId = u.identifiant
    JOIN salles sa ON s.salleNumero = sa.numero
    ORDER BY s.dateHeure DESC
    LIMIT 25
  `).all();

  res.json({
    succes: true,
    total: signalements.length,
    signalements
  });
});

module.exports = router;
