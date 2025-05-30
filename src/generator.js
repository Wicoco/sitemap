export class SitemapGenerator {
  constructor() {
    this.options = {
      includePriority: true,
      prettyPrint: true
    };
  }

  generateXML(urls) {
    const indent = this.options.prettyPrint ? '  ' : '';
    const newline = this.options.prettyPrint ? '\n' : '';
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>${newline}`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${newline}`;
    
    for (const urlData of urls) {
      xml += `${indent}<url>${newline}`;
      xml += `${indent}${indent}<loc>${this.escapeXML(urlData.url)}</loc>${newline}`;
      
      if (urlData.lastmod) {
        xml += `${indent}${indent}<lastmod>${urlData.lastmod}</lastmod>${newline}`;
      }
      
      if (urlData.changefreq) {
        xml += `${indent}${indent}<changefreq>${urlData.changefreq}</changefreq>${newline}`;
      }
      
      if (this.options.includePriority && urlData.priority !== undefined) {
        xml += `${indent}${indent}<priority>${urlData.priority}</priority>${newline}`;
      }
      
      xml += `${indent}</url>${newline}`;
    }
    
    xml += `</urlset>${newline}`;
    return xml;
  }

  generateReport(urls, xml) {
    const domains = [...new Set(urls.map(u => this.extractDomain(u.url)))];
    const changefreqs = {};
    
    urls.forEach(url => {
      if (url.changefreq) {
        changefreqs[url.changefreq] = (changefreqs[url.changefreq] || 0) + 1;
      }
    });

    return {
      urlCount: urls.length,
      xmlSize: xml.length,
      xmlSizeFormatted: this.formatBytes(xml.length),
      domains,
      changefreqDistribution: changefreqs
    };
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'invalid';
    }
  }

  escapeXML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  formatBytes(bytes) {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
