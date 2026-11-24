const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// Assurer l'existence du dossier de stockage
const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'salle_libre.db');
const db = new DatabaseSync(dbPath);

// Activation des clés étrangères et du mode WAL pour performance
db.exec('PRAGMA foreign_keys = ON;');

// Initialisation du schéma relationnel conforme aux exigences du Cahier des Charges
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      identifiant TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('ETUDIANT', 'ADMINISTRATEUR')),
      emailEtablissement TEXT UNIQUE NOT NULL,
      motDePasseHash TEXT NOT NULL,
      nom TEXT NOT NULL,
      dateCreation TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS salles (
      numero TEXT PRIMARY KEY,
      batiment TEXT NOT NULL,
      capacite INTEGER NOT NULL,
      prises INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS creneaux (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salleNumero TEXT NOT NULL REFERENCES salles(numero) ON DELETE CASCADE,
      jour INTEGER NOT NULL CHECK(jour BETWEEN 1 AND 7),
      heureDebut TEXT NOT NULL,
      heureFin TEXT NOT NULL,
      matiere TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS signalements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salleNumero TEXT NOT NULL REFERENCES salles(numero) ON DELETE CASCADE,
      etudiantId TEXT,
      etat TEXT NOT NULL CHECK(etat IN ('LIBRE', 'OCCUPEE')),
      ambiance TEXT CHECK(ambiance IN ('SILENCIEUSE', 'MODEREE', 'GROUPE')),
      dateHeure TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions_etude (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salleNumero TEXT NOT NULL REFERENCES salles(numero) ON DELETE CASCADE,
      createurId TEXT NOT NULL REFERENCES utilisateurs(identifiant) ON DELETE CASCADE,
      matiere TEXT NOT NULL,
      description TEXT,
      placesDisponibles INTEGER NOT NULL DEFAULT 4,
      dateHeureDebut TEXT NOT NULL,
      actif INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_creneaux_salle_jour ON creneaux(salleNumero, jour);
    CREATE INDEX IF NOT EXISTS idx_signalements_salle_date ON signalements(salleNumero, dateHeure);
    CREATE INDEX IF NOT EXISTS idx_signalements_etudiant ON signalements(etudiantId);
    CREATE INDEX IF NOT EXISTS idx_sessions_salle ON sessions_etude(salleNumero, actif);
  `);

  // Migrations douces pour la base existante
  try {
    db.exec(`ALTER TABLE signalements ADD COLUMN ambiance TEXT CHECK(ambiance IN ('SILENCIEUSE', 'MODEREE', 'GROUPE'));`);
  } catch (_) {}

  try {
    db.exec(`ALTER TABLE utilisateurs ADD COLUMN karmaScore INTEGER NOT NULL DEFAULT 100;`);
  } catch (_) {}
}

initSchema();

module.exports = { db, dbPath };
