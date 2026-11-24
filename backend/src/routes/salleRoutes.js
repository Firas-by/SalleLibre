const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const {
  getSallesDisponibles,
  getSalleDetails,
  getMeilleureRecommandation,
  getHeatmapAffluence
} = require('../services/salleService');

// 1. Algorithme de recommandation intelligente de salle (Meilleur choix pour réviser)
router.get('/recommandation', (req, res) => {
  try {
    const { simulatedTime } = req.query;
    const refDate = simulatedTime ? new Date(simulatedTime) : new Date();
    const reco = getMeilleureRecommandation(refDate);
    res.json({ succes: true, ...reco });
  } catch (err) {
    res.status(500).json({ succes: false, erreur: err.message });
  }
});

// 2. Matrice d'affluence prévisionnelle hebdomadaire (Heatmap)
router.get('/heatmap', (req, res) => {
  try {
    const data = getHeatmapAffluence();
    res.json({ succes: true, heatmap: data });
  } catch (err) {
    res.status(500).json({ succes: false, erreur: err.message });
  }
});

// 3. Liste des bâtiments disponibles
router.get('/batiments', (req, res) => {
  const batiments = db.prepare('SELECT DISTINCT batiment FROM salles ORDER BY batiment ASC').all().map(b => b.batiment);
  res.json({ succes: true, batiments });
});

// 2. Liste de toutes les salles brutes
router.get('/', (req, res) => {
  const salles = db.prepare('SELECT * FROM salles ORDER BY batiment ASC, numero ASC').all();
  res.json({ succes: true, total: salles.length, salles });
});

// 3. Endpoint principal : Salles disponibles en temps réel avec filtres (B1.1, B1.2, B1.3, B2.3)
router.get('/disponibles', (req, res) => {
  try {
    const { batiment, minCapacite, prises, simulatedTime } = req.query;

    const referenceDate = simulatedTime ? new Date(simulatedTime) : new Date();

    const data = getSallesDisponibles(
      { batiment, minCapacite, prises },
      referenceDate
    );

    res.json({
      succes: true,
      ...data
    });
  } catch (err) {
    res.status(500).json({
      succes: false,
      erreur: `Erreur lors de la récupération des salles : ${err.message}`
    });
  }
});

// 4. Détail d'une salle spécifique
router.get('/:numero', (req, res) => {
  try {
    const { simulatedTime } = req.query;
    const referenceDate = simulatedTime ? new Date(simulatedTime) : new Date();
    const details = getSalleDetails(req.params.numero, referenceDate);

    if (!details) {
      return res.status(404).json({
        succes: false,
        erreur: `La salle '${req.params.numero}' n'existe pas.`
      });
    }

    res.json({
      succes: true,
      salle: details
    });
  } catch (err) {
    res.status(500).json({
      succes: false,
      erreur: `Erreur interne : ${err.message}`
    });
  }
});

module.exports = router;
