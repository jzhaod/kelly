/**
 * Kelly Criterion Portfolio Allocation
 * 
 * This script implements the Kelly Criterion for portfolio allocation,
 * providing multiple variations (Full Kelly, Half Kelly, Quarter Kelly)
 * for different risk profiles.
 * 
 * The expected returns, volatility, and correlation matrix are loaded from
 * the stock_settings.json file, which contains pre-calculated values based on
 * historical data.
 */

// Node.js version - uses file system operations

const fs = require('fs');
const path = require('path');

// Load stock settings from file
function loadStockSettings() {
  try {
    const settingsPath = path.join(__dirname, 'stock_settings.json');
    const settingsData = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(settingsData);
  } catch (error) {
    console.error('Error loading stock settings:', error);
    // Return default values if settings file doesn't exist or is invalid
    return {
      stocks: {
        'TSLA': { expectedReturn: 35, volatility: 55 },
        'NVDA': { expectedReturn: 40, volatility: 45 },
        'CPNG': { expectedReturn: 20, volatility: 50 },
        'SHOP': { expectedReturn: 25, volatility: 50 },
        'MELI': { expectedReturn: 30, volatility: 45 }
      },
      riskFreeRate: 4.5,
      correlationMatrix: null,
      symbols: null
    };
  }
}

// Load settings
const settings = loadStockSettings();

// Extract stocks and their characteristics from settings
const stocks = Object.keys(settings.stocks);

// Convert percentage values to decimals for calculations
const expectedReturns = {};
const volatility = {};

for (const symbol of stocks) {
  expectedReturns[symbol] = settings.stocks[symbol].expectedReturn / 100;
  volatility[symbol] = settings.stocks[symbol].volatility / 100;
}

// Load correlation matrix if available
const correlationMatrix = settings.correlationMatrix;

// Risk-free rate from settings (convert from percentage to decimal)
const riskFreeRate = settings.riskFreeRate / 100;

// Portfolio size
const portfolioSize = 1000; // $1000 total investment

/**
 * Calculates Kelly criterion allocations for a set of investments
 * @param {Object} expectedReturns - Map of asset symbols to expected returns
 * @param {Object} volatility - Map of asset symbols to volatility values
 * @param {Number} riskFreeRate - The risk-free rate
 * @param {Number} portfolioSize - Total investment amount
 * @param {Array} correlationMatrix - Optional correlation matrix for assets
 * @returns {Object} - Allocation details
 */
function calculateKellyAllocation(expectedReturns, volatility, riskFreeRate, portfolioSize, correlationMatrix = null) {
  const symbols = Object.keys(expectedReturns);
  let kellyFractions = {};
  const allocations = {};
  
  // Check if we have a valid correlation matrix and ordered symbols
  const hasCorrelation = correlationMatrix && settings.symbols && 
                        correlationMatrix.length === settings.symbols.length && 
                        settings.symbols.length === symbols.length;
  
  if (hasCorrelation) {
    // Advanced Kelly calculation using correlation matrix
    try {
      // Load math.js for matrix operations
      const math = require('mathjs');
      
      // Create covariance matrix
      const covarianceMatrix = math.zeros(symbols.length, symbols.length);
      
      for (let i = 0; i < symbols.length; i++) {
        for (let j = 0; j < symbols.length; j++) {
          const sigmaI = volatility[symbols[i]];
          const sigmaJ = volatility[symbols[j]];
          const rhoIJ = correlationMatrix[i][j];
          covarianceMatrix.set([i, j], sigmaI * sigmaJ * rhoIJ);
        }
      }
      
      // Excess returns vector (expected return - risk-free rate)
      const excessReturns = symbols.map(symbol => expectedReturns[symbol] - riskFreeRate);
      
      // Calculate inverse of covariance matrix
      const covarianceMatrixInverse = math.inv(covarianceMatrix);
      
      // Calculate Kelly allocation (w = Σ^-1 * μ)
      const kellyWeights = math.multiply(covarianceMatrixInverse, excessReturns);
      
      // Sum of weights (for normalization)
      const sumWeights = math.sum(kellyWeights);
      
      // Normalize to 100% allocation
      const normalizedWeights = math.divide(kellyWeights, sumWeights).toArray();
      
      // Create kellyFractions object from normalized weights
      for (let i = 0; i < symbols.length; i++) {
        kellyFractions[symbols[i]] = normalizedWeights[i];
      }
      
      console.log('Using advanced Kelly calculation with correlation matrix');
    } catch (error) {
      console.error('Error in advanced Kelly calculation:', error);
      console.log('Falling back to simplified Kelly calculation');
      // Fall back to simplified calculation if advanced fails
      for (const symbol of symbols) {
        const excessReturn = expectedReturns[symbol] - riskFreeRate;
        const kellyFraction = excessReturn / (volatility[symbol] * volatility[symbol]);
        kellyFractions[symbol] = kellyFraction;
      }
      
      // Sum of all Kelly fractions (for normalization)
      const totalKelly = Object.values(kellyFractions).reduce((sum, val) => sum + val, 0);
      
      // Normalize fractions
      for (const symbol of symbols) {
        kellyFractions[symbol] = kellyFractions[symbol] / totalKelly;
      }
    }
  } else {
    // Simplified Kelly calculation (no correlation)
    for (const symbol of symbols) {
      const excessReturn = expectedReturns[symbol] - riskFreeRate;
      const kellyFraction = excessReturn / (volatility[symbol] * volatility[symbol]);
      kellyFractions[symbol] = kellyFraction;
    }
    
    // Sum of all Kelly fractions (for normalization)
    const totalKelly = Object.values(kellyFractions).reduce((sum, val) => sum + val, 0);
    
    // Normalize fractions
    for (const symbol of symbols) {
      kellyFractions[symbol] = kellyFractions[symbol] / totalKelly;
    }
    
    console.log('Using simplified Kelly calculation (no correlation matrix)');
  }
  
  // Calculate allocations using the determined Kelly fractions
  const result = {
    fullKelly: {},
    threeQuarterKelly: {},
    halfKelly: {},
    quarterKelly: {},
    rawKellyFractions: {...kellyFractions}
  };
  
  // Make sure totalKelly is defined for allocation calculations
  const totalKelly = Object.values(kellyFractions).reduce((sum, val) => sum + val, 0);
  
  // Calculate allocations for each asset
  for (const symbol of symbols) {
    const normalizedFraction = kellyFractions[symbol] / totalKelly;
    const dollarAmount = normalizedFraction * portfolioSize;
    
    // Full Kelly
    result.fullKelly[symbol] = {
      percentage: normalizedFraction * 100,
      dollars: dollarAmount
    };
    
    // Three-Quarter Kelly (75% Kelly, 25% cash distributed equally)
    const cashPerAssetThreeQuarter = (portfolioSize * 0.25) / symbols.length;
    result.threeQuarterKelly[symbol] = {
      percentage: normalizedFraction * 75,
      dollars: dollarAmount * 0.75,
      cashPercentage: 25 / symbols.length,
      cashDollars: cashPerAssetThreeQuarter
    };
    
    // Half Kelly (50% Kelly, 50% cash distributed equally)
    const cashPerAssetHalf = (portfolioSize * 0.5) / symbols.length;
    result.halfKelly[symbol] = {
      percentage: normalizedFraction * 50,
      dollars: dollarAmount / 2,
      cashPercentage: 50 / symbols.length,
      cashDollars: cashPerAssetHalf
    };
    
    // Quarter Kelly (25% Kelly, 75% cash distributed equally)
    const cashPerAssetQuarter = (portfolioSize * 0.75) / symbols.length;
    result.quarterKelly[symbol] = {
      percentage: normalizedFraction * 25,
      dollars: dollarAmount / 4,
      cashPercentage: 75 / symbols.length,
      cashDollars: cashPerAssetQuarter
    };
  }
  
  return result;
}

