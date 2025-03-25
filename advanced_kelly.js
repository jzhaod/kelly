/**
 * Advanced Kelly Criterion Portfolio Allocation
 * 
 * This script implements a more sophisticated version of the Kelly Criterion
 * that takes into account correlations between assets.
 * 
 * Note: This requires external data (historical prices) to calculate correlations
 * and volatilities accurately. The example data below is for illustration.
 */

// Import mathjs for matrix operations (this would need to be installed via npm in a real environment)
// npm install mathjs
// const math = require('mathjs');

/**
 * Calculates advanced Kelly criterion allocation considering correlations
 * @param {Array} symbols - Array of asset symbols
 * @param {Object} expectedReturns - Map of asset symbols to expected returns
 * @param {Object} volatility - Map of asset symbols to volatility values
 * @param {Array} correlationMatrix - Matrix of correlation coefficients
 * @param {Number} riskFreeRate - The risk-free rate
 * @returns {Object} - Kelly allocations
 */
function calculateAdvancedKelly(symbols, expectedReturns, volatility, correlationMatrix, riskFreeRate) {
  // Example implementation using mathjs
  // In a real environment, uncomment and use these calculations
  

  // Calculate covariance matrix
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
  const normalizedWeights = kellyWeights.map(w => w / sumWeights);
  
  const result = {};
  for (let i = 0; i < symbols.length; i++) {
    result[symbols[i]] = normalizedWeights[i];
  }
  
  return result;

  
  // For demonstration without mathjs, return the simplified Kelly calculation
  //return calculateSimplifiedKelly(symbols, expectedReturns, volatility, riskFreeRate);
}

/**
 * Simpler Kelly calculation that doesn't consider correlations
 * @param {Array} symbols - Array of asset symbols
 * @param {Object} expectedReturns - Map of asset symbols to expected returns
 * @param {Object} volatility - Map of asset symbols to volatility values
 * @param {Number} riskFreeRate - The risk-free rate
 * @returns {Object} - Kelly allocations
 */
function calculateSimplifiedKelly(symbols, expectedReturns, volatility, riskFreeRate) {
  const kellyFractions = {};
  
  // Calculate Kelly fraction for each asset
  for (const symbol of symbols) {
    const excessReturn = expectedReturns[symbol] - riskFreeRate;
    const kellyFraction = excessReturn / (volatility[symbol] * volatility[symbol]);
    kellyFractions[symbol] = kellyFraction;
  }
  
  // Sum of all Kelly fractions (for normalization)
  const totalKelly = Object.values(kellyFractions).reduce((sum, val) => sum + val, 0);
  
  // Normalize fractions
  const normalizedFractions = {};
  for (const symbol of symbols) {
    normalizedFractions[symbol] = kellyFractions[symbol] / totalKelly;
  }
  
  return normalizedFractions;
}

/**
 * Fetches historical data for stocks (placeholder function)
 * @param {Array} symbols - Array of asset symbols
 * @param {Number} lookbackPeriod - Number of days to look back
 * @returns {Object} - Historical price data
 */
async function fetchHistoricalData(symbols, lookbackPeriod = 252) {
  // In a real implementation, this would call an API to get historical prices
  // Example APIs: Alpha Vantage, Yahoo Finance, IEX Cloud, etc.
  
  console.log(`Fetching historical data for ${symbols.join(', ')} for the past ${lookbackPeriod} trading days...`);
  
  // Mock data - this would be replaced with actual API calls
  const mockData = {};
  
  for (const symbol of symbols) {
    mockData[symbol] = {
      prices: Array(lookbackPeriod).fill(0).map((_, i) => 100 + Math.random() * 20 - i * 0.1),
      dates: Array(lookbackPeriod).fill(0).map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      })
    };
  }
  
  return mockData;
}

/**
 * Calculates returns from price data
 * @param {Object} priceData - Historical price data
 * @returns {Object} - Daily returns
 */
