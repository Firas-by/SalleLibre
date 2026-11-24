const { db } = require('../database/db');

function creerSessionEtude({ salleNumero, createurId, matiere, description = '', placesDisponibles = 4 }) {
  if (!salleNumero || !createurId || !matiere) {
    throw { status: 400, message: 'Paramètres incomplets (salleNumero, createurId, matiere requis).' };
  }

  const salle = db.prepare('SELECT numero FROM salles WHERE numero = ?').get(salleNumero);
  if (!salle) {
    throw { status: 404, message: `La salle '${salleNumero}' est introuvable.` };
  }

  // Désactiver les sessions précédentes de ce créateur sur cette salle
  db.prepare('UPDATE sessions_etude SET actif = 0 WHERE salleNumero = ? AND createurId = ?').run(salleNumero, createurId);

  const nowIso = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO sessions_etude (salleNumero, createurId, matiere, description, placesDisponibles, dateHeureDebut, actif)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  const result = insert.run(salleNumero, createurId, matiere, description, Number(placesDisponibles), nowIso);

  // Bonus Karma pour avoir lancé une session d'entraide (+5 pts)
  db.prepare('UPDATE utilisateurs SET karmaScore = MIN(200, karmaScore + 5) WHERE identifiant = ?').run(createurId);

  return {
    id: Number(result.lastInsertRowid),
    salleNumero,
    matiere,
    placesDisponibles: Number(placesDisponibles),
    dateHeureDebut: nowIso,
    message: `Session d'entraide '${matiere}' activée en salle ${salleNumero}. (+5 Karma)`
  };
}

function getSessionsActives() {
  const sessions = db.prepare(`
    SELECT se.*, u.nom as createurNom, u.karmaScore as createurKarma, s.batiment, s.capacite, s.prises
    FROM sessions_etude se
    JOIN utilisateurs u ON se.createurId = u.identifiant
    JOIN salles s ON se.salleNumero = s.numero
    WHERE se.actif = 1 AND se.placesDisponibles > 0
    ORDER BY se.dateHeureDebut DESC
    LIMIT 20
  `).all();

  return sessions.map(s => ({
    ...s,
    prises: Boolean(s.prises),
    actif: Boolean(s.actif)
  }));
}

function rejoindreSession(sessionId, etudiantId) {
  const session = db.prepare('SELECT * FROM sessions_etude WHERE id = ? AND actif = 1').get(sessionId);
  if (!session) {
    throw { status: 404, message: 'Session introuvable ou déjà terminée.' };
  }

  if (session.placesDisponibles <= 0) {
    throw { status: 400, message: 'Cette session est désormais complète.' };
  }

  db.prepare('UPDATE sessions_etude SET placesDisponibles = placesDisponibles - 1 WHERE id = ?').run(sessionId);

  // Récupérer le nombre de places actualisé
  const updated = db.prepare('SELECT placesDisponibles FROM sessions_etude WHERE id = ?').get(sessionId);

  return {
    succes: true,
    sessionId,
    placesRestantes: updated.placesDisponibles,
    message: `Vous avez rejoint la session d'étude en salle ${session.salleNumero}.`
  };
}

module.exports = {
  creerSessionEtude,
  getSessionsActives,
  rejoindreSession
};
