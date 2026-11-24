const { db } = require('../database/db');

const COOLDOWN_MINUTES = 10;
const ANONYMISATION_HOURS = 24;

/**
 * Enregistre un nouveau signalement soumis par un étudiant connecté
 */
function creerSignalement({ salleNumero, etudiantId, etat, ambiance = null, customDate = null }) {
  if (!salleNumero || !etudiantId || !etat) {
    throw { status: 400, message: 'Paramètres incomplets (salleNumero, etudiantId, etat requis).' };
  }

  const etatNormalise = etat.toUpperCase();
  if (etatNormalise !== 'LIBRE' && etatNormalise !== 'OCCUPEE') {
    throw { status: 400, message: 'État invalide. Valeurs autorisées : LIBRE ou OCCUPEE.' };
  }

  let ambianceNormalisee = null;
  if (ambiance) {
    const ambUpper = ambiance.toUpperCase();
    if (['SILENCIEUSE', 'MODEREE', 'GROUPE'].includes(ambUpper)) {
      ambianceNormalisee = ambUpper;
    }
  }

  // 1. Vérification de l'existence de la salle
  const salle = db.prepare('SELECT numero FROM salles WHERE numero = ?').get(salleNumero);
  if (!salle) {
    throw { status: 404, message: `La salle '${salleNumero}' est introuvable sur le campus.` };
  }

  const dateCourante = customDate ? new Date(customDate) : new Date();

  // 2. Règle B2.4 : Quota d'un signalement par salle toutes les 10 minutes par étudiant
  const dernierSignalementEtudiant = db.prepare(`
    SELECT dateHeure FROM signalements 
    WHERE salleNumero = ? AND etudiantId = ? 
    ORDER BY dateHeure DESC 
    LIMIT 1
  `).get(salleNumero, etudiantId);

  if (dernierSignalementEtudiant) {
    const dernierHorodatage = new Date(dernierSignalementEtudiant.dateHeure);
    const diffMs = dateCourante.getTime() - dernierHorodatage.getTime();
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

    if (diffMs < cooldownMs) {
      const minutesRestantes = Math.ceil((cooldownMs - diffMs) / (60 * 1000));
      throw {
        status: 429,
        cooldown: true,
        minutesRestantes,
        message: `Vous avez déjà signalé cette salle récemment. Par mesure anti-spam, veuillez patienter ${minutesRestantes} minute(s) avant de soumettre un nouveau signalement pour la salle ${salleNumero}.`
      };
    }
  }

  // 3. Insertion du signalement
  const dateIso = dateCourante.toISOString();
  const insert = db.prepare(`
    INSERT INTO signalements (salleNumero, etudiantId, etat, ambiance, dateHeure)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = insert.run(salleNumero, etudiantId, etatNormalise, ambianceNormalisee, dateIso);

  return {
    id: Number(result.lastInsertRowid),
    salleNumero,
    etat: etatNormalise,
    ambiance: ambianceNormalisee,
    dateHeure: dateIso,
    message: `Signalement enregistré avec succès. Salle ${salleNumero} marquée comme ${etatNormalise}${ambianceNormalisee ? ` (Ambiance : ${ambianceNormalisee})` : ''}.`
  };
}

/**
 * Règle de protection RGPD : Anonymise les signalements de plus de 24 heures
 */
function anonymiserSignalementsAnciens(dureeHeures = ANONYMISATION_HOURS) {
  const cutoffDate = new Date(Date.now() - dureeHeures * 60 * 60 * 1000).toISOString();
  
  const update = db.prepare(`
    UPDATE signalements 
    SET etudiantId = NULL 
    WHERE dateHeure <= ? AND etudiantId IS NOT NULL
  `);

  const info = update.run(cutoffDate);
  return {
    succes: true,
    enregistrementsAnonymises: info.changes,
    dateLimite: cutoffDate
  };
}

module.exports = {
  creerSignalement,
  anonymiserSignalementsAnciens,
  COOLDOWN_MINUTES,
  ANONYMISATION_HOURS
};