function calculateReturns(priceData) {
  const returns = {};
  
  for (const symbol of Object.keys(priceData)) {
    const prices = priceData[symbol].prices;
    returns[symbol] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const dailyReturn = (prices[i-1] / prices[i]) - 1;
      returns[symbol].push(dailyReturn);
    }
  }
  
  return returns;
}

/**
 * Calculates volatility from returns
 * @param {Object} returns - Daily returns
 * @param {Number} annualizationFactor - Factor to annualize (252 for daily data)
 * @returns {Object} - Annualized volatility
 */
function calculateVolatility(returns, annualizationFactor = 252) {
  const volatility = {};
  
  for (const symbol of Object.keys(returns)) {
    const symbolReturns = returns[symbol];
    const mean = symbolReturns.reduce((sum, ret) => sum + ret, 0) / symbolReturns.length;
    
    const variance = symbolReturns.reduce((sum, ret) => {
      return sum + Math.pow(ret - mean, 2);
    }, 0) / (symbolReturns.length - 1);
    
    volatility[symbol] = Math.sqrt(variance * annualizationFactor);
  }
  
  return volatility;
}

/**
 * Calculates correlation matrix from returns
 * @param {Object} returns - Daily returns
 * @returns {Array} - Correlation matrix
 */
function calculateCorrelationMatrix(returns) {
  const symbols = Object.keys(returns);
  const n = symbols.length;
  const correlationMatrix = Array(n).fill().map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    // Diagonal elements are always 1 (correlation with self)
    correlationMatrix[i][i] = 1;
    
    for (let j = i + 1; j < n; j++) {
      const returnsI = returns[symbols[i]];
      const returnsJ = returns[symbols[j]];
      
      // Calculate correlation
      const meanI = returnsI.reduce((sum, ret) => sum + ret, 0) / returnsI.length;
      const meanJ = returnsJ.reduce((sum, ret) => sum + ret, 0) / returnsJ.length;
      
      let numerator = 0;
      let denominatorI = 0;
      let denominatorJ = 0;
      
      for (let k = 0; k < returnsI.length; k++) {
        const diffI = returnsI[k] - meanI;
        const diffJ = returnsJ[k] - meanJ;
        
        numerator += diffI * diffJ;
        denominatorI += diffI * diffI;
        denominatorJ += diffJ * diffJ;
      }
      
      const correlation = numerator / (Math.sqrt(denominatorI) * Math.sqrt(denominatorJ));
      
      correlationMatrix[i][j] = correlation;
      correlationMatrix[j][i] = correlation; // Correlation matrix is symmetric
    }
  }
  
  return correlationMatrix;
}

/**
 * Calculates expected returns based on historical data and adjustments
 * @param {Object} returns - Daily returns
 * @param {Number} annualizationFactor - Factor to annualize (252 for daily data)
 * @param {Object} adjustments - Optional adjustments to expected returns
 * @returns {Object} - Expected annual returns
 */
function calculateExpectedReturns(returns, annualizationFactor = 252, adjustments = {}) {
  const expectedReturns = {};
  
  for (const symbol of Object.keys(returns)) {
    const symbolReturns = returns[symbol];
    const meanDaily = symbolReturns.reduce((sum, ret) => sum + ret, 0) / symbolReturns.length;
    const annualizedReturn = ((1 + meanDaily) ** annualizationFactor) - 1;
    
    // Apply any adjustments specified
    const adjustment = adjustments[symbol] || 0;
    expectedReturns[symbol] = annualizedReturn + adjustment;
  }
  
  return expectedReturns;
}

/**
 * Main function to run the advanced Kelly allocation
 * @param {Array} symbols - Array of asset symbols
 * @param {Number} portfolioSize - Total investment amount
 * @param {Object} returnAdjustments - Optional adjustments to expected returns
 */
