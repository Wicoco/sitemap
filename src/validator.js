import chalk from 'chalk';
import validator from 'validator';

export class SitemapValidator {
  constructor() {
    this.validChangefreqs = new Set([
      'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'
    ]);
    
    this.requirements = {
      maxUrls: 50000,
      maxUrlLength: 2048,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxPriority: 1.0,
      minPriority: 0.0
    };
  }

  /**
   * Valide toutes les URLs du sitemap
   */
  validateSitemap(urls) {
    console.log(chalk.blue('🔍 Validation du sitemap...'));
    
    const errors = [];
    const warnings = [];
    const validUrls = [];

    // Vérification globale
    if (urls.length > this.requirements.maxUrls) {
      errors.push(`Trop d'URLs: ${urls.length}/${this.requirements.maxUrls}`);
    }

    // Validation de chaque URL
    const seenUrls = new Set();
    
    for (const [index, urlData] of urls.entries()) {
      const urlErrors = this.validateUrl(urlData, index + 1);
      
      if (urlErrors.length === 0) {
        // Vérifier les doublons
        if (seenUrls.has(urlData.url)) {
          warnings.push(`URL dupliquée ligne ${urlData.source?.line || index + 1}: ${urlData.url}`);
        } else {
          seenUrls.add(urlData.url);
          validUrls.push(urlData);
        }
      } else {
        errors.push(...urlErrors.map(err => `Ligne ${urlData.source?.line || index + 1}: ${err}`));
      }
    }

    // Affichage des résultats
    console.log(chalk.green(`✅ URLs valides: ${validUrls.length}/${urls.length}`));
    
    if (warnings.length > 0) {
      console.log(chalk.yellow(`⚠️  Avertissements: ${warnings.length}`));
      warnings.forEach(warning => console.log(chalk.yellow(`   ${warning}`)));
    }

    if (errors.length > 0) {
      console.log(chalk.red(`❌ Erreurs: ${errors.length}`));
      errors.forEach(error => console.log(chalk.red(`   ${error}`)));
    }

    return {
      valid: errors.length === 0,
      validUrls,
      errors,
      warnings,
      stats: this.generateStats(validUrls)
    };
  }

  /**
   * Valide une URL individuelle
   */
  validateUrl(urlData, lineNumber) {
    const errors = [];

    // Validation URL
    if (!urlData.url) {
      errors.push('URL manquante');
    } else {
      if (!validator.isURL(urlData.url, { protocols: ['http', 'https'] })) {
        errors.push(`URL invalide: ${urlData.url}`);
      }
      
      if (urlData.url.length > this.requirements.maxUrlLength) {
        errors.push(`URL trop longue: ${urlData.url.length}/${this.requirements.maxUrlLength} caractères`);
      }
    }

    // Validation date
    if (!urlData.lastmod) {
      errors.push('Date de modification manquante');
    } else {
      if (!this.isValidISO8601(urlData.lastmod)) {
        errors.push(`Date invalide: ${urlData.lastmod}`);
      } else {
        const date = new Date(urlData.lastmod);
        const now = new Date();
        
        if (date > now) {
          errors.push(`Date dans le futur: ${urlData.lastmod}`);
        }
      }
    }

    // Validation fréquence
    if (!urlData.changefreq) {
      errors.push('Fréquence de changement manquante');
    } else {
      if (!this.validChangefreqs.has(urlData.changefreq)) {
        errors.push(`Fréquence invalide: ${urlData.changefreq}`);
      }
    }

    // Validation priorité
    if (urlData.priority !== undefined) {
      if (typeof urlData.priority !== 'number' || 
          urlData.priority < this.requirements.minPriority || 
          urlData.priority > this.requirements.maxPriority) {
        errors.push(`Priorité invalide: ${urlData.priority} (doit être entre 0.0 et 1.0)`);
      }
    }

    return errors;
  }

  /**
   * Valide le format ISO 8601
   */
  isValidISO8601(dateString) {
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?$/;
    
    if (!iso8601Regex.test(dateString)) {
      return false;
    }

    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Génère des statistiques sur le sitemap
   */
  generateStats(urls) {
    const stats = {
      total: urls.length,
      byDomain: {},
      byChangefreq: {},
      byPriority: {},
      dateRange: {
        oldest: null,
        newest: null
      }
    };

    for (const urlData of urls) {
      // Par domaine
      try {
        const domain = new URL(urlData.url).hostname;
        stats.byDomain[domain] = (stats.byDomain[domain] || 0) + 1;
      } catch {}

      // Par fréquence
      stats.byChangefreq[urlData.changefreq] = (stats.byChangefreq[urlData.changefreq] || 0) + 1;

      // Par priorité
      const priority = Math.floor((urlData.priority || 0.5) * 10) / 10;
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;

      // Plage de dates
      const date = new Date(urlData.lastmod);
      if (!stats.dateRange.oldest || date < stats.dateRange.oldest) {
        stats.dateRange.oldest = date;
      }
      if (!stats.dateRange.newest || date > stats.dateRange.newest) {
        stats.dateRange.newest = date;
      }
    }

    return stats;
  }

  /**
   * Valide le XML généré
   */
  validateXML(xmlContent) {
    console.log(chalk.blue('🔍 Validation du XML...'));
    
    const errors = [];
    
    // Vérifications basiques
    if (!xmlContent.includes('<?xml version="1.0" encoding="UTF-8"?>')) {
      errors.push('Déclaration XML manquante');
    }

    if (!xmlContent.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
      errors.push('Namespace sitemap manquant');
    }

    // Compter les URLs
    const urlMatches = xmlContent.match(/<url>/g);
    const urlCount = urlMatches ? urlMatches.length : 0;
    
    console.log(chalk.green(`✅ XML valide: ${urlCount} URLs trouvées`));

    return {
      valid: errors.length === 0,
      errors,
      urlCount
    };
  }
}
