# 1. Créer le projet
mkdir sitemap && cd sitemap

# 2. Initialiser npm
npm init -y

# 3. Installer les dépendances
npm install

# Génération complète
node src/index.js generate -i data/urls.txt -o output/sitemap.xml

# Validation seule
node src/index.js validate -i data/urls.txt

# Parser et afficher (avec limite)
node src/index.js parse -i data/urls.txt --limit 5

# Parser et afficher plus d'URLs
node src/index.js parse -i data/urls.txt --limit 20

# Parser sans limite (affiche 10 par défaut)
node src/index.js parse -i data/urls.txt