import chalk from 'chalk';

export class SitemapParser {
  constructor() {
    // Patterns REGEX pour différents formats
    this.patterns = {
      standard: /^(\S+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?/,
      csv: /^([^,]+),\s*([^,]+),\s*([^,]+)(?:,\s*([^,]+))?/,
      pipe: /^([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)(?:\s*\|\s*([^|]+))?/
    };
  }

  parse(content, options = {}) {
    console.log(chalk.blue('📋 Parsing du contenu...'));
    
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    const urls = [];
    let successCount = 0;
    let errorCount = 0;

    for (const [index, line] of lines.entries()) {
      try {
        const urlData = this.parseLine(line, index + 1);
        if (urlData) {
          urls.push(urlData);
          successCount++;
        }
      } catch (error) {
        errorCount++;
        console.log(chalk.yellow(`⚠️  Ligne ${index + 1}: ${error.message}`));
      }
    }

    console.log(chalk.green(`✅ Parsing terminé: ${successCount} URLs, ${errorCount} erreurs`));
    
    return { 
      urls, 
      stats: { total: lines.length, success: successCount, errors: errorCount }
    };
  }

  parseLine(line, lineNumber) {
    // Essayer chaque format
    for (const [format, pattern] of Object.entries(this.patterns)) {
      const match = line.match(pattern);
      if (match) {
        return {
          url: match[1]?.trim(),
          lastmod: match[2]?.trim(),
          changefreq: match[3]?.trim(),
          priority: match[4] ? parseFloat(match[4].trim()) : undefined,
          source: { line: lineNumber, format }
        };
      }
    }
    
    throw new Error(`Format non reconnu: ${line.substring(0, 50)}...`);
  }
}
