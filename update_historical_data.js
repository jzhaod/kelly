/**
 * Command-line tool to update stock settings with historical volatility data
 * 
 * Usage: node update_historical_data.js TSLA NVDA CPNG SHOP MELI
 * Options:
 *  --years=5  Number of years of historical data to fetch (default: 5)
 *  --force    Force refresh data even if it's already complete
 */

const fs = require('fs').promises;
const path = require('path');
const { 
  fetchHistoricalData, 
  updateSettingsWithVolatilityMetrics 
} = require('./historical_data');

async function main() {
  try {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    let years = 5;
    let forceRefresh = false;
    let symbols = [];
    
    // Parse arguments
    args.forEach(arg => {
      if (arg.startsWith('--years=')) {
        years = parseInt(arg.split('=')[1]);
      } else if (arg === '--force') {
        forceRefresh = true;
      } else {
        // Assume it's a stock symbol
        symbols.push(arg);
      }
    });
    
    if (symbols.length === 0) {
      // Read current settings to get default symbols
      const settingsPath = path.join(__dirname, 'stock_settings.json');
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      symbols = Object.keys(settings.stocks);
      console.log(`No symbols provided. Using existing symbols from settings: ${symbols.join(', ')}`);
    }
    
    // Show message about the process
    console.log(`Updating historical data for symbols: ${symbols.join(', ')}`);
    console.log(`Using ${years} years of historical data${forceRefresh ? ' (force refresh)' : ''}`);
    console.log('This may take a moment as we fetch and analyze price data...');
    
    // First, fetch historical data for all symbols
    for (const symbol of symbols) {
      console.log(`\nAnalyzing data for ${symbol}...`);
      const result = await fetchHistoricalData(symbol, years, forceRefresh);
      
      if (result.success) {
        if (result.newDataCount) {
          console.log(`✓ ${result.message}`);
          
          // Show data coverage
          console.log(`  Date range: ${result.status.startDate} to ${result.status.endDate}`);
          console.log(`  Total data points: ${result.status.dataPoints}`);
          
          // Show gaps if any
          if (result.status.gaps && result.status.gaps.length > 0) {
            console.log(`  Missing data periods: ${result.status.gaps.length}`);
            result.status.gaps.forEach((gap, i) => {
              console.log(`    Gap ${i+1}: ${gap.start} to ${gap.end}`);
            });
          } else {
            console.log(`  Complete data coverage ✓`);
          }
        } else {
          console.log(`✓ ${result.message}`);
        }
      } else {
        console.error(`✗ Error: ${result.message}`);
      }
    }
    
    // Then calculate volatility and update settings
    console.log('\nCalculating volatility metrics and updating settings...');
    const result = await updateSettingsWithVolatilityMetrics();
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    console.log('\nUpdated stock_settings.json with historical metrics');
    console.log('\nSummary:');
    
    // Display summary of updated settings
    const stocksTable = [];
    for (const symbol of symbols) {
      if (result.metrics[symbol]) {
        stocksTable.push({
          Symbol: symbol,
          'Expected Return (%)': Math.round(result.metrics[symbol].expectedReturn * 100),
          'Volatility (%)': Math.round(result.metrics[symbol].volatility * 100),
          'Data Source': result.metrics[symbol].synthetic ? 'Estimated' : 'Historical'
        });
      }
    }
    
    console.table(stocksTable);
    
    console.log('\nDone! You can now run the Kelly Criterion visualization with these updated values.');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
