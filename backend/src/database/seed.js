const { db } = require('./db');
const bcrypt = require('bcryptjs');

function seedDatabase() {
  console.log('🌱 Amorçage de la base de données SalleLibre...');

  // Nettoyage préalable
  db.exec(`
    DELETE FROM signalements;
    DELETE FROM creneaux;
    DELETE FROM salles;
    DELETE FROM utilisateurs;
  `);

  // 1. Insertion des utilisateurs de test
  const passwordHashStudent = bcrypt.hashSync('etudiant123', 8);
  const passwordHashAdmin = bcrypt.hashSync('admin123', 8);
  const nowIso = new Date().toISOString();

  const insertUser = db.prepare(`
    INSERT INTO utilisateurs (identifiant, role, emailEtablissement, motDePasseHash, nom, dateCreation)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('etu_001', 'ETUDIANT', 'etudiant1@univ.tn', passwordHashStudent, 'Sarra Ben Ali', nowIso);
  insertUser.run('etu_002', 'ETUDIANT', 'etudiant2@univ.tn', passwordHashStudent, 'Mohamed Trabelsi', nowIso);
  insertUser.run('adm_001', 'ADMINISTRATEUR', 'admin@univ.tn', passwordHashAdmin, 'Madame Nihel (Scolarité)', nowIso);

  // 2. Insertion des salles (Bâtiments A, B, C)
  const insertSalle = db.prepare(`
    INSERT INTO salles (numero, batiment, capacite, prises)
    VALUES (?, ?, ?, ?)
  `);

  const sallesData = [
    { numero: 'A01', batiment: 'A', capacite: 35, prises: 1 },
    { numero: 'A02', batiment: 'A', capacite: 40, prises: 1 },
    { numero: 'A105', batiment: 'A', capacite: 60, prises: 0 },
    { numero: 'B101', batiment: 'B', capacite: 25, prises: 1 },
    { numero: 'B102', batiment: 'B', capacite: 50, prises: 1 },
    { numero: 'B204', batiment: 'B', capacite: 30, prises: 0 },
    { numero: 'C101', batiment: 'C', capacite: 80, prises: 1 },
    { numero: 'C203', batiment: 'C', capacite: 45, prises: 1 },
    { numero: 'C205', batiment: 'C', capacite: 20, prises: 0 }
  ];

  for (const s of sallesData) {
    insertSalle.run(s.numero, s.batiment, s.capacite, s.prises);
  }

  // 3. Insertion des créneaux d'emploi du temps
  // On structure pour couvrir les jours 1 à 6 avec des créneaux réalistes
  const insertCreneau = db.prepare(`
    INSERT INTO creneaux (salleNumero, jour, heureDebut, heureFin, matiere)
    VALUES (?, ?, ?, ?, ?)
  `);

  const creneauxData = [
    // Lundi (1)
    { salle: 'A01', jour: 1, debut: '08:30', fin: '10:00', matiere: 'Génie Logiciel' },
    { salle: 'A01', jour: 1, debut: '14:00', fin: '15:30', matiere: 'Bases de Données Avancées' },
    { salle: 'A02', jour: 1, debut: '10:15', fin: '11:45', matiere: 'Algorithmique et Complexité' },
    { salle: 'B101', jour: 1, debut: '08:30', fin: '11:45', matiere: 'Atelier Programmation Web' },
    { salle: 'B102', jour: 1, debut: '14:00', fin: '17:15', matiere: 'Réseaux & Systèmes Distribués' },
    { salle: 'C101', jour: 1, debut: '10:15', fin: '13:15', matiere: 'Architecture des Ordinateurs' },

    // Tous les autres jours pour avoir un emploi du temps riche
    // Mardi (2)
    { salle: 'A01', jour: 2, debut: '10:15', fin: '11:45', matiere: 'Probabilités & Statistiques' },
    { salle: 'B102', jour: 2, debut: '08:30', fin: '10:00', matiere: 'Systèmes d Exploitation' },
    { salle: 'C203', jour: 2, debut: '14:00', fin: '17:00', matiere: 'Compilation' },

    // Mercredi (3)
    { salle: 'A02', jour: 3, debut: '08:30', fin: '11:45', matiere: 'UML & Analyse Objet' },
    { salle: 'C101', jour: 3, debut: '14:00', fin: '15:30', matiere: 'Sécurité Informatique' },

    // Jeudi (4)
    { salle: 'A01', jour: 4, debut: '08:30', fin: '10:00', matiere: 'Intelligence Artificielle' },
    { salle: 'B101', jour: 4, debut: '10:15', fin: '11:45', matiere: 'Droit Informatique' },
    { salle: 'C205', jour: 4, debut: '14:00', fin: '15:30', matiere: 'Anglais Technique' },

    // Vendredi (5)
    { salle: 'A02', jour: 5, debut: '14:00', fin: '17:15', matiere: 'Projet Fédérateur' },
    { salle: 'B102', jour: 5, debut: '10:15', fin: '11:45', matiere: 'Management de Projet' },

    // Samedi (6)
    { salle: 'C101', jour: 6, debut: '08:30', fin: '11:45', matiere: 'Devoirs Surveillés' }
  ];

  for (const c of creneauxData) {
    insertCreneau.run(c.salle, c.jour, c.debut, c.fin, c.matiere);
  }

  // 4. Insertion d'exemples de signalements récents et anciens
  const insertSignalement = db.prepare(`
    INSERT INTO signalements (salleNumero, etudiantId, etat, dateHeure)
    VALUES (?, ?, ?, ?)
  `);

  // Signalement très récent (< 10 min) sur A01 (libre)
  const dateMoins5Min = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  insertSignalement.run('A01', 'etu_001', 'LIBRE', dateMoins5Min);

  // Signalement datant de 45 min sur B101 (> 30 min -> état INCERTAINE)
  const dateMoins45Min = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  insertSignalement.run('B101', 'etu_002', 'LIBRE', dateMoins45Min);

  // Signalement datant de 26 heures (> 24h -> éligible à anonymisation)
  const dateMoins26h = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  insertSignalement.run('C101', 'etu_001', 'OCCUPEE', dateMoins26h);

  console.log('✅ Base de données initialisée avec succès :');
  console.log(`   - ${sallesData.length} Salles (Bâtiments A, B, C)`);
  console.log(`   - ${creneauxData.length} Créneaux de cours`);
  console.log(`   - 3 Utilisateurs (2 étudiants, 1 administrateur)`);
  console.log(`   - 3 Signalements de test (récent, incertain >30m, à anonymiser >24h)`);
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