/**
 * Prints allocation results in a readable format
 * @param {Object} allocations - Allocation object returned by calculateKellyAllocation
 */
function printAllocations(allocations) {
  const symbols = Object.keys(allocations.fullKelly);
  
  // Full Kelly
  console.log('Full Kelly Allocation (Optimal Growth):');
  console.log('------------------------------------');
  let fullKellyTotal = 0;
  for (const symbol of symbols) {
    const alloc = allocations.fullKelly[symbol];
    console.log(`${symbol}: ${alloc.percentage.toFixed(2)}% ($${alloc.dollars.toFixed(2)})`);
    fullKellyTotal += alloc.percentage;
  }
  console.log(`Total: ${fullKellyTotal.toFixed(2)}%`);
  
  // Three-Quarter Kelly
  console.log('\nThree-Quarter Kelly Allocation (Balanced Growth):');
  console.log('------------------------------------');
  let threeQuarterKellyTotal = 0;
  for (const symbol of symbols) {
    const alloc = allocations.threeQuarterKelly[symbol];
    console.log(`${symbol}: ${alloc.percentage.toFixed(2)}% ($${alloc.dollars.toFixed(2)}) + Cash: ${alloc.cashPercentage.toFixed(2)}% ($${alloc.cashDollars.toFixed(2)})`);
    threeQuarterKellyTotal += alloc.percentage + alloc.cashPercentage;
  }
  console.log(`Total: ${threeQuarterKellyTotal.toFixed(2)}%`);
  
  // Half Kelly
  console.log('\nHalf Kelly Allocation (Recommended for More Stability):');
  console.log('------------------------------------');
  let halfKellyTotal = 0;
  for (const symbol of symbols) {
    const alloc = allocations.halfKelly[symbol];
    console.log(`${symbol}: ${alloc.percentage.toFixed(2)}% ($${alloc.dollars.toFixed(2)}) + Cash: ${alloc.cashPercentage.toFixed(2)}% ($${alloc.cashDollars.toFixed(2)})`);
    halfKellyTotal += alloc.percentage + alloc.cashPercentage;
  }
  console.log(`Total: ${halfKellyTotal.toFixed(2)}%`);
  
  // Quarter Kelly
  console.log('\nQuarter Kelly Allocation (Very Conservative):');
  console.log('------------------------------------');
  let quarterKellyTotal = 0;
  for (const symbol of symbols) {
    const alloc = allocations.quarterKelly[symbol];
    console.log(`${symbol}: ${alloc.percentage.toFixed(2)}% ($${alloc.dollars.toFixed(2)}) + Cash: ${alloc.cashPercentage.toFixed(2)}% ($${alloc.cashDollars.toFixed(2)})`);
    quarterKellyTotal += alloc.percentage + alloc.cashPercentage;
  }
  console.log(`Total: ${quarterKellyTotal.toFixed(2)}%`);
  
  // Raw Kelly fractions
  console.log('\nRaw Kelly Fractions (before normalization):');
  for (const symbol of symbols) {
    console.log(`${symbol}: ${allocations.rawKellyFractions[symbol].toFixed(4)}`);
  }
}

// Calculate and display allocations
const allocations = calculateKellyAllocation(expectedReturns, volatility, riskFreeRate, portfolioSize, correlationMatrix);
printAllocations(allocations);

// Expose functions in the global scope for browser use
module.exports = {
  calculateKellyAllocation,
  printAllocations,
  loadStockSettings
};
