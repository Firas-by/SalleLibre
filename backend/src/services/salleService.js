const { db } = require('../database/db');

/**
 * Convertit un objet Date en jour (1=Lundi ... 7=Dimanche) et heure formatée "HH:MM"
 */
function getDayAndHour(date) {
  // getDay() renvoie 0 pour Dimanche, 1 pour Lundi ... 6 pour Samedi
  const jsDay = date.getDay();
  const day = jsDay === 0 ? 7 : jsDay;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  return { day, timeStr };
}

/**
 * Calcule l'état dynamique de toutes les salles ou filtre selon les critères
 */
function getSallesDisponibles(filters = {}, referenceDate = new Date()) {
  const { day, timeStr } = getDayAndHour(referenceDate);

  // 1. Récupération de toutes les salles
  let query = 'SELECT * FROM salles WHERE 1=1';
  const params = [];

  if (filters.batiment) {
    query += ' AND batiment = ?';
    params.push(filters.batiment.toUpperCase());
  }

  if (filters.minCapacite) {
    query += ' AND capacite >= ?';
    params.push(Number(filters.minCapacite));
  }

  if (filters.prises !== undefined && filters.prises !== null && filters.prises !== '') {
    const prisesBool = String(filters.prises) === 'true' || String(filters.prises) === '1' ? 1 : 0;
    query += ' AND prises = ?';
    params.push(prisesBool);
  }

  query += ' ORDER BY batiment ASC, numero ASC';
  const salles = db.prepare(query).all(...params);

  // 2. Récupération de tous les créneaux pour le jour courant
  const creneauxJour = db.prepare(`
    SELECT * FROM creneaux WHERE jour = ? ORDER BY heureDebut ASC
  `).all(day);

  // 3. Récupération des derniers signalements
  const signalements = db.prepare(`
    SELECT * FROM signalements ORDER BY dateHeure DESC
  `).all();

  // Indexation des derniers signalements par salle
  const dernierSignalementParSalle = new Map();
  for (const sig of signalements) {
    if (!dernierSignalementParSalle.has(sig.salleNumero)) {
      dernierSignalementParSalle.set(sig.salleNumero, sig);
    }
  }

  const resultats = [];

  for (const salle of salles) {
    const creneauxSalle = creneauxJour.filter(c => c.salleNumero === salle.numero);

    // Vérifier si un cours officiel a lieu actuellement
    const coursEnCours = creneauxSalle.find(
      c => c.heureDebut <= timeStr && timeStr < c.heureFin
    );

    // Calculer le prochain cours de la journée (postérieur à l'heure courante)
    const prochainCours = creneauxSalle.find(c => c.heureDebut > timeStr);

    let statut; // 'LIBRE' | 'OCCUPEE' | 'INCERTAINE'
    let motifStatut = '';
    let dernierSignalementInfo = null;

    if (coursEnCours) {
      statut = 'OCCUPEE';
      motifStatut = `Cours programmé : ${coursEnCours.matiere} (jusqu'à ${coursEnCours.heureFin})`;
    } else {
      // La salle est libre à l'emploi du temps !
      // Vérifier la présence et la fraîcheur d'un signalement étudiant
      const dernierSig = dernierSignalementParSalle.get(salle.numero);

      if (dernierSig) {
        const dateSig = new Date(dernierSig.dateHeure);
        const diffMinutes = Math.floor((referenceDate.getTime() - dateSig.getTime()) / (60 * 1000));

        dernierSignalementInfo = {
          etat: dernierSig.etat,
          ambiance: dernierSig.ambiance || null,
          dateHeure: dernierSig.dateHeure,
          ilYAMinutes: Math.max(0, diffMinutes),
          anonyme: !dernierSig.etudiantId
        };

        if (diffMinutes <= 30) {
          // Confirmé récemment par un étudiant (moins de 30 min)
          statut = dernierSig.etat; // 'LIBRE' ou 'OCCUPEE'
          motifStatut = `Confirmé par un étudiant il y a ${diffMinutes} min`;
        } else {
          // Aucun signalement récent depuis plus de 30 minutes -> INCERTAINE (Règle B2.3)
          statut = 'INCERTAINE';
          motifStatut = `Libre à l'emploi du temps, mais non confirmée depuis ${diffMinutes} min`;
        }
      } else {
        // Aucun signalement historique
        statut = 'INCERTAINE';
        motifStatut = "Libre à l'emploi du temps, aucun signalement récent";
      }
    }

    resultats.push({
      numero: salle.numero,
      batiment: salle.batiment,
      capacite: salle.capacite,
      prises: Boolean(salle.prises),
      statut, // 'LIBRE' | 'OCCUPEE' | 'INCERTAINE'
      motifStatut,
      estLibreSelonEmploiDuTemps: !coursEnCours,
      coursEnCours: coursEnCours
        ? {
            matiere: coursEnCours.matiere,
            heureDebut: coursEnCours.heureDebut,
            heureFin: coursEnCours.heureFin
          }
        : null,
      prochainCours: prochainCours
        ? {
            matiere: prochainCours.matiere,
            heureDebut: prochainCours.heureDebut,
            heureFin: prochainCours.heureFin,
            message: `Prochain cours à ${prochainCours.heureDebut} (${prochainCours.matiere})`
          }
        : {
            message: "Aucun cours prévu pour le reste de la journée"
          },
      dernierSignalement: dernierSignalementInfo
    });
  }

  // Tri : Salles LIBRES d'abord, puis INCERTAINES, puis OCCUPEES
  const ordrePriorite = { LIBRE: 1, INCERTAINE: 2, OCCUPEE: 3 };
  resultats.sort((a, b) => ordrePriorite[a.statut] - ordrePriorite[b.statut]);

  return {
    horodatage: referenceDate.toISOString(),
    jourSemaine: day,
    heureReference: timeStr,
    totalSalles: resultats.length,
    sallesLibresCount: resultats.filter(s => s.statut === 'LIBRE').length,
    sallesIncertainesCount: resultats.filter(s => s.statut === 'INCERTAINE').length,
    sallesOccupeesCount: resultats.filter(s => s.statut === 'OCCUPEE').length,
    salles: resultats
  };
}

