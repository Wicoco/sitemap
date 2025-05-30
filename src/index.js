#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { SitemapParser } from './parser.js';
import { SitemapValidator } from './validator.js';
import { SitemapGenerator } from './generator.js';
import { FileUtils, Logger, ConfigManager } from './utils.js';

class SitemapCLI {
  constructor() {
    this.parser = new SitemapParser();
    this.validator = new SitemapValidator();
    this.generator = new SitemapGenerator();
  }

  /**
   * Point d'entrée principal
   */
  async run() {
    program
      .name('sitemap-generator')
      .description('Générateur de sitemap XML avec parsing REGEX avancé')
      .version('1.0.0');

    program
      .command('generate')
      .description('Génère un sitemap XML à partir d\'un fichier d\'URLs')
      .option('-i, --input <file>', 'Fichier d\'entrée contenant les URLs', './data/urls.txt')
      .option('-o, --output <file>', 'Fichier de sortie pour le sitemap XML', './output/sitemap.xml')
      .option('-f, --format <type>', 'Format d\'entrée (auto|standard|csv|pipe)', 'auto')
      .option('--no-priority', 'Exclure les priorités du sitemap')
      .option('--no-validate', 'Ignorer la validation')
      .option('--minify', 'Générer un XML minifié')
      .option('--strict', 'Mode strict - arrêt sur erreur')
      .option('--split', 'Diviser les gros sitemaps en plusieurs fichiers')
      .option('--base-url <url>', 'URL de base pour l\'index de sitemaps')
      .action(async (options) => {
        try {
          await this.generateSitemap(options);
        } catch (error) {
          console.error(chalk.red(`❌ Erreur: ${error.message}`));
          process.exit(1);
        }
      });

    program
      .command('validate')
      .description('Valide un fichier d\'URLs sans générer le sitemap')
      .option('-i, --input <file>', 'Fichier d\'entrée à valider', './data/urls.txt')
      .option('-f, --format <type>', 'Format d\'entrée (auto|standard|csv|pipe)', 'auto')
      .option('--strict', 'Mode strict - détails complets')
      .action(async (options) => {
        try {
          await this.validateOnly(options);
        } catch (error) {
          console.error(chalk.red(`❌ Erreur: ${error.message}`));
          process.exit(1);
        }
      });

    program
      .command('parse')
      .description('Parse et affiche les URLs sans générer le XML')
      .option('-i, --input <file>', 'Fichier d\'entrée à parser', './data/urls.txt')
      .option('-f, --format <type>', 'Format d\'entrée (auto|standard|csv|pipe)', 'auto')
      .option('--limit <n>', 'Limiter l\'affichage à N URLs', '10')
      .action(async (options) => {
        try {
          await this.parseOnly(options);
        } catch (error) {
          console.error(chalk.red(`❌ Erreur: ${error.message}`));
          process.exit(1);
        }
      });

    program
      .command('init')
      .description('Initialise un projet avec les fichiers de base')
      .option('-d, --directory <dir>', 'Répertoire de destination', './sitemap-project')
      .action(async (options) => {
        try {
          await this.initProject(options);
        } catch (error) {
          console.error(chalk.red(`❌ Erreur: ${error.message}`));
          process.exit(1);
        }
      });

    // Commande par défaut si aucun argument
    if (process.argv.length <= 2) {
      await this.generateSitemap(ConfigManager.getDefaultConfig());
    } else {
      program.parse();
    }
  }

