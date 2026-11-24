const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/db');
const { authMiddleware, JWT_SECRET } = require('../middleware/authMiddleware');

// Domaines institutionnels configurables par variable d'environnement
const ALLOWED_DOMAINS = (process.env.INSTITUTIONAL_EMAIL_DOMAINS || 'univ.tn,institution.tn,ensi.rnu.tn')
  .split(',')
  .map(d => d.trim().toLowerCase());

function isInstitutionalEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const parts = email.toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return ALLOWED_DOMAINS.some(allowed => domain === allowed || domain.endsWith('.' + allowed));
}

// 1. Récupération des domaines autorisés
router.get('/domains', (req, res) => {
  res.json({
    succes: true,
    domainesAutorises: ALLOWED_DOMAINS,
    description: "Seules les adresses des domaines institutionnels sont autorisées à créer un compte."
  });
});

// 2. Inscription
router.post('/register', (req, res) => {
  const { email, motDePasse, nom, role = 'ETUDIANT' } = req.body;

  if (!email || !motDePasse || !nom) {
    return res.status(400).json({
      succes: false,
      erreur: 'Veuillez renseigner tous les champs obligatoires (nom, email, motDePasse).'
    });
  }

  // Vérification de sécurité B5.a : domaine institutionnel obligatoire
  if (!isInstitutionalEmail(email)) {
    return res.status(400).json({
      succes: false,
      erreur: `Adresse e-mail non autorisée. Seuls les comptes institutionnels (${ALLOWED_DOMAINS.join(', ')}) peuvent accéder au service.`
    });
  }

  if (motDePasse.length < 6) {
    return res.status(400).json({
      succes: false,
      erreur: 'Le mot de passe doit comporter au moins 6 caractères.'
    });
  }

  const roleNormalise = role.toUpperCase() === 'ADMINISTRATEUR' ? 'ADMINISTRATEUR' : 'ETUDIANT';

  // Vérification de doublon
  const existing = db.prepare('SELECT identifiant FROM utilisateurs WHERE emailEtablissement = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({
      succes: false,
      erreur: 'Un compte associé à cette adresse e-mail institutionnelle existe déjà.'
    });
  }

  const identifiant = 'user_' + Date.now().toString(36);
  const motDePasseHash = bcrypt.hashSync(motDePasse, 8);
  const dateCreation = new Date().toISOString();

  db.prepare(`
    INSERT INTO utilisateurs (identifiant, role, emailEtablissement, motDePasseHash, nom, dateCreation)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(identifiant, roleNormalise, email.toLowerCase(), motDePasseHash, nom, dateCreation);

  const token = jwt.sign(
    { identifiant, role: roleNormalise, emailEtablissement: email.toLowerCase(), nom },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    succes: true,
    message: 'Compte créé avec succès.',
    token,
    utilisateur: { identifiant, role: roleNormalise, email: email.toLowerCase(), nom }
  });
});

// 3. Connexion
router.post('/login', (req, res) => {
  const { email, motDePasse } = req.body;

  if (!email || !motDePasse) {
    return res.status(400).json({
      succes: false,
      erreur: 'Identifiant et mot de passe requis.'
    });
  }

  const user = db.prepare('SELECT * FROM utilisateurs WHERE emailEtablissement = ?').get(email.toLowerCase().trim());
  if (!user) {
    return res.status(401).json({
      succes: false,
      erreur: 'Identifiant ou mot de passe incorrect.'
    });
  }

  const match = bcrypt.compareSync(motDePasse, user.motDePasseHash);
  if (!match) {
    return res.status(401).json({
      succes: false,
      erreur: 'Identifiant ou mot de passe incorrect.'
    });
  }

  const token = jwt.sign(
    { identifiant: user.identifiant, role: user.role, emailEtablissement: user.emailEtablissement, nom: user.nom },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    succes: true,
    message: 'Connexion réussie.',
    token,
    utilisateur: {
      identifiant: user.identifiant,
      role: user.role,
      email: user.emailEtablissement,
      nom: user.nom,
      karmaScore: user.karmaScore ?? 100
    }
  });
});

// 4. Profil utilisateur connecté
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT identifiant, role, emailEtablissement, nom, karmaScore, dateCreation FROM utilisateurs WHERE identifiant = ?').get(req.user.identifiant);
  if (!user) {
    return res.status(404).json({ succes: false, erreur: 'Utilisateur introuvable.' });
  }

  res.json({
    succes: true,
    utilisateur: user
  });
});

module.exports = router;
