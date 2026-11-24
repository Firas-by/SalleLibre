const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  creerSessionEtude,
  getSessionsActives,
  rejoindreSession
} = require('../services/sessionEtudeService');

// 1. Consultation des sessions d'entraide actives sur le campus (ouvert à tous)
router.get('/actives', (req, res) => {
  try {
    const sessions = getSessionsActives();
    res.json({ succes: true, total: sessions.length, sessions });
  } catch (err) {
    res.status(500).json({ succes: false, erreur: err.message });
  }
});

// 2. Lancement d'une nouvelle session d'entraide (Étudiant connecté)
router.post('/', authMiddleware, (req, res) => {
  try {
    const { salleNumero, matiere, description, placesDisponibles } = req.body;
    const createurId = req.user.identifiant;

    const session = creerSessionEtude({
      salleNumero,
      createurId,
      matiere,
      description,
      placesDisponibles
    });

    res.status(201).json({ succes: true, ...session });
  } catch (err) {
    res.status(err.status || 500).json({ succes: false, erreur: err.message });
  }
});

// 3. Rejoindre une session d'entraide
router.post('/:id/rejoindre', authMiddleware, (req, res) => {
  try {
    const result = rejoindreSession(Number(req.params.id), req.user.identifiant);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ succes: false, erreur: err.message });
  }
});

module.exports = router;