  /**
   * Génère un sitemap complet
   */
  async generateSitemap(options) {
    console.log(chalk.cyan.bold('🚀 GÉNÉRATEUR DE SITEMAP XML'));
    console.log(chalk.cyan('═'.repeat(50)));

    // 1. Lecture du fichier d'entrée
    const content = await FileUtils.readInputFile(options.input);

    // 2. Parsing des données
    const parseResult = this.parser.parse(content, { format: options.format });
    
    if (parseResult.urls.length === 0) {
      throw new Error('Aucune URL valide trouvée dans le fichier d\'entrée');
    }

    // 3. Validation (si activée)
    let validationResult;
    if (options.validate !== false) {
      validationResult = this.validator.validateSitemap(parseResult.urls);
      
      if (!validationResult.valid && options.strict) {
        Logger.printValidationReport(validationResult);
        throw new Error('Validation échouée en mode strict');
      }
    }

    // 4. Configuration du générateur
    this.generator.options.includePriority = options.priority !== false;
    this.generator.options.prettyPrint = !options.minify;

    // 5. Génération du XML
    const urls = validationResult ? validationResult.validUrls : parseResult.urls;
    
    if (options.split && urls.length > 50000) {
      await this.generateMultipleSitemaps(urls, options);
    } else {
      const xml = this.generator.generateXML(urls);
      await FileUtils.writeOutputFile(options.output, xml);
      
      // 6. Statistiques et rapport
      const stats = this.generator.generateReport(urls, xml);
      Logger.printStats(stats);
    }

    if (validationResult) {
      Logger.printValidationReport(validationResult);
    }

    console.log(chalk.green.bold('\n🎉 Sitemap généré avec succès!'));
  }

