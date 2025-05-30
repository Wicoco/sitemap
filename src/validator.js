import validator from 'validator';

export class SitemapValidator {
  constructor() {
    this.validChangefreqs = new Set([
      'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'
    ]);
  }

  validateSitemap(urls) {
    const result = {
      valid: true,
      validUrls: [],
      errors: [],
      warnings: []
    };

    const seenUrls = new Set();

    for (const [index, urlData] of urls.entries()) {
      const urlErrors = this.validateUrl(urlData);
      
      if (urlErrors.length === 0) {
        if (seenUrls.has(urlData.url)) {
          result.warnings.push(`URL dupliquée ligne ${index + 1}`);
        } else {
          seenUrls.add(urlData.url);
          result.validUrls.push(urlData);
        }
      } else {
        result.valid = false;
        result.errors.push(...urlErrors.map(err => `Ligne ${index + 1}: ${err}`));
      }
    }

    return result;
  }

  validateUrl(urlData) {
    const errors = [];

    // Validation URL
    if (!urlData.url || !validator.isURL(urlData.url, { protocols: ['http', 'https'] })) {
      errors.push('URL invalide');
    }

    // Validation date
    if (urlData.lastmod && !this.isValidISO8601(urlData.lastmod)) {
      errors.push('Date invalide');
    }

    // Validation fréquence
    if (urlData.changefreq && !this.validChangefreqs.has(urlData.changefreq)) {
      errors.push('Fréquence invalide');
    }

    // Validation priorité
    if (urlData.priority !== undefined && 
        (isNaN(urlData.priority) || urlData.priority < 0 || urlData.priority > 1)) {
      errors.push('Priorité invalide (doit être entre 0.0 et 1.0)');
    }

    return errors;
  }

  isValidISO8601(dateString) {
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?$/;
    if (!iso8601Regex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date <= new Date();
  }
}
