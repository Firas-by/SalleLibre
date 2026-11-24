const { db } = require('../database/db');

const JOURS_MAP = {
  'lundi': 1, 'monday': 1, '1': 1,
  'mardi': 2, 'tuesday': 2, '2': 2,
  'mercredi': 3, 'wednesday': 3, '3': 3,
  'jeudi': 4, 'thursday': 4, '4': 4,
  'vendredi': 5, 'friday': 5, '5': 5,
  'samedi': 6, 'saturday': 6, '6': 6,
  'dimanche': 7, 'sunday': 7, '7': 7
};

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Analyse et valide le contenu d'un fichier CSV d'emploi du temps ligne par ligne
 * @param {string} csvContent
 * @param {boolean} remplacerExistant - Si true, vide les créneaux précédents
 */
function parserEtValiderCsv(csvContent, remplacerExistant = true) {
  if (!csvContent || typeof csvContent !== 'string') {
    throw {
      status: 400,
      numeroLigne: 1,
      message: 'Le fichier CSV est vide ou illisible.'
    };
  }

  // Découpage propre par lignes CRLF ou LF
  const lignes = csvContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  if (lignes.length < 2) {
    throw {
      status: 400,
      numeroLigne: 1,
      message: 'Le fichier CSV doit contenir au minimum une ligne d en-tête et une ligne de données.'
    };
  }

  // 1. Validation de l'en-tête (Ligne 1)
  const entete = lignes[0].split(',').map(col => col.trim().toLowerCase());
  const colonnesAttendues = ['salle', 'jour', 'heuredebut', 'heurefin', 'matiere'];
  
  // Acceptation des variantes avec underscores ou tirets (ex: heure_debut)
  const enteteNormalisee = entete.map(h => h.replace(/[_\s-]/g, ''));
  const enteteValide = colonnesAttendues.every(col => enteteNormalisee.includes(col));

  if (!enteteValide) {
    throw {
      status: 400,
      numeroLigne: 1,
      contenuLigne: lignes[0],
      message: `En-tête CSV invalide. Colonnes obligatoires attendues : ${colonnesAttendues.join(', ')}`
    };
  }

  // Récupération des salles existantes pour validation référentielle
  const sallesExistantes = new Set(
    db.prepare('SELECT numero FROM salles').all().map(s => s.numero.toUpperCase())
  );

  const creneauxAInserer = [];

  // 2. Validation ligne par ligne à partir de la ligne 2
  for (let index = 1; index < lignes.length; index++) {
    const numeroLigne = index + 1; // 1-indexé pour l'utilisateur
    const ligneBrute = lignes[index];
    const colonnes = ligneBrute.split(',').map(c => c.trim());

    if (colonnes.length < 5) {
      throw {
        status: 400,
        numeroLigne,
        contenuLigne: ligneBrute,
        message: `Nombre de colonnes insuffisant à la ligne ${numeroLigne} : attendu 5 colonnes, reçu ${colonnes.length}.`
      };
    }

    const [salleRaw, jourRaw, debutRaw, finRaw, ...matiereParts] = colonnes;
    const matiereRaw = matiereParts.join(',').trim();

    const salle = salleRaw.toUpperCase();
    if (!sallesExistantes.has(salle)) {
      throw {
        status: 400,
        numeroLigne,
        contenuLigne: ligneBrute,
        message: `Salle inconnue '${salle}' à la ligne ${numeroLigne}. Les salles doivent faire partie du référentiel campus (ex: A01, B102, C101).`
      };
    }

    const jourNormalise = jourRaw.toLowerCase();
    const jourNum = JOURS_MAP[jourNormalise];
    if (!jourNum) {
      throw {
        status: 400,
        numeroLigne,
        contenuLigne: ligneBrute,
        message: `Jour invalide '${jourRaw}' à la ligne ${numeroLigne}. Valeurs autorisées : Lundi à Dimanche (ou 1 à 7).`
      };
    }

    if (!TIME_REGEX.test(debutRaw)) {
      throw {
        status: 400,
        numeroLigne,
        contenuLigne: ligneBrute,
        message: `Format d heure de début invalide '${debutRaw}' à la ligne ${numeroLigne}. Format attendu : HH:MM (ex: 08:30).`
      };
    }

    if (!TIME_REGEX.test(finRaw)) {
      throw {
        status: 400,
        numeroLigne,
        contenuLigne: ligneBrute,
        message: `Format d heure de fin invalide '${finRaw}' à la ligne ${numeroLigne}. Format attendu : HH:MM (ex: 10:00).`
      };
    }

    if (debutRaw >= finRaw) {
      throw {
        status: 400,
        numeroLigne,
        contenuLigne: ligneBrute,
        message: `Incohérence chronologique à la ligne ${numeroLigne} : L heure de fin (${finRaw}) doit être strictement postérieure à l heure de début (${debutRaw}).`
      };
    }

    if (!matiereRaw || matiereRaw.length < 2) {
      throw {
        status: 400,
        numeroLigne,
        contenuLigne: ligneBrute,
        message: `Intitulé de matière manquant ou trop court à la ligne ${numeroLigne}.`
      };
    }

    creneauxAInserer.push({
      salleNumero: salle,
      jour: jourNum,
      heureDebut: debutRaw,
      heureFin: finRaw,
      matiere: matiereRaw
    });
  }

  // 3. Insertion transactionnelle atomique (Tout ou Rien)
  db.exec('BEGIN TRANSACTION;');
  try {
    if (remplacerExistant) {
      db.exec('DELETE FROM creneaux;');
    }

    const insert = db.prepare(`
      INSERT INTO creneaux (salleNumero, jour, heureDebut, heureFin, matiere)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const c of creneauxAInserer) {
      insert.run(c.salleNumero, c.jour, c.heureDebut, c.heureFin, c.matiere);
    }

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw {
      status: 500,
      numeroLigne: null,
      message: `Erreur interne lors de l écriture en base : ${err.message}`
    };
  }

  return {
    succes: true,
    creneauxImportes: creneauxAInserer.length,
    message: `Importation réussie : ${creneauxAInserer.length} créneaux d emploi du temps enregistrés avec succès.`
  };
}

module.exports = {
  parserEtValiderCsv,
  JOURS_MAP
};
