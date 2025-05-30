# 1. Créer le projet
mkdir sitemap && cd sitemap

# 2. Initialiser npm
npm init -y

# 3. Installer les dépendances
npm install

# 4. Créer la structure des fichiers

# 5. Générer un sitemap
node src/index.js generate -i data/urls.txt -o output/sitemap.xml

# Validation seule
node src/index.js validate -i data/urls.txt

# Parser et afficher
node src/index.js parse -i data/urls.txt --limit 5
