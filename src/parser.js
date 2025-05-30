import chalk from 'chalk';

export class SitemapParser {
  constructor() {
    // Patterns REGEX pour différents formats
    this.patterns = {
      // Format standard: URL DATE FREQUENCY
      standard: /^(https?:\/\/[^\s]+)\s+(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+(always|hourly|daily|weekly|monthly|yearly|never)\s*$/,
      
      // Format avec séparateur pipe: URL | DATE | FREQUENCY
      pipe: /^(https?:\/\/[^\s]+)\s*\|\s*(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*\|\s*(always|hourly|daily|weekly|monthly|yearly|never)\s*$/,
      
      // Format CSV: URL,DATE,FREQUENCY
      csv: /^(https?:\/\/[^\s,]+),\s*(\d{4}-\d{2}-\d{2}T[\d:.]+Z?),\s*(always|hourly|daily|weekly|monthly|yearly|never)\s*$/,
      
      // Format avec priorité: URL DATE FREQUENCY PRIORITY
      withPriority: /^(https?:\/\/[^\s]+)\s+(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+(always|hourly|daily|weekly|monthly|yearly|never)\s+([0-9](?:\.[0-9])?)\s*$/
    };

    this.validFrequencies = new Set([
      'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'
    ]);
  }

  /**
   * Parse le contenu du fichier d'entrée
   */
  parse(content, options = {}) {
    console.log(chalk.blue('🔍 Parsing du contenu...'));
    
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));

    const results = [];
    const errors = [];
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      
      try {
        const parsed = this.parseLine(line, lineNumber);
        if (parsed) {
          results.push(parsed);
        }
      } catch (error) {
        errors.push({
          line: lineNumber,
          content: line,
          error: error.message
        });
      }
    }

    console.log(chalk.green(`✅ ${results.length} URLs parsées avec succès`));
    
    if (errors.length > 0) {
      console.log(chalk.yellow(`⚠️  ${errors.length} erreurs de parsing:`));
      errors.forEach(err => {
        console.log(chalk.red(`   Ligne ${err.line}: ${err.error}`));
        console.log(chalk.gray(`   Content: ${err.content.substring(0, 80)}...`));
      });
    }

    return {
      urls: results,
      errors,
      summary: {
        total: lineNumber,
        success: results.length,
        errors: errors.length
      }
    };
  }

  /**
   * Parse une ligne individuelle
   */
  parseLine(line, lineNumber) {
    for (const [patternName, pattern] of Object.entries(this.patterns)) {
      const match = line.match(pattern);
      
      if (match) {
        const [, url, lastmod, changefreq, priority] = match;
        
        return {
          url: this.normalizeUrl(url),
          lastmod: this.normalizeDate(lastmod),
          changefreq: changefreq.toLowerCase(),
          priority: priority ? parseFloat(priority) : this.calculateDefaultPriority(url),
          source: {
            line: lineNumber,
            pattern: patternName,
            original: line
          }
        };
      }
    }

    throw new Error(`Format de ligne non reconnu`);
  }

  /**
   * Normalise l'URL
   */
  normalizeUrl(url) {
    // Supprimer les espaces
    url = url.trim();
    
    // Encoder les caractères spéciaux si nécessaire
    try {
      new URL(url);
      return url;
    } catch {
      throw new Error(`URL invalide: ${url}`);
    }
  }

  /**
   * Normalise la date au format ISO 8601
   */
  normalizeDate(dateString) {
    let normalized = dateString.trim();
    
    // Ajouter Z si pas présent
    if (!normalized.endsWith('Z') && !normalized.includes('+') && !normalized.includes('-', 10)) {
      normalized += 'Z';
    }

    // Valider la date
    try {
      const date = new Date(normalized);
      if (isNaN(date.getTime())) {
        throw new Error('Date invalide');
      }
      return normalized;
    } catch {
      throw new Error(`Format de date invalide: ${dateString}`);
    }
  }

  /**
   * Calcule la priorité par défaut basée sur l'URL
   */
  calculateDefaultPriority(url) {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      
      // Page d'accueil
      if (pathSegments.length === 0) return 1.0;
      
      // Pages principales
      if (pathSegments.length === 1) {
        const segment = pathSegments[0];
        if (['products', 'store', 'shop'].includes(segment)) return 0.9;
        if (['docs', 'documentation', 'api'].includes(segment)) return 0.8;
        if (['blog', 'news'].includes(segment)) return 0.7;
        return 0.8;
      }

      // Pages de contenu
      if (pathSegments.includes('blog')) return 0.6;
      if (pathSegments.includes('products') || pathSegments.includes('store')) return 0.8;
      if (pathSegments.includes('docs')) return 0.7;
      
      // Pages profondes
      if (pathSegments.length > 3) return 0.5;
      
      return 0.6;
    } catch {
      return 0.5; // Valeur par défaut en cas d'erreur
    }
  }

  /**
   * Détecte automatiquement le format
   */
  detectFormat(content) {
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    const sample = lines.slice(0, 10);
    
    const formatCounts = {
      standard: 0,
      pipe: 0,
      csv: 0,
      withPriority: 0
    };

    for (const line of sample) {
      for (const [format, pattern] of Object.entries(this.patterns)) {
        if (pattern.test(line.trim())) {
          formatCounts[format]++;
        }
      }
    }

    const detectedFormat = Object.entries(formatCounts)
      .reduce((a, b) => formatCounts[a[0]] > formatCounts[b[0]] ? a : b)[0];

    console.log(chalk.cyan(`📋 Format détecté: ${detectedFormat}`));
    return detectedFormat;
  }
}
