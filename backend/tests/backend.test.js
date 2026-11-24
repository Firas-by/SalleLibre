/**
 * Suite de Tests Automatisés de Vérification - Système SalleLibre
 * Vérification formelle des 10 règles métier et exigences du Cahier des charges.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('../src/server');
const { db } = require('../src/database/db');
const { seedDatabase } = require('../src/database/seed');
const { getSallesDisponibles } = require('../src/services/salleService');
const { creerSignalement, anonymiserSignalementsAnciens } = require('../src/services/signalementService');
const { parserEtValiderCsv } = require('../src/services/csvParserService');

let studentToken = null;
let adminToken = null;
let serverInstance = null;
let baseUrl = '';

async function runTestSuite() {
  console.log('🧪 DÉBUT DU PROTOCOLE DE TEST SALLELIBRE\n');
  let passedTests = 0;
  let totalTests = 0;

  function test(description, fn) {
    totalTests++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${description}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${description}`);
      console.error(`     Détail de l'échec : ${err.message}\n`);
    }
  }

  async function testAsync(description, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${description}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${description}`);
      console.error(`     Détail de l'échec : ${err.message}\n`);
    }
  }

  // Initialisation de la base
  seedDatabase();

  // Démarrage du serveur de test sur un port aléatoire
  await new Promise((resolve) => {
    serverInstance = app.listen(0, '127.0.0.1', () => {
      const port = serverInstance.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  console.log(`\n--- GROUPE 1 : AUTHENTIFICATION & SÉCURITÉ ACCÈS (NFR-11, B2.2) ---`);

  await testAsync('1.1 Connexion réussie avec e-mail institutionnel (@univ.tn)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'etudiant1@univ.tn', motDePasse: 'etudiant123' })
    });
    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.succes, true);
    assert.strictEqual(json.utilisateur.role, 'ETUDIANT');
    assert.ok(json.token);
    studentToken = json.token;
  });

  await testAsync('1.2 Connexion administrateur de la scolarité', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@univ.tn', motDePasse: 'admin123' })
    });
    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.utilisateur.role, 'ADMINISTRATEUR');
    adminToken = json.token;
  });

  await testAsync('1.3 Rejet d une inscription avec adresse e-mail non-institutionnelle (@gmail.com)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: 'Intrus',
        email: 'intrus@gmail.com',
        motDePasse: 'secret123'
      })
    });
    const json = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.succes, false);
    assert.ok(json.erreur.includes('institutionnels'));
  });

  console.log(`\n--- GROUPE 2 : DISPONIBILITÉ DES SALLES & FILTRAGE (B1.1, B1.2, B1.3) ---`);

  await testAsync('2.1 Consultation des salles libres en temps réel', async () => {
    const res = await fetch(`${baseUrl}/api/salles/disponibles`);
    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.succes, true);
    assert.ok(Array.isArray(json.salles));
    assert.ok(json.totalSalles > 0);
  });

  await testAsync('2.2 Filtrage par bâtiment (Bâtiment B uniquement)', async () => {
    const res = await fetch(`${baseUrl}/api/salles/disponibles?batiment=B`);
    const json = await res.json();
    assert.strictEqual(res.status, 200);
    for (const s of json.salles) {
      assert.strictEqual(s.batiment, 'B');
    }
  });

  await testAsync('2.3 Filtrage par présence de prises électriques (prises=true)', async () => {
    const res = await fetch(`${baseUrl}/api/salles/disponibles?prises=true`);
    const json = await res.json();
    assert.strictEqual(res.status, 200);
    for (const s of json.salles) {
      assert.strictEqual(s.prises, true);
    }
  });

  await testAsync('2.4 Filtrage combiné (Bâtiment A + capacité >= 35 + prises)', async () => {
    const res = await fetch(`${baseUrl}/api/salles/disponibles?batiment=A&minCapacite=35&prises=true`);
    const json = await res.json();
    assert.strictEqual(res.status, 200);
    for (const s of json.salles) {
      assert.strictEqual(s.batiment, 'A');
      assert.ok(s.capacite >= 35);
      assert.strictEqual(s.prises, true);
    }
  });

  await testAsync('2.5 Calcul et affichage du prochain cours planifié (B1.3)', async () => {
    // Simulation à 09:00 le Lundi (jour 1) : A01 a cours à 08:30-10:00 et 14:00-15:30
    const simTime = '2026-11-23T09:00:00.000Z'; // Heure simulée
    const data = getSallesDisponibles({}, new Date(simTime));
    const salleA01 = data.salles.find(s => s.numero === 'A01');
    assert.ok(salleA01);
    assert.ok(salleA01.prochainCours);
    assert.ok(salleA01.prochainCours.message.length > 0);
  });

  console.log(`\n--- GROUPE 3 : GESTION DES SIGNALEMENTS & QUOTA (B2.1, B2.2, B2.3, B2.4) ---`);

  await testAsync('3.1 Rejet de signalement émis par un utilisateur non-authentifié (B2.2)', async () => {
    const res = await fetch(`${baseUrl}/api/signalements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salleNumero: 'A02', etat: 'LIBRE' })
    });
    const json = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(json.succes, false);
  });

  await testAsync('3.2 Soumission réussie d un signalement par un étudiant connecté (B2.1)', async () => {
    const res = await fetch(`${baseUrl}/api/signalements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ salleNumero: 'A02', etat: 'OCCUPEE' })
    });
    const json = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(json.succes, true);
    assert.strictEqual(json.salleNumero, 'A02');
    assert.strictEqual(json.etat, 'OCCUPEE');
  });

  await testAsync('3.3 Quota anti-spam : Rejet du deuxième signalement sous 10 minutes (B2.4)', async () => {
    // Même étudiant, même salle A02 immédiatement après
    const res = await fetch(`${baseUrl}/api/signalements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ salleNumero: 'A02', etat: 'LIBRE' })
    });
    const json = await res.json();
    assert.strictEqual(res.status, 429);
    assert.strictEqual(json.succes, false);
    assert.strictEqual(json.cooldown, true);
    assert.ok(json.minutesRestantes > 0);
    assert.ok(json.erreur.includes('patienter'));
  });

  test('3.4 Règle d incertitude (> 30 min sans signalement) (B2.3)', () => {
    // Insérer une salle sans cours à cet instant avec signalement il y a 35 minutes
    const testDate = new Date();
    const dateMoins35m = new Date(testDate.getTime() - 35 * 60 * 1000).toISOString();
    
    db.prepare('DELETE FROM signalements WHERE salleNumero = ?').run('B204');
    db.prepare(`
      INSERT INTO signalements (salleNumero, etudiantId, etat, dateHeure)
      VALUES (?, ?, ?, ?)
    `).run('B204', 'etu_001', 'LIBRE', dateMoins35m);

    const res = getSallesDisponibles({ batiment: 'B' }, testDate);
    const salleB204 = res.salles.find(s => s.numero === 'B204');
    assert.ok(salleB204);
    assert.strictEqual(salleB204.statut, 'INCERTAINE');
    assert.ok(salleB204.motifStatut.includes('35 min'));
  });

  console.log(`\n--- GROUPE 4 : IMPORTATION CSV & GESTION DES ANOMALIES (B3.1, B3.2) ---`);

  await testAsync('4.1 Rejet de tentative d importation CSV par un simple étudiant (403)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/emplois-du-temps/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ csvContent: 'salle,jour,heureDebut,heureFin,matiere\nA01,1,08:30,10:00,Maths' })
    });
    const json = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.succes, false);
  });

  await testAsync('4.2 Rejet d un fichier CSV invalide avec indication de la ligne en erreur (B3.2)', async () => {
    const csvInvalide = fs.readFileSync(
      path.resolve(__dirname, '../../sample_data/emploi_du_temps_invalide.csv'),
      'utf-8'
    );

    const res = await fetch(`${baseUrl}/api/admin/emplois-du-temps/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ csvContent: csvInvalide })
    });
    const json = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.succes, false);
    assert.strictEqual(json.numeroLigne, 4); // La ligne 4 a 14:00 > 12:00
    assert.ok(json.erreur.includes('chronologique') || json.erreur.includes('postérieure'));
  });

  await testAsync('4.3 Importation réussie d un fichier CSV valide par l administrateur (B3.1)', async () => {
    const csvValide = fs.readFileSync(
      path.resolve(__dirname, '../../sample_data/emploi_du_temps_valide.csv'),
      'utf-8'
    );

    const res = await fetch(`${baseUrl}/api/admin/emplois-du-temps/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ csvContent: csvValide })
    });
    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.succes, true);
    assert.strictEqual(json.creneauxImportes, 10);
  });

  console.log(`\n--- GROUPE 5 : PROTECTION DES DONNÉES & RGPD (NFR-12) ---`);

  test('5.1 Anonymisation des signalements de plus de 24 heures', () => {
    // Insérer un signalement de plus de 25 heures
    const dateMoins25h = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const insertRes = db.prepare(`
      INSERT INTO signalements (salleNumero, etudiantId, etat, dateHeure)
      VALUES (?, ?, ?, ?)
    `).run('C101', 'etu_002', 'OCCUPEE', dateMoins25h);
    const id = Number(insertRes.lastInsertRowid);

    // Déclencher le job d'anonymisation pour 24h
    const anonymRes = anonymiserSignalementsAnciens(24);
    assert.strictEqual(anonymRes.succes, true);
    assert.ok(anonymRes.enregistrementsAnonymises >= 1);

    // Vérifier que etudiantId est devenu NULL
    const check = db.prepare('SELECT etudiantId FROM signalements WHERE id = ?').get(id);
    assert.strictEqual(check.etudiantId, null);
  });

  // Fermeture du serveur de test
  serverInstance.close();

  console.log('\n==================================================');
  console.log(`📊 RÉSULTAT FINAL DES TESTS : ${passedTests}/${totalTests} validés à 100%`);
  console.log('==================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Erreur fatale dans la suite de tests :', err);
  process.exit(1);
});
