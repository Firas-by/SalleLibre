const { db } = require('./db');
const bcrypt = require('bcryptjs');

function seedDemoData() {
  console.log('🚀 Initialisation du jeu de données de démonstration enrichi SalleLibre...');

  // Nettoyage complet
  db.exec(`
    DELETE FROM sessions_etude;
    DELETE FROM signalements;
    DELETE FROM creneaux;
    DELETE FROM salles;
    DELETE FROM utilisateurs;
  `);

  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Utilisateurs campus
  const passStudent = bcrypt.hashSync('etudiant123', 8);
  const passAdmin = bcrypt.hashSync('admin123', 8);

  const insertUser = db.prepare(`
    INSERT INTO utilisateurs (identifiant, role, emailEtablissement, motDePasseHash, nom, dateCreation)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('etu_001', 'ETUDIANT', 'etudiant1@univ.tn', passStudent, 'Sarra Ben Ali (GL 3)', nowIso);
  insertUser.run('etu_002', 'ETUDIANT', 'etudiant2@univ.tn', passStudent, 'Mohamed Trabelsi (RT 2)', nowIso);
  insertUser.run('etu_003', 'ETUDIANT', 'etudiant3@univ.tn', passStudent, 'Yasmine Karray (IIA 1)', nowIso);
  insertUser.run('etu_004', 'ETUDIANT', 'etudiant4@univ.tn', passStudent, 'Karim Bouazizi (GL 2)', nowIso);
  insertUser.run('adm_001', 'ADMINISTRATEUR', 'admin@univ.tn', passAdmin, 'Mme Nihel (Directrice Scolarité)', nowIso);
  insertUser.run('adm_002', 'ADMINISTRATEUR', 'scolarite@univ.tn', passAdmin, 'Bureau Scolarité & Planning', nowIso);

  // 2. Salles des bâtiments A, B et C
  const insertSalle = db.prepare(`
    INSERT INTO salles (numero, batiment, capacite, prises)
    VALUES (?, ?, ?, ?)
  `);

  const salles = [
    { numero: 'A01', batiment: 'A', capacite: 35, prises: 1 },
    { numero: 'A02', batiment: 'A', capacite: 40, prises: 1 },
    { numero: 'A105', batiment: 'A', capacite: 60, prises: 0 },
    { numero: 'B101', batiment: 'B', capacite: 25, prises: 1 },
    { numero: 'B102', batiment: 'B', capacite: 50, prises: 1 },
    { numero: 'B204', batiment: 'B', capacite: 30, prises: 0 },
    { numero: 'C101', batiment: 'C', capacite: 80, prises: 1 },
    { numero: 'C203', batiment: 'C', capacite: 45, prises: 1 },
    { numero: 'C205', batiment: 'C', capacite: 20, prises: 0 },
  ];

  for (const s of salles) {
    insertSalle.run(s.numero, s.batiment, s.capacite, s.prises);
  }

  // 3. Emploi du temps officiel hebdomadaire complet (Lundi à Samedi)
  const insertCreneau = db.prepare(`
    INSERT INTO creneaux (salleNumero, jour, heureDebut, heureFin, matiere)
    VALUES (?, ?, ?, ?, ?)
  `);

  const creneaux = [
    // Lundi (1)
    { salle: 'A01', jour: 1, debut: '08:30', fin: '10:00', matiere: 'Génie Logiciel Avancé' },
    { salle: 'A01', jour: 1, debut: '14:00', fin: '15:30', matiere: 'Bases de Données NoSQL' },
    { salle: 'A02', jour: 1, debut: '10:15', fin: '11:45', matiere: 'Algorithmique & Graphes' },
    { salle: 'A105', jour: 1, debut: '08:30', fin: '11:45', matiere: 'Architecture des Ordinateurs' },
    { salle: 'B101', jour: 1, debut: '10:15', fin: '13:15', matiere: 'Atelier Conception UML' },
    { salle: 'B102', jour: 1, debut: '14:00', fin: '17:15', matiere: 'Réseaux & Protocoles IP' },
    { salle: 'C101', jour: 1, debut: '08:30', fin: '11:45', matiere: 'Mathématiques pour l Ingénieur' },
    { salle: 'C203', jour: 1, debut: '14:00', fin: '16:00', matiere: 'Compilation & Langages' },

    // Mardi (2)
    { salle: 'A01', jour: 2, debut: '10:15', fin: '11:45', matiere: 'Probabilités & Statistiques' },
    { salle: 'A02', jour: 2, debut: '14:00', fin: '17:15', matiere: 'Intelligence Artificielle & Deep Learning' },
    { salle: 'B101', jour: 2, debut: '08:30', fin: '11:45', matiere: 'Développement Web Avancé' },
    { salle: 'B102', jour: 2, debut: '08:30', fin: '10:00', matiere: 'Systèmes d Exploitation Linux' },
    { salle: 'B204', jour: 2, debut: '14:00', fin: '15:30', matiere: 'Anglais Professionnel' },
    { salle: 'C101', jour: 2, debut: '10:15', fin: '13:15', matiere: 'Sécurité des Systèmes d Information' },
    { salle: 'C205', jour: 2, debut: '14:00', fin: '17:00', matiere: 'Projet de Fin d Année' },

    // Mercredi (3)
    { salle: 'A01', jour: 3, debut: '08:30', fin: '11:45', matiere: 'Cloud Computing & Microservices' },
    { salle: 'A02', jour: 3, debut: '10:15', fin: '11:45', matiere: 'UML & Design Patterns' },
    { salle: 'B101', jour: 3, debut: '14:00', fin: '17:15', matiere: 'Sécurité Réseaux & Cryptographie' },
    { salle: 'C101', jour: 3, debut: '14:00', fin: '15:30', matiere: 'Droit Numérique & RGPD' },
    { salle: 'C203', jour: 3, debut: '08:30', fin: '10:00', matiere: 'Systèmes Temps Réel' },

    // Jeudi (4)
    { salle: 'A01', jour: 4, debut: '08:30', fin: '10:00', matiere: 'Programmation Fonctionnelle' },
    { salle: 'A02', jour: 4, debut: '14:00', fin: '16:30', matiere: 'Atelier DevOps & CI/CD' },
    { salle: 'B102', jour: 4, debut: '10:15', fin: '11:45', matiere: 'Gestion Agile de Projet (Scrum)' },
    { salle: 'B204', jour: 4, debut: '08:30', fin: '10:00', matiere: 'Communication Interpersonnelle' },
    { salle: 'C101', jour: 4, debut: '10:15', fin: '13:15', matiere: 'Traitement du Signal' },
    { salle: 'C205', jour: 4, debut: '14:00', fin: '15:30', matiere: 'Entrepreneuriat Technologique' },

    // Vendredi (5)
    { salle: 'A01', jour: 5, debut: '14:00', fin: '17:15', matiere: 'Soutenance de Projets' },
    { salle: 'A02', jour: 5, debut: '08:30', fin: '11:45', matiere: 'Recherche Opérationnelle' },
    { salle: 'B101', jour: 5, debut: '10:15', fin: '11:45', matiere: 'Qualité Logicielle & Tests' },
    { salle: 'B102', jour: 5, debut: '14:00', fin: '16:00', matiere: 'Management des Systèmes d Information' },
    { salle: 'C101', jour: 5, debut: '08:30', fin: '11:45', matiere: 'Conférences Industrielles' },

    // Samedi (6)
    { salle: 'A01', jour: 6, debut: '08:30', fin: '11:45', matiere: 'Devoirs Surveillés Communs' },
    { salle: 'B102', jour: 6, debut: '08:30', fin: '11:45', matiere: 'Examens Pratiques' },
    { salle: 'C101', jour: 6, debut: '08:30', fin: '11:45', matiere: 'Rattrapages & Révisions' },
  ];

  for (const c of creneaux) {
    insertCreneau.run(c.salle, c.jour, c.debut, c.fin, c.matiere);
  }

  // 4. Signalements dynamiques ancrés dans le temps réel
  const insertSignalement = db.prepare(`
    INSERT INTO signalements (salleNumero, etudiantId, etat, ambiance, dateHeure)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Signalement 1 : A01, il y a 4 minutes -> Confirmée LIBRE, silencieuse
  const dateMoins4m = new Date(Date.now() - 4 * 60 * 1000).toISOString();
  insertSignalement.run('A01', 'etu_001', 'LIBRE', 'SILENCIEUSE', dateMoins4m);

  // Signalement 2 : A02, il y a 11 minutes -> Confirmée LIBRE, silencieuse
  const dateMoins11m = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  insertSignalement.run('A02', 'etu_002', 'LIBRE', 'SILENCIEUSE', dateMoins11m);

  // Signalement 3 : B102, il y a 8 minutes -> Confirmée LIBRE, modérée
  const dateMoins8m = new Date(Date.now() - 8 * 60 * 1000).toISOString();
  insertSignalement.run('B102', 'etu_003', 'LIBRE', 'MODEREE', dateMoins8m);

  // Signalement 4 : C101, il y a 6 minutes -> Signalée OCCUPEE (groupe d'étude complet)
  const dateMoins6m = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  insertSignalement.run('C101', 'etu_004', 'OCCUPEE', 'GROUPE', dateMoins6m);

  // Signalement 5 : B101, il y a 38 minutes (> 30 min) -> Démontre la règle B2.3 d'INCERTITUDE
  const dateMoins38m = new Date(Date.now() - 38 * 60 * 1000).toISOString();
  insertSignalement.run('B101', 'etu_001', 'LIBRE', 'SILENCIEUSE', dateMoins38m);

  // Signalements 6 & 7 : Historique d'hier (> 26 heures) -> Démontre l'anonymisation RGPD (NFR-12)
  const dateMoins26h = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  insertSignalement.run('C203', 'etu_002', 'LIBRE', 'SILENCIEUSE', dateMoins26h);
  insertSignalement.run('A105', 'etu_003', 'OCCUPEE', 'GROUPE', dateMoins26h);

  // 5. Sessions d'Entraide Collaborative (Study Beacons)
  const insertSession = db.prepare(`
    INSERT INTO sessions_etude (salleNumero, createurId, matiere, description, placesDisponibles, dateHeureDebut, actif)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  insertSession.run('A01', 'etu_001', 'Génie Logiciel Avancé', 'Révision examen blanc et diagrammes de classes. Entraide et partage de fiches !', 3, dateMoins4m);
  insertSession.run('B102', 'etu_002', 'Génie Logiciel & UML', 'Prépa examen : Diagrammes de séquence, cas d utilisation et API.', 2, dateMoins8m);

  console.log('✅ Base de données SalleLibre initialisée avec succès :');
  console.log(`   - 9 Salles de cours campus (Bâtiments A, B, C)`);
  console.log(`   - 28 Créneaux de cours hebdomadaires (Lundi à Samedi)`);
  console.log(`   - 6 Comptes utilisateurs (4 étudiants, 2 administrateurs scolarité)`);
  console.log(`   - 7 Signalements dynamiques avec ambiances sonores & tests de règles temporelles.`);
}

if (require.main === module) {
  seedDemoData();
}

module.exports = { seedDemoData };
