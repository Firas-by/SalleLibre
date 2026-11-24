#!/bin/bash
echo "========================================================="
echo "  SALLELIBRE - Système de Repérage des Salles Libres"
echo "  Lancement de la Démonstration Complète (MVP Production)"
echo "========================================================="
echo ""

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/backend"

if ! command -v node &> /dev/null; then
    echo "Erreur : Node.js n'est pas installé."
    exit 1
fi

echo "[1/2] Initialisation du jeu de données de démonstration enrichi..."
node src/database/seed_demo.js

echo ""
echo "[2/2] Démarrage du serveur Node.js et du client Web réactif intégré..."
echo "Le service est accessible sur : http://localhost:3005"
echo ""

node src/server.js
