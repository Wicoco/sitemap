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
      .action(async (options) => {
        try {
          await this.validateOnly(options);
        } catch (error) {
          console.error(chalk.red(`❌ Erreur: ${error.message}`));
          process.exit(1);
        }
      });

    if (process.argv.length <= 2) {
      await this.generateSitemap(ConfigManager.getDefaultConfig());
    } else {
      program.parse();
    }
  }

  async generateSitemap(options) {
    console.log(chalk.cyan.bold('🚀 GÉNÉRATEUR DE SITEMAP XML'));
    console.log(chalk.cyan('═'.repeat(50)));

    // 1. Lecture du fichier
    const content = await FileUtils.readInputFile(options.input);

    // 2. Parsing des données
    const parseResult = this.parser.parse(content, { format: options.format });
    
    if (parseResult.urls.length === 0) {
      throw new Error('Aucune URL valide trouvée');
    }

    // 3. Validation (optionnelle)
    let urls = parseResult.urls;
    if (options.validate !== false) {
      const validation = this.validator.validateSitemap(urls);
      Logger.printValidationReport(validation);
      if (!validation.valid) {
        console.log(chalk.yellow('⚠️  Utilisation des URLs valides uniquement'));
      }
      urls = validation.validUrls;
    }

    // 4. Génération XML
    this.generator.options.includePriority = options.priority !== false;
    this.generator.options.prettyPrint = !options.minify;
    
    const xml = this.generator.generateXML(urls);
    await FileUtils.writeOutputFile(options.output, xml);

    // 5. Statistiques
    const stats = this.generator.generateReport(urls, xml);
    Logger.printStats(stats);

    console.log(chalk.green.bold('\n🎉 Sitemap généré avec succès!'));
  }

  async validateOnly(options) {
    console.log(chalk.cyan.bold('🔍 VALIDATION UNIQUEMENT'));
    console.log(chalk.cyan('═'.repeat(50)));

    const content = await FileUtils.readInputFile(options.input);
    const parseResult = this.parser.parse(content);
    const validation = this.validator.validateSitemap(parseResult.urls);
    
    Logger.printValidationReport(validation);
    
    if (!validation.valid) {
      process.exit(1);
    }
  }
}

// Lancement
const cli = new SitemapCLI();
cli.run().catch(error => {
  console.error(chalk.red(`💥 Erreur fatale: ${error.message}`));
  process.exit(1);
});
