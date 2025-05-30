#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { SitemapParser } from './parser.js';
import { SitemapValidator } from './validator.js';
import { SitemapGenerator } from './generator.js';
import { URLChecker } from './checker.js';
import { FileUtils, Logger, ConfigManager } from './utils.js';

class SitemapCLI {
  constructor() {
    this.parser = new SitemapParser();
    this.validator = new SitemapValidator();
    this.generator = new SitemapGenerator();
    this.checker = new URLChecker();
  }

  async run() {
    program
      .name('sitemap-generator')
      .description('Générateur de sitemap XML avec parsing REGEX avancé')
      .version('1.0.0');

    // Commande generate
    program
      .command('generate')
      .description('Génère un sitemap XML à partir d\'un fichier d\'URLs')
      .option('-i, --input <file>', 'Fichier d\'entrée contenant les URLs', './data/urls.txt')
      .option('-o, --output <file>', 'Fichier de sortie pour le sitemap XML', './output/sitemap.xml')
      .option('-f, --format <type>', 'Format d\'entrée (auto|standard|csv|pipe)', 'auto')
      .option('--no-priority', 'Exclure les priorités du sitemap')
      .option('--no-validate', 'Ignorer la validation')
      .option('--minify', 'Générer un XML minifié')
      .option('--check-urls', 'Vérifier les URLs après génération')
      .option('--concurrent <number>', 'Nombre de connexions simultanées pour vérification', '10')
      .option('--timeout <number>', 'Timeout par requête en ms', '5000')
      .action(async (options) => {
        try {
          await this.generateSitemap(options);
        } catch (error) {
          console.error(chalk.red(`❌ Erreur: ${error.message}`));
          process.exit(1);
        }
      });

    // Commande validate
    program
      .command('validate')
      .description('Valide un fichier d\'URLs sans générer le sitemap')
      .option('-i, --input <file>', 'Fichier d\'entrée à valider', './data/urls.txt')
      .option('-f, --format <type>', 'Format d\'entrée (auto|standard|csv|pipe)', 'auto')
      .action(async (options) => {
        try {
          await this.validateOnly(options);
        } catch (error) {
          console.error(chalk.red(`❌ Erreur: ${error.message}`));
          process.exit(1);
        }
      });

    // Commande parse
    program
      .command('parse')
      .description('Parse et affiche les URLs sans générer le XML')
      .option('-i, --input <file>', 'Fichier d\'entrée à parser', './data/urls.txt')
      .option('-f, --format <type>', 'Format d\'entrée (auto|standard|csv|pipe)', 'auto')
      .option('--limit <number>', 'Limiter le nombre d\'URLs affichées', '10')
      .action(async (options) => {
        try {
          await this.parseOnly(options);
        } catch (error) {
          console.error(chalk.red(`❌ Erreur: ${error.message}`));
          process.exit(1);
        }
      });

    // Commande check (NOUVELLE)
    program
      .command('check')
      .description('Vérifie les URLs pour détecter les erreurs 404')
      .option('-i, --input <file>', 'Fichier d\'entrée contenant les URLs')
      .option('-s, --sitemap <file>', 'Fichier sitemap XML à vérifier')
      .option('--concurrent <number>', 'Nombre de connexions simultanées', '10')
      .option('--timeout <number>', 'Timeout par requête en ms', '5000')
      .action(async (options) => {
        try {
          await this.checkUrls(options);
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

    const content = await FileUtils.readInputFile(options.input);
    const parseResult = this.parser.parse(content, { format: options.format });
    
    if (parseResult.urls.length === 0) {
      throw new Error('Aucune URL valide trouvée');
    }

    let urls = parseResult.urls;
    if (options.validate !== false) {
      const validation = this.validator.validateSitemap(urls);
      Logger.printValidationReport(validation);
      if (!validation.valid) {
        console.log(chalk.yellow('⚠️  Utilisation des URLs valides uniquement'));
      }
      urls = validation.validUrls;
    }

    this.generator.options.includePriority = options.priority !== false;
    this.generator.options.prettyPrint = !options.minify;
    
    const xml = this.generator.generateXML(urls);
    await FileUtils.writeOutputFile(options.output, xml);

    const stats = this.generator.generateReport(urls, xml);
    Logger.printStats(stats);

    // Vérification URLs si demandée
    if (options.checkUrls) {
      const checkerOptions = {
        concurrent: parseInt(options.concurrent) || 10,
        timeout: parseInt(options.timeout) || 5000
      };
      this.checker = new URLChecker(checkerOptions);
      const checkResults = await this.checker.checkUrls(urls, checkerOptions);
      const report = this.checker.printReport(checkResults);
      
      if (report.success) {
        console.log(chalk.green.bold('\n🎉 Sitemap généré avec succès!'));
        console.log(chalk.green('✅ Toutes les URLs sont accessibles!'));
      } else {
        console.log(chalk.yellow.bold('\n⚠️  Sitemap généré avec avertissements'));
        console.log(chalk.yellow(`⚠️  ${report.errorPercent.toFixed(1)}% d'erreurs détectées`));
        // Ne pas faire process.exit ici, juste un avertissement
      }
    } else {
      console.log(chalk.green.bold('\n🎉 Sitemap généré avec succès!'));
    }
  }

  async validateOnly(options) {
    console.log(chalk.cyan.bold('🔍 VALIDATION UNIQUEMENT'));
    console.log(chalk.cyan('═'.repeat(50)));

    const content = await FileUtils.readInputFile(options.input);
    const parseResult = this.parser.parse(content, { format: options.format });
    const validation = this.validator.validateSitemap(parseResult.urls);
    
    Logger.printValidationReport(validation);
    
    console.log(chalk.cyan('\n📋 RÉSUMÉ DE PARSING'));
    console.log(chalk.cyan('─'.repeat(30)));
    console.log(`Total lignes parsées: ${chalk.yellow(parseResult.stats.total)}`);
    console.log(`URLs extraites: ${chalk.green(parseResult.stats.success)}`);
    console.log(`Erreurs parsing: ${chalk.red(parseResult.stats.errors)}`);
    console.log(`URLs valides: ${chalk.green(validation.validUrls.length)}`);
    console.log(`URLs invalides: ${chalk.red(validation.errors.length)}`);
    
    if (!validation.valid) {
      process.exit(1);
    }
  }

  async parseOnly(options) {
    console.log(chalk.cyan.bold('📋 PARSING UNIQUEMENT'));
    console.log(chalk.cyan('═'.repeat(50)));

    const content = await FileUtils.readInputFile(options.input);
    const parseResult = this.parser.parse(content, { format: options.format });
    
    const limit = parseInt(options.limit) || 10;
    const displayUrls = parseResult.urls.slice(0, limit);
    
    console.log(chalk.cyan('\n📄 URLS PARSÉES:'));
    console.log(chalk.cyan('─'.repeat(30)));
    
    displayUrls.forEach((urlData, index) => {
      console.log(chalk.green(`\n${index + 1}. URL: ${urlData.url}`));
      console.log(`   Date: ${chalk.yellow(urlData.lastmod || 'N/A')}`);
      console.log(`   Fréq: ${chalk.blue(urlData.changefreq || 'N/A')}`);
      console.log(`   Prio: ${chalk.magenta(urlData.priority ?? 'N/A')}`);
      console.log(`   Format: ${chalk.gray(urlData.source?.format || 'unknown')}`);
    });
    
    if (parseResult.urls.length > limit) {
      console.log(chalk.gray(`\n... et ${parseResult.urls.length - limit} URLs supplémentaires`));
    }

    console.log(chalk.cyan('\n📊 STATISTIQUES PARSING'));
    console.log(chalk.cyan('─'.repeat(30)));
    console.log(`URLs trouvées: ${chalk.green(parseResult.urls.length)}`);
    console.log(`Lignes traitées: ${chalk.yellow(parseResult.stats.total)}`);
    console.log(`Erreurs: ${chalk.red(parseResult.stats.errors)}`);

    // Analyse des formats détectés
    const formats = {};
    parseResult.urls.forEach(url => {
      const format = url.source?.format || 'unknown';
      formats[format] = (formats[format] || 0) + 1;
    });

    if (Object.keys(formats).length > 0) {
      console.log(chalk.cyan('\n🔍 FORMATS DÉTECTÉS:'));
      Object.entries(formats).forEach(([format, count]) => {
        console.log(`  ${format}: ${chalk.yellow(count)} URLs`);
      });
    }
  }

  // NOUVELLE MÉTHODE checkUrls
  async checkUrls(options) {
    if (!options.input && !options.sitemap) {
      throw new Error('Vous devez spécifier soit --input soit --sitemap');
    }

    let urls = [];

    if (options.sitemap) {
      // Parser un sitemap XML existant
      console.log(chalk.cyan.bold('🔍 VÉRIFICATION SITEMAP XML'));
      console.log(chalk.cyan('═'.repeat(50)));
      
      const content = await FileUtils.readInputFile(options.sitemap);
      urls = this.parseSitemapXML(content);
    } else {
      // Parser le fichier d'URLs
      console.log(chalk.cyan.bold('🔍 VÉRIFICATION FICHIER URLs'));
      console.log(chalk.cyan('═'.repeat(50)));
      
      const content = await FileUtils.readInputFile(options.input);
      const parseResult = this.parser.parse(content);
      urls = parseResult.urls;
    }

    if (urls.length === 0) {
      throw new Error('Aucune URL trouvée à vérifier');
    }

    // Configuration du checker
    const checkerOptions = {
      concurrent: parseInt(options.concurrent) || 10,
      timeout: parseInt(options.timeout) || 5000
    };

    this.checker = new URLChecker(checkerOptions);
    const checkResults = await this.checker.checkUrls(urls, checkerOptions);
    const report = this.checker.printReport(checkResults);

    // Code de sortie approprié
    if (report.success) {
      console.log(chalk.green.bold('\n✅ Vérification terminée avec succès!'));
      process.exit(0);
    } else {
      console.log(chalk.red.bold('\n❌ Des erreurs ont été détectées!'));
      process.exit(1);
    }
  }

  // Méthode pour parser un sitemap XML
  parseSitemapXML(content) {
    const urls = [];
    const urlMatches = content.match(/<loc>(.*?)<\/loc>/g);
    
    if (urlMatches) {
      urlMatches.forEach(match => {
        const url = match.replace(/<loc>|<\/loc>/g, '').trim();
        urls.push({ url });
      });
    }
    
    console.log(chalk.green(`✅ ${urls.length} URLs extraites du sitemap XML`));
    return urls;
  }
}

// Lancement
const cli = new SitemapCLI();
cli.run().catch(error => {
  console.error(chalk.red(`💥 Erreur fatale: ${error.message}`));
  process.exit(1);
});
