import chalk from 'chalk';

export class SitemapGenerator {
  constructor(options = {}) {
    this.options = {
      includePriority: true,
      prettyPrint: true,
      encoding: 'UTF-8',
      ...options
    };
  }

  /**
   * Génère le XML du sitemap
   */
  generateXML(urls) {
    console.log(chalk.blue('🚀 Génération du XML...'));
    
    const xmlHeader = this.generateXMLHeader();
    const xmlBody = this.generateXMLBody(urls);
    const xmlFooter = this.generateXMLFooter();
    
    const fullXML = xmlHeader + xmlBody + xmlFooter;
    
    console.log(chalk.green(`✅ XML généré: ${urls.length} URLs, ${fullXML.length} caractères`));
    
    return fullXML;
  }

  /**
   * Génère l'en-tête XML
   */
  generateXMLHeader() {
    return `<?xml version="1.0" encoding="${this.options.encoding}"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  }

  /**
   * Génère le corps XML avec toutes les URLs
   */
  generateXMLBody(urls) {
    return urls.map(urlData => this.generateURLElement(urlData)).join('');
  }

  /**
   * Génère le pied XML
   */
  generateXMLFooter() {
    return '\n</urlset>';
  }

  /**
   * Génère un élément URL individuel
   */
  generateURLElement(urlData) {
    const indent = this.options.prettyPrint ? '  ' : '';
    const newline = this.options.prettyPrint ? '\n' : '';
    
    let urlElement = `${newline}${indent}<url>`;
    
    // Élément loc (obligatoire)
    urlElement += `${newline}${indent}${indent}<loc>${this.escapeXML(urlData.url)}</loc>`;
    
    // Élément lastmod (optionnel mais recommandé)
    if (urlData.lastmod) {
      urlElement += `${newline}${indent}${indent}<lastmod>${urlData.lastmod}</lastmod>`;
    }
    
    // Élément changefreq (optionnel)
    if (urlData.changefreq) {
      urlElement += `${newline}${indent}${indent}<changefreq>${urlData.changefreq}</changefreq>`;
    }
    
    // Élément priority (optionnel)
    if (this.options.includePriority && urlData.priority !== undefined) {
      const priority = Number(urlData.priority).toFixed(1);
      urlElement += `${newline}${indent}${indent}<priority>${priority}</priority>`;
    }
    
    urlElement += `${newline}${indent}</url>`;
    
    return urlElement;
  }

  /**
   * Échappe les caractères spéciaux XML
   */
  escapeXML(str) {
    if (typeof str !== 'string') return str;
    
    return str.replace(/[<>&'"]/g, (char) => {
      switch (char) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&apos;';
        case '"': return '&quot;';
        default: return char;
      }
    });
  }

  /**
   * Génère des statistiques de génération
   */
  generateReport(urls, xmlContent) {
    const stats = {
      urlCount: urls.length,
      xmlSize: xmlContent.length,
      xmlSizeFormatted: this.formatBytes(xmlContent.length),
      domains: [...new Set(urls.map(u => {
        try { return new URL(u.url).hostname; } catch { return 'invalid'; }
      }))],
      changefreqDistribution: {},
      priorityDistribution: {},
      dateRange: this.getDateRange(urls)
    };

    // Distribution des fréquences
    urls.forEach(url => {
      const freq = url.changefreq || 'unknown';
      stats.changefreqDistribution[freq] = (stats.changefreqDistribution[freq] || 0) + 1;
    });

    // Distribution des priorités
    if (this.options.includePriority) {
      urls.forEach(url => {
        const priority = url.priority ? Math.floor(url.priority * 10) / 10 : 0.5;
        stats.priorityDistribution[priority] = (stats.priorityDistribution[priority] || 0) + 1;
      });
    }

    return stats;
  }

  /**
   * Obtient la plage de dates
   */
  getDateRange(urls) {
    const dates = urls
      .map(u => new Date(u.lastmod))
      .filter(d => !isNaN(d.getTime()))
      .sort();

    return {
      oldest: dates[0] || null,
      newest: dates[dates.length - 1] || null,
      span: dates.length > 1 ? dates[dates.length - 1] - dates[0] : 0
    };
  }

  /**
   * Formate les bytes en format lisible
   */
  formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  }

  /**
   * Génère un sitemap minifié (sans indentation)
   */
  generateMinifiedXML(urls) {
    const originalPrettyPrint = this.options.prettyPrint;
    this.options.prettyPrint = false;
    
    const xml = this.generateXML(urls);
    
    this.options.prettyPrint = originalPrettyPrint;
    return xml;
  }

  /**
   * Divise un gros sitemap en plusieurs fichiers
   */
  splitSitemap(urls, maxUrls = 50000) {
    const chunks = [];
    
    for (let i = 0; i < urls.length; i += maxUrls) {
      chunks.push(urls.slice(i, i + maxUrls));
    }
    
    return chunks.map((chunk, index) => ({
      filename: `sitemap${index > 0 ? `_${index + 1}` : ''}.xml`,
      content: this.generateXML(chunk),
      urlCount: chunk.length
    }));
  }

  /**
   * Génère un index de sitemap pour plusieurs fichiers
   */
  generateSitemapIndex(sitemaps, baseUrl) {
    const now = new Date().toISOString();
    
    let indexXML = `<?xml version="1.0" encoding="${this.options.encoding}"?>\n`;
    indexXML += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    sitemaps.forEach(sitemap => {
      indexXML += `  <sitemap>\n`;
      indexXML += `    <loc>${this.escapeXML(`${baseUrl}/${sitemap.filename}`)}</loc>\n`;
      indexXML += `    <lastmod>${now}</lastmod>\n`;
      indexXML += `  </sitemap>\n`;
    });
    
    indexXML += `</sitemapindex>`;
    
    return indexXML;
  }
}
