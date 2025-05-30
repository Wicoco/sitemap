import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import chalk from 'chalk';

export class FileUtils {
  /**
   * Lit un fichier de manière asynchrone
   */
  static async readInputFile(filePath) {
    try {
      console.log(chalk.blue(`📂 Lecture du fichier: ${filePath}`));
      const content = await readFile(filePath, 'utf-8');
      console.log(chalk.green(`✅ Fichier lu: ${content.length} caractères`));
      return content;
    } catch (error) {
      throw new Error(`Impossible de lire le fichier ${filePath}: ${error.message}`);
    }
  }

  /**
   * Écrit un fichier de manière asynchrone
   */
  static async writeOutputFile(filePath, content) {
    try {
      // Créer le répertoire si nécessaire
      await mkdir(dirname(resolve(filePath)), { recursive: true });
      
      console.log(chalk.blue(`💾 Écriture du fichier: ${filePath}`));
      await writeFile(filePath, content, 'utf-8');
      console.log(chalk.green(`✅ Fichier écrit: ${filePath} (${content.length} caractères)`));
    } catch (error) {
      throw new Error(`Impossible d'écrire le fichier ${filePath}: ${error.message}`);
    }
  }

  /**
   * Écrit plusieurs fichiers (pour sitemaps multiples)
   */
  static async writeMultipleFiles(files, outputDir = './output') {
    const results = [];
    
    for (const file of files) {
      const fullPath = resolve(outputDir, file.filename);
      await this.writeOutputFile(fullPath, file.content);
      results.push({
        filename: file.filename,
        path: fullPath,
        size: file.content.length,
        urls: file.urlCount
      });
    }
    
    return results;
  }
}

export class Logger {
  /**
   * Affiche un rapport de statistiques
   */
  static printStats(stats) {
    console.log(chalk.cyan('\n📊 STATISTIQUES'));
    console.log(chalk.cyan('═'.repeat(50)));
    
    console.log(`${chalk.bold('URLs totales:')} ${stats.urlCount}`);
    console.log(`${chalk.bold('Taille XML:')} ${stats.xmlSizeFormatted}`);
    console.log(`${chalk.bold('Domaines:')} ${stats.domains.length}`);
    
    if (Object.keys(stats.changefreqDistribution).length > 0) {
      console.log(`\n${chalk.bold('Fréquences de mise à jour:')}`);
      Object.entries(stats.changefreqDistribution)
        .sort(([,a], [,b]) => b - a)
        .forEach(([freq, count]) => {
          console.log(`  ${freq}: ${count}`);
        });
    }
    
    if (stats.dateRange.oldest && stats.dateRange.newest) {
      console.log(`\n${chalk.bold('Plage de dates:')}`);
      console.log(`  Plus ancienne: ${stats.dateRange.oldest.toISOString().split('T')[0]}`);
      console.log(`  Plus récente: ${stats.dateRange.newest.toISOString().split('T')[0]}`);
    }
  }

  /**
   * Affiche un rapport de validation
   */
  static printValidationReport(validation) {
    console.log(chalk.cyan('\n🔍 RAPPORT DE VALIDATION'));
    console.log(chalk.cyan('═'.repeat(50)));
    
    if (validation.valid) {
      console.log(chalk.green('✅ Validation réussie!'));
    } else {
      console.log(chalk.red('❌ Validation échouée!'));
      validation.errors.forEach(error => {
        console.log(chalk.red(`  • ${error}`));
      });
    }
    
    if (validation.warnings?.length > 0) {
      console.log(chalk.yellow('\n⚠️  Avertissements:'));
      validation.warnings.forEach(warning => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }
  }

  /**
   * Affiche la progression
   */
  static printProgress(step, total, message) {
    const percentage = Math.round((step / total) * 100);
    const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
    console.log(`${chalk.blue(bar)} ${percentage}% ${message}`);
  }
}

export class ConfigManager {
  static getDefaultConfig() {
    return {
      input: './data/urls.txt',
      output: './output/sitemap.xml',
      format: 'auto',
      includePriority: true,
      prettyPrint: true,
      validate: true,
      strict: false,
      maxUrls: 50000,
      splitLarge: true,
      baseUrl: null
    };
  }

  static mergeConfig(userConfig = {}) {
    return { ...this.getDefaultConfig(), ...userConfig };
  }
}