  /**
   * Génère plusieurs sitemaps si nécessaire
   */
  async generateMultipleSitemaps(urls, options) {
    console.log(chalk.yellow(`⚠️  URLs trop nombreuses (${urls.length}), division en plusieurs fichiers...`));
    
    const sitemaps = this.generator.splitSitemap(urls);
    const files = await FileUtils.writeMultipleFiles(sitemaps, './output');
    
    // Générer l'index si une URL de base est fournie
    if (options.baseUrl) {
      const indexXML = this.generator.generateSitemapIndex(sitemaps, options.baseUrl);
      await FileUtils.writeOutputFile('./output/sitemap_index.xml', indexXML);
      
      console.log(chalk.green(`✅ Index de sitemap créé: sitemap_index.xml`));
    }

    console.log(chalk.cyan('\n📄 FICHIERS GÉNÉRÉS:'));
    files.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.filename} (${file.urls} URLs, ${this.generator.formatBytes(file.size)})`);
    });
  }

  /**
   * Validation uniquement
   */
  async validateOnly(options) {
    console.log(chalk.cyan.bold('🔍 VALIDATION DES URLS'));
    console.log(chalk.cyan('═'.repeat(50)));

    const content = await FileUtils.readInputFile(options.input);
    const parseResult = this.parser.parse(content, { format: options.format });
    
    const validationResult = this.validator.validateSitemap(parseResult.urls);
    Logger.printValidationReport(validationResult);

    if (options.strict && validationResult.stats) {
      Logger.printStats({
        urlCount: validationResult.validUrls.length,
        ...validationResult.stats
      });
    }

    console.log(validationResult.valid ? 
      chalk.green.bold('\n✅ Validation réussie!') : 
      chalk.red.bold('\n❌ Validation échouée!')
    );
  }

  /**
   * Parsing uniquement pour test
   */
  async parseOnly(options) {
    console.log(chalk.cyan.bold('🔍 PARSING DES URLS'));
    console.log(chalk.cyan('═'.repeat(50)));

    const content = await FileUtils.readInputFile(options.input);
    const parseResult = this.parser.parse(content, { format: options.format });
    
    const limit = parseInt(options.limit) || 10;
    const displayUrls = parseResult.urls.slice(0, limit);

    console.log(chalk.cyan(`\n📋 URLs PARSÉES (${displayUrls.length}/${parseResult.urls.length}):`));
    displayUrls.forEach((url, index) => {
      console.log(chalk.gray(`${index + 1}.`), chalk.blue(url.url));
      console.log(`   📅 ${url.lastmod} | 🔄 ${url.changefreq} | ⭐ ${url.priority}`);
      if (url.source) {
        console.log(`   📍 Ligne ${url.source.line} (${url.source.pattern})`);
      }
      console.log('');
    });

    if (parseResult.urls.length > limit) {
      console.log(chalk.yellow(`... et ${parseResult.urls.length - limit} URLs supplémentaires`));
    }
  }

  /**
   * Initialise un nouveau projet
   */
  async initProject(options) {
    console.log(chalk.cyan.bold('🏗️  INITIALISATION DU PROJET'));
    console.log(chalk.cyan('═'.repeat(50)));

    const projectDir = options.directory;
    
    // Structure des dossiers
    const folders = [
      `${projectDir}/data`,
      `${projectDir}/output`,
      `${projectDir}/config`
    ];

    for (const folder of folders) {
      await FileUtils.writeOutputFile(`${folder}/.gitkeep`, '');
    }

    // Fichier d'exemple
    const exampleUrls = `# Exemple de fichier URLs pour sitemap
# Format: URL DATE FREQUENCY [PRIORITY]
# Les lignes commençant par # sont ignorées

https://www.example.com/ 2024-01-15T10:00:00Z daily 1.0
https://www.example.com/products 2024-01-14T15:30:00Z weekly 0.9
https://www.example.com/blog 2024-01-13T08:45:00Z daily 0.8
https://www.example.com/contact 2024-01-12T12:00:00Z monthly 0.6
https://www.example.com/about 2024-01-11T14:15:00Z yearly 0.5

# Format alternatif avec pipes
https://www.example.com/docs | 2024-01-10T09:30:00Z | weekly | 0.7

# Format CSV (sans en-tête)
https://www.example.com/support,2024-01-09T16:45:00Z,monthly,0.6
`;

    await FileUtils.writeOutputFile(`${projectDir}/data/urls.txt`, exampleUrls);

    // Fichier de configuration
    const configFile = `{
  "input": "./data/urls.txt",
  "output": "./output/sitemap.xml",
  "format": "auto",
  "includePriority": true,
  "prettyPrint": true,
  "validate": true,
  "strict": false,
  "maxUrls": 50000,
  "splitLarge": true,
  "baseUrl": "https://www.example.com"
}`;

    await FileUtils.writeOutputFile(`${projectDir}/config/sitemap.json`, configFile);

    // Scripts package.json
    const packageJson = `{
  "name": "my-sitemap-generator",
  "version": "1.0.0",
  "description": "Générateur de sitemap pour mon site",
  "scripts": {
    "generate": "sitemap-gen generate -i data/urls.txt -o output/sitemap.xml",
    "validate": "sitemap-gen validate -i data/urls.txt",
    "parse": "sitemap-gen parse -i data/urls.txt",
    "watch": "sitemap-gen generate --watch"
  },
  "dependencies": {
    "sitemap-xml-generator": "^1.0.0"
  }
}`;

    await FileUtils.writeOutputFile(`${projectDir}/package.json`, packageJson);

    // README
    const readme = `# Générateur de Sitemap

Ce projet utilise le générateur de sitemap XML pour créer automatiquement des sitemaps conformes aux standards.

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
# Générer un sitemap
npm run generate

# Valider les URLs
npm run validate

# Parser et afficher les URLs
npm run parse
\`\`\`

## Structure des fichiers

- \`data/urls.txt\` - Fichier contenant les URLs à inclure
- \`output/sitemap.xml\` - Sitemap XML généré
- \`config/sitemap.json\` - Configuration du générateur

## Format des URLs

Le fichier \`data/urls.txt\` supporte plusieurs formats :

\`\`\`
# Format standard
URL DATE FREQUENCY [PRIORITY]

# Format avec pipes  
URL | DATE | FREQUENCY | PRIORITY

# Format CSV
URL,DATE,FREQUENCY,PRIORITY
\`\`\`

## Exemple

\`\`\`
https://www.example.com/ 2024-01-15T10:00:00Z daily 1.0
https://www.example.com/products 2024-01-14T15:30:00Z weekly 0.9
\`\`\`
`;

    await FileUtils.writeOutputFile(`${projectDir}/README.md`, readme);

    console.log(chalk.green(`✅ Projet initialisé dans: ${projectDir}`));
    console.log(chalk.cyan('\n📁 Structure créée:'));
    console.log(`  ${projectDir}/`);
    console.log(`  ├── data/urls.txt`);
    console.log(`  ├── output/`);
    console.log(`  ├── config/sitemap.json`);
    console.log(`  ├── package.json`);
    console.log(`  └── README.md`);
    
    console.log(chalk.yellow('\n📝 Étapes suivantes:'));
    console.log(`  1. cd ${projectDir}`);
    console.log(`  2. Modifiez data/urls.txt avec vos URLs`);
    console.log(`  3. npm run generate`);
  }
}

// Point d'entrée
const cli = new SitemapCLI();
cli.run().catch(error => {
  console.error(chalk.red(`💥 Erreur fatale: ${error.message}`));
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
  process.exit(1);
});

export default SitemapCLI;