/**
 * Détail d'une salle spécifique avec historique des cours du jour
 */
function getSalleDetails(salleNumero, referenceDate = new Date()) {
  const salle = db.prepare('SELECT * FROM salles WHERE numero = ?').get(salleNumero);
  if (!salle) return null;

  const { day, timeStr } = getDayAndHour(referenceDate);

  const creneauxJour = db.prepare(`
    SELECT * FROM creneaux WHERE salleNumero = ? AND jour = ? ORDER BY heureDebut ASC
  `).all(salleNumero, day);

  const signalementsRecents = db.prepare(`
    SELECT id, salleNumero, etat, dateHeure, 
           CASE WHEN etudiantId IS NULL THEN 'Anonyme' ELSE etudiantId END as auteur
    FROM signalements 
    WHERE salleNumero = ? 
    ORDER BY dateHeure DESC 
    LIMIT 10
  `).all(salleNumero);

  const dispo = getSallesDisponibles({}, referenceDate).salles.find(s => s.numero === salleNumero);

  return {
    ...dispo,
    creneauxJour,
    historiqueSignalements: signalementsRecents
  };
}

/**
 * Algorithme intelligent : Calcule la meilleure salle de révision à l'instant présent
 */
function getMeilleureRecommandation(referenceDate = new Date()) {
  const dispo = getSallesDisponibles({}, referenceDate);
  const candidates = dispo.salles.filter(s => s.statut !== 'OCCUPEE');

  if (candidates.length === 0) {
    return {
      trouve: false,
      message: 'Toutes les salles sont actuellement occupées ou réservées sur le campus.'
    };
  }

  const { timeStr } = getDayAndHour(referenceDate);
  const [currentH, currentM] = timeStr.split(':').map(Number);
  const currentTotalM = currentH * 60 + currentM;

  const scored = candidates.map(s => {
    let score = 0;
    const motifs = [];

    // 1. Statut réel
    if (s.statut === 'LIBRE') {
      score += 45;
      motifs.push('Confirmée libre récemment');
    } else {
      score += 15; // INCERTAINE
      motifs.push('Vacante à l\'emploi du temps');
    }

    // 2. Prises électriques
    if (s.prises) {
      score += 25;
      motifs.push('Prises murales disponibles');
    }

    // 3. Durée avant prochain cours
    if (s.prochainCours && s.prochainCours.heureDebut) {
      const [nextH, nextM] = s.prochainCours.heureDebut.split(':').map(Number);
      const diffM = nextH * 60 + nextM - currentTotalM;
      if (diffM >= 120) {
        score += 30;
        motifs.push(`Plus de 2h de révision ininterrompue (${Math.floor(diffM / 60)}h${diffM % 60}m)`);
      } else if (diffM >= 60) {
        score += 20;
        motifs.push(`1h de révision ininterrompue (${diffM} min)`);
      } else {
        score += 5;
        motifs.push(`Prochain cours dans ${diffM} min`);
      }
    } else {
      score += 35;
      motifs.push('Aucun cours prévu pour le reste de la journée');
    }

    // 4. Ambiance
    if (s.dernierSignalement && s.dernierSignalement.ambiance === 'SILENCIEUSE') {
      score += 15;
      motifs.push('Ambiance silencieuse');
    }

    return {
      salle: s,
      score,
      pointsForts: motifs
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  return {
    trouve: true,
    recommandation: best.salle,
    score: best.score,
    pointsForts: best.pointsForts,
    motifSynthese: `Recommandée en priorité : ${best.pointsForts.join(' • ')}.`
  };
}

/**
 * Matrice prévisionnelle d'affluence campus par tranche horaire
 */
function getHeatmapAffluence() {
  const creneaux = db.prepare('SELECT salleNumero, jour, heureDebut, heureFin FROM creneaux').all();
  const totalSalles = db.prepare('SELECT COUNT(*) as c FROM salles').get().c || 1;

  const heures = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  const jours = [1, 2, 3, 4, 5, 6]; // Lundi à Samedi

  const matrice = {};

  for (const jour of jours) {
    matrice[jour] = {};
    for (const h of heures) {
      const creneauxActifs = creneaux.filter(c => c.jour === jour && c.heureDebut <= h && h < c.heureFin);
      const tauxOccupation = Math.round((creneauxActifs.length / totalSalles) * 100);
      matrice[jour][h] = {
        tauxOccupation,
        sallesOccupees: creneauxActifs.length,
        sallesLibresEstimees: Math.max(0, totalSalles - creneauxActifs.length),
        niveau: tauxOccupation > 65 ? 'CHARGE' : (tauxOccupation > 30 ? 'MODERE' : 'CALME')
      };
    }
  }

  return {
    joursSemaine: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
    heures,
    matrice
  };
}

module.exports = {
  getSallesDisponibles,
  getSalleDetails,
  getMeilleureRecommandation,
  getHeatmapAffluence,
  getDayAndHour
};
