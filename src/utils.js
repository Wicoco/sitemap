import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import chalk from 'chalk';

export class FileUtils {
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

  static async writeOutputFile(filePath, content) {
    try {
      await mkdir(dirname(resolve(filePath)), { recursive: true });
      console.log(chalk.blue(`💾 Écriture du fichier: ${filePath}`));
      await writeFile(filePath, content, 'utf-8');
      console.log(chalk.green(`✅ Fichier écrit: ${filePath}`));
    } catch (error) {
      throw new Error(`Impossible d'écrire le fichier ${filePath}: ${error.message}`);
    }
  }
}

export class Logger {
  static printStats(stats) {
    console.log(chalk.cyan('\n📊 STATISTIQUES'));
    console.log(chalk.cyan('═'.repeat(30)));
    console.log(`URLs: ${chalk.yellow(stats.urlCount)}`);
    console.log(`Taille: ${chalk.yellow(stats.xmlSizeFormatted)}`);
    console.log(`Domaines: ${chalk.yellow(stats.domains.length)}`);
    
    if (Object.keys(stats.changefreqDistribution).length > 0) {
      console.log(chalk.cyan('\nFréquences:'));
      Object.entries(stats.changefreqDistribution).forEach(([freq, count]) => {
        console.log(`  ${freq}: ${chalk.yellow(count)}`);
      });
    }
  }

  static printValidationReport(validation) {
    console.log(chalk.cyan('\n🔍 VALIDATION'));
    console.log(chalk.cyan('─'.repeat(20)));
    
    if (validation.valid) {
      console.log(chalk.green('✅ Validation OK'));
    } else {
      console.log(chalk.red('❌ Erreurs détectées'));
      validation.errors.slice(0, 5).forEach(error => {
        console.log(chalk.red(`  • ${error}`));
      });
    }
    
    console.log(`URLs valides: ${chalk.green(validation.validUrls.length)}`);
    
    if (validation.warnings.length > 0) {
      console.log(chalk.yellow(`Avertissements: ${validation.warnings.length}`));
    }
  }
}

export class ConfigManager {
  static getDefaultConfig() {
    return {
      input: './data/urls.txt',
      output: './output/sitemap.xml',
      format: 'auto',
      priority: true,
      validate: true,
      minify: false
    };
  }
}
