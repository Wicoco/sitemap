import chalk from 'chalk';

export class URLChecker {
  constructor(options = {}) {
    this.concurrent = options.concurrent || 10;
    this.timeout = options.timeout || 5000;
    this.userAgent = options.userAgent || 'Mozilla/5.0 (compatible; SitemapChecker/1.0)';
    this.maxRetries = options.maxRetries || 2;
  }

  async checkUrls(urls, options = {}) {
    console.log(chalk.cyan.bold('\n🔍 VÉRIFICATION DES URLs'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(`Checking ${urls.length} URLs avec ${this.concurrent} connexions simultanées...\n`);

    const results = {
      working: [],
      errors: [],
      warnings: [],
      timeouts: [],
      total: urls.length,
      startTime: Date.now()
    };

    // Traitement par lots pour éviter la surcharge
    const chunks = this.chunkArray(urls, this.concurrent);
    let processed = 0;

    for (const chunk of chunks) {
      const promises = chunk.map(urlData => this.checkSingleUrlWithRetry(urlData));
      const chunkResults = await Promise.allSettled(promises);

      chunkResults.forEach((result, index) => {
        processed++;
        const urlData = chunk[index];
        
        if (result.status === 'fulfilled') {
          const checkResult = result.value;
          
          if (checkResult.timeout) {
            results.timeouts.push({ ...urlData, ...checkResult });
            process.stdout.write(chalk.gray('⏱'));
          } else if (checkResult.status >= 200 && checkResult.status < 300) {
            results.working.push({ ...urlData, ...checkResult });
            process.stdout.write(chalk.green('✓'));
          } else if (checkResult.status >= 300 && checkResult.status < 400) {
            results.warnings.push({ ...urlData, ...checkResult });
            process.stdout.write(chalk.yellow('⚠'));
          } else {
            results.errors.push({ ...urlData, ...checkResult });
            process.stdout.write(chalk.red('✗'));
          }
        } else {
          // Erreur de promesse
          results.errors.push({ 
            ...urlData, 
            status: 'ERROR',
            statusText: 'Promise rejected',
            error: result.reason?.message || 'Unknown error'
          });
          process.stdout.write(chalk.red('✗'));
        }

        // Progress indicator
        if (processed % 50 === 0) {
          process.stdout.write(chalk.gray(` ${processed}/${urls.length}\n`));
        }
      });

      // Petite pause entre les chunks pour éviter la surcharge
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.sleep(100);
      }
    }

    const duration = Date.now() - results.startTime;
    console.log(chalk.gray(`\n\nVérification terminée en ${(duration/1000).toFixed(2)}s`));
    
    return results;
  }

  async checkSingleUrlWithRetry(urlData, attempt = 1) {
    try {
      return await this.checkSingleUrl(urlData);
    } catch (error) {
      if (attempt < this.maxRetries && (error.name === 'TimeoutError' || error.code === 'ECONNRESET')) {
        console.log(chalk.yellow(`\n⚠️  Retry ${attempt + 1}/${this.maxRetries} pour ${urlData.url}`));
        await this.sleep(1000 * attempt); // Délai progressif
        return this.checkSingleUrlWithRetry(urlData, attempt + 1);
      }
      
      return {
        status: 'TIMEOUT',
        statusText: error.message,
        timeout: true,
        error: error.message,
        responseTime: this.timeout
      };
    }
  }

  async checkSingleUrl(urlData) {
    const controller = new AbortController();
    let timeoutId;
    
    try {
      // Timeout plus robuste
      timeoutId = setTimeout(() => {
        controller.abort();
      }, this.timeout);

      const startTime = Date.now();
      
      const response = await fetch(urlData.url, {
        method: 'HEAD', // Plus rapide que GET
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': '*/*',
          'Cache-Control': 'no-cache'
        },
        redirect: 'follow' // Suit les redirections automatiquement
      });

      const responseTime = Date.now() - startTime;
      clearTimeout(timeoutId);

      return {
        status: response.status,
        statusText: response.statusText,
        responseTime,
        redirected: response.redirected,
        finalUrl: response.url !== urlData.url ? response.url : undefined,
        timeout: false
      };

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Gestion spécifique des erreurs
      if (error.name === 'AbortError') {
        return {
          status: 'TIMEOUT',
          statusText: `Timeout après ${this.timeout}ms`,
          timeout: true,
          error: 'Request timeout',
          responseTime: this.timeout
        };
      }

      // Autres erreurs réseau
      return {
        status: 'ERROR',
        statusText: error.message,
        timeout: false,
        error: error.code || error.message,
        responseTime: Date.now() - (Date.now() - this.timeout)
      };
    }
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printReport(results) {
    const { working, errors, warnings, timeouts, total, startTime } = results;
    const duration = Date.now() - startTime;
    
    console.log(chalk.cyan.bold('\n📊 RAPPORT DE VÉRIFICATION'));
    console.log(chalk.cyan('═'.repeat(50)));
    
    // Stats générales
    console.log(`Total URLs: ${chalk.yellow(total)}`);
    console.log(`✅ Fonctionnelles: ${chalk.green(working.length)} (${((working.length/total)*100).toFixed(1)}%)`);
    console.log(`⚠️  Redirections: ${chalk.yellow(warnings.length)} (${((warnings.length/total)*100).toFixed(1)}%)`);
    console.log(`⏱️  Timeouts: ${chalk.gray(timeouts.length)} (${((timeouts.length/total)*100).toFixed(1)}%)`);
    console.log(`❌ Erreurs: ${chalk.red(errors.length)} (${((errors.length/total)*100).toFixed(1)}%)`);
    console.log(`⚡ Durée: ${chalk.blue((duration/1000).toFixed(2))}s (${chalk.blue((total/(duration/1000)).toFixed(1))} URLs/s)`);

    // Détails des erreurs
    if (errors.length > 0) {
      console.log(chalk.red.bold('\n❌ ERREURS DÉTECTÉES:'));
      errors.slice(0, 10).forEach(error => {
        console.log(chalk.red(`  • ${error.url}`));
        console.log(chalk.gray(`    Status: ${error.status} - ${error.statusText}`));
        if (error.error) console.log(chalk.gray(`    Erreur: ${error.error}`));
      });
      if (errors.length > 10) {
        console.log(chalk.gray(`    ... et ${errors.length - 10} autres erreurs`));
      }
    }

    // Détails des timeouts
    if (timeouts.length > 0) {
      console.log(chalk.gray.bold('\n⏱️  TIMEOUTS:'));
      timeouts.slice(0, 5).forEach(timeout => {
        console.log(chalk.gray(`  • ${timeout.url}`));
        console.log(chalk.gray(`    Temps: ${timeout.responseTime}ms`));
      });
      if (timeouts.length > 5) {
        console.log(chalk.gray(`    ... et ${timeouts.length - 5} autres timeouts`));
      }
    }

    // Détails des redirections
    if (warnings.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️  REDIRECTIONS:'));
      warnings.slice(0, 5).forEach(warning => {
        console.log(chalk.yellow(`  • ${warning.url}`));
        console.log(chalk.gray(`    → ${warning.finalUrl || 'Unknown'} (${warning.status})`));
      });
      if (warnings.length > 5) {
        console.log(chalk.gray(`    ... et ${warnings.length - 5} autres redirections`));
      }
    }

    // Stats de performance
    if (working.length > 0) {
      const avgResponseTime = working.reduce((sum, url) => sum + url.responseTime, 0) / working.length;
      const slowUrls = working.filter(url => url.responseTime > 3000);
      
      console.log(chalk.green.bold('\n⚡ PERFORMANCE:'));
      console.log(`Temps de réponse moyen: ${chalk.blue(avgResponseTime.toFixed(0))}ms`);
      if (slowUrls.length > 0) {
        console.log(`URLs lentes (>3s): ${chalk.yellow(slowUrls.length)}`);
      }
    }

    return {
      success: errors.length === 0 && timeouts.length < (total * 0.1), // Max 10% de timeouts acceptés
      workingPercent: (working.length / total) * 100,
      errorPercent: (errors.length / total) * 100,
      timeoutPercent: (timeouts.length / total) * 100
    };
  }
}