async function runAdvancedKellyAllocation(symbols, portfolioSize = 1000, returnAdjustments = {}) {
  try {
    // Fetch historical data
    const historicalData = await fetchHistoricalData(symbols);
    
    // Calculate returns from price data
    const returns = calculateReturns(historicalData);
    
    // Calculate volatility
    const volatility = calculateVolatility(returns);
    
    // Calculate correlation matrix
    const correlationMatrix = calculateCorrelationMatrix(returns);
    
    // Calculate expected returns (with optional adjustments)
    const expectedReturns = calculateExpectedReturns(returns, 252, returnAdjustments);
    
    // Risk-free rate (e.g., current 10-year Treasury yield)
    const riskFreeRate = 0.045; // 4.5%
    
    console.log('Expected Returns:', expectedReturns);
    console.log('Volatility:', volatility);
    console.log('Correlation Matrix:', correlationMatrix);
    
    // Calculate Kelly allocations
    const kellyAllocations = calculateAdvancedKelly(
      symbols, 
      expectedReturns, 
      volatility, 
      correlationMatrix, 
      riskFreeRate
    );
    
    // Print results
    console.log('\nKelly Allocations:');
    console.log('------------------------------------');
    let total = 0;
    for (const symbol of symbols) {
      const percentage = kellyAllocations[symbol] * 100;
      const dollars = kellyAllocations[symbol] * portfolioSize;
      console.log(`${symbol}: ${percentage.toFixed(2)}% ($${dollars.toFixed(2)})`);
      total += percentage;
    }
    console.log(`Total: ${total.toFixed(2)}%`);
    
    // Calculate and print half and quarter Kelly
    console.log('\nHalf Kelly Allocation:');
    console.log('------------------------------------');
    total = 0;
    for (const symbol of symbols) {
      const percentage = kellyAllocations[symbol] * 50;
      const dollars = kellyAllocations[symbol] * portfolioSize * 0.5;
      const cashPerAsset = (portfolioSize * 0.5) / symbols.length;
      const cashPercentage = 50 / symbols.length;
      
      console.log(`${symbol}: ${percentage.toFixed(2)}% ($${dollars.toFixed(2)}) + Cash: ${cashPercentage.toFixed(2)}% ($${cashPerAsset.toFixed(2)})`);
      total += percentage + cashPercentage;
    }
    console.log(`Total: ${total.toFixed(2)}%`);
    
    console.log('\nQuarter Kelly Allocation:');
    console.log('------------------------------------');
    total = 0;
    for (const symbol of symbols) {
      const percentage = kellyAllocations[symbol] * 25;
      const dollars = kellyAllocations[symbol] * portfolioSize * 0.25;
      const cashPerAsset = (portfolioSize * 0.75) / symbols.length;
      const cashPercentage = 75 / symbols.length;
      
      console.log(`${symbol}: ${percentage.toFixed(2)}% ($${dollars.toFixed(2)}) + Cash: ${cashPercentage.toFixed(2)}% ($${cashPerAsset.toFixed(2)})`);
      total += percentage + cashPercentage;
    }
    console.log(`Total: ${total.toFixed(2)}%`);
    
    return {
      kellyAllocations,
      expectedReturns,
      volatility,
      correlationMatrix
    };
  } catch (error) {
    console.error('Error in Kelly allocation:', error);
    throw error;
  }
}

// Example usage
const symbols = ['TSLA', 'NVDA', 'CPNG', 'SHOP', 'MELI'];
const returnAdjustments = {
  'TSLA': 0.03,  // Adjust Tesla's expected return up by 3%
  'NVDA': 0.05   // Adjust NVIDIA's expected return up by 5%
};

// Uncomment to run the analysis
// runAdvancedKellyAllocation(symbols, 1000, returnAdjustments)
//   .then(results => console.log('Analysis complete'))
//   .catch(error => console.error('Analysis failed:', error));

module.exports = {
  calculateAdvancedKelly,
  calculateSimplifiedKelly,
  fetchHistoricalData,
  calculateReturns,
  calculateVolatility,
  calculateCorrelationMatrix,
  calculateExpectedReturns,
  runAdvancedKellyAllocation
};
