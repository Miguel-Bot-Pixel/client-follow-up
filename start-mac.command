#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "============================================"
echo "  Client Follow Up - demarrage local"
echo "============================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installe sur cet ordinateur."
  echo ""
  echo "1. Va sur https://nodejs.org"
  echo "2. Telecharge et installe la version LTS"
  echo "3. Relance ensuite ce fichier (double-clic sur start-mac.command)"
  echo ""
  read -p "Appuie sur Entree pour fermer..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Premiere utilisation : installation des dependances..."
  echo "(cette etape peut prendre une minute, ne ferme pas cette fenetre)"
  echo ""
  npm install
  echo ""
fi

echo "Demarrage du serveur..."
echo "IMPORTANT : laisse cette fenetre ouverte tant que tu utilises l'outil."
echo "Le navigateur va s'ouvrir automatiquement dans quelques secondes."
echo ""

( sleep 3 && open "http://localhost:3000/?desk=en" ) &

npm start
