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

# Génération avec vérification automatique des URLs
node src/index.js generate -i data/urls.txt -o output/sitemap.xml --check-urls

# Génération avec vérification et 20 connexions simultanées
node src/index.js generate -i data/urls.txt -o output/sitemap.xml --check-urls --concurrent 20

# Vérification seule d'un fichier d'URLs
node src/index.js check -i data/urls.txt

# Vérification d'un sitemap XML existant
node src/index.js check -s output/sitemap.xml

# Timeout long pour sites lents
node src/index.js check -i data/urls.txt --timeout 10000

# Moins de connexions simultanées pour éviter la surcharge
node src/index.js check -i data/urls.txt --concurrent 5 --timeout 8000

# Configuration conservative
node src/index.js generate -o sitemap.xml --check-urls --concurrent 3 --timeout 15000