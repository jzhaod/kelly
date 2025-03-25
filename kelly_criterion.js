/**
 * Kelly Criterion Portfolio Allocation
 * 
 * This script implements the Kelly Criterion for portfolio allocation,
 * providing multiple variations (Full Kelly, Half Kelly, Quarter Kelly)
 * for different risk profiles.
 */

// Define stocks and their characteristics
const stocks = ['TSLA', 'NVDA', 'CPNG', 'SHOP', 'MELI'];

// Expected annual returns (these are examples and not actual predictions)
const expectedReturns = {
  'TSLA': 0.15, // 15% expected annual return
  'NVDA': 0.25, // 25% expected annual return
  'CPNG': 0.12, // 12% expected annual return
  'SHOP': 0.18, // 18% expected annual return
  'MELI': 0.20  // 20% expected annual return
};

// Volatility (standard deviation of returns)
const volatility = {
  'TSLA': 0.55, // 55% annual volatility
  'NVDA': 0.45, // 45% annual volatility
  'CPNG': 0.40, // 40% annual volatility
  'SHOP': 0.50, // 50% annual volatility
  'MELI': 0.45  // 45% annual volatility
};

// Risk-free rate (approximate current Treasury yield)
const riskFreeRate = 0.045; // 4.5%

// Portfolio size
const portfolioSize = 1000; // $1000 total investment

/**
 * Calculates Kelly criterion allocations for a set of investments
 * @param {Object} expectedReturns - Map of asset symbols to expected returns
 * @param {Object} volatility - Map of asset symbols to volatility values
 * @param {Number} riskFreeRate - The risk-free rate
 * @param {Number} portfolioSize - Total investment amount
 * @returns {Object} - Allocation details
 */
function calculateKellyAllocation(expectedReturns, volatility, riskFreeRate, portfolioSize) {
  const symbols = Object.keys(expectedReturns);
  const kellyFractions = {};
  const allocations = {};
  
  // Calculate Kelly fraction for each asset
  for (const symbol of symbols) {
    const excessReturn = expectedReturns[symbol] - riskFreeRate;
    const kellyFraction = excessReturn / (volatility[symbol] * volatility[symbol]);
    kellyFractions[symbol] = kellyFraction;
  }
  
  // Sum of all Kelly fractions (for normalization)
  const totalKelly = Object.values(kellyFractions).reduce((sum, val) => sum + val, 0);
  
  // Calculate normalized allocations
  const result = {
    fullKelly: {},
    threeQuarterKelly: {},
    halfKelly: {},
    quarterKelly: {},
    rawKellyFractions: {...kellyFractions}
  };
  
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
const allocations = calculateKellyAllocation(expectedReturns, volatility, riskFreeRate, portfolioSize);
printAllocations(allocations);

// Export functions for reuse
module.exports = {
  calculateKellyAllocation,
  printAllocations
};
