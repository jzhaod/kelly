/**
 * Utility functions for financial calculations
 * This module contains functions for calculating various financial metrics:
 * - Volatility
 * - Expected Returns
 * - Beta
 * - Correlation Matrix
 * - Risk/Return Analysis
 */

/**
 * Calculates the volatility of a stock based on historical returns
 * @param {Array} returns - Array of daily returns
 * @param {Number} annualizationFactor - Number of trading days in a year (default: 252)
 * @returns {Number} - Annualized volatility as a decimal (e.g., 0.30 for 30%)
 */
function calculateVolatility(returns, annualizationFactor = 252) {
  if (!returns || !Array.isArray(returns) || returns.length < 2) {
    throw new Error('Returns must be an array with at least 2 data points');
  }
  
  // Filter out invalid or extreme returns
  const filteredReturns = returns.filter(ret => 
    !isNaN(ret) && isFinite(ret) && ret > -0.20 && ret < 0.20
  );
  
  if (filteredReturns.length < 2) {
    throw new Error('Not enough valid returns after filtering');
  }
  
  // Calculate mean return
  const meanReturn = filteredReturns.reduce((sum, ret) => sum + ret, 0) / filteredReturns.length;
  
  // Calculate variance
  const variance = filteredReturns.reduce((sum, ret) => 
    sum + Math.pow(ret - meanReturn, 2), 0) / (filteredReturns.length - 1);
  
  // Calculate standard deviation
  const stdDev = Math.sqrt(variance);
  
  // Annualize volatility
  return stdDev * Math.sqrt(annualizationFactor);
}

/**
 * Calculates expected return using the Capital Asset Pricing Model (CAPM)
 * @param {Number} beta - Stock's beta coefficient relative to the market
 * @param {Number} riskFreeRate - Risk-free rate as a decimal (e.g., 0.045 for 4.5%)
 * @param {Number} marketReturn - Expected market return as a decimal (e.g., 0.10 for 10%)
 * @returns {Number} - Expected return as a decimal (e.g., 0.15 for 15%)
 */
function calculateExpectedReturnCAPM(beta, riskFreeRate, marketReturn) {
  if (isNaN(beta) || !isFinite(beta)) {
    throw new Error('Beta must be a valid number');
  }
  
  if (isNaN(riskFreeRate) || !isFinite(riskFreeRate)) {
    throw new Error('Risk-free rate must be a valid number');
  }
  
  if (isNaN(marketReturn) || !isFinite(marketReturn)) {
    throw new Error('Market return must be a valid number');
  }
  
  // CAPM formula: E(R) = Rf + β(Rm - Rf)
  const equityRiskPremium = marketReturn - riskFreeRate;
  const expectedReturn = riskFreeRate + (beta * equityRiskPremium);
  
  // Apply reasonable constraints (0% to 60%)
  return Math.max(0, Math.min(0.60, expectedReturn));
}

/**
 * Calculates beta coefficient based on stock's volatility relative to market volatility
 * @param {Number} stockVolatility - Stock's volatility as a decimal
 * @param {Number} marketVolatility - Market's volatility as a decimal
 * @returns {Number} - Beta coefficient
 */
function calculateBeta(stockVolatility, marketVolatility) {
  if (isNaN(stockVolatility) || !isFinite(stockVolatility) || stockVolatility <= 0) {
    throw new Error('Stock volatility must be a positive number');
  }
  
  if (isNaN(marketVolatility) || !isFinite(marketVolatility) || marketVolatility <= 0) {
    throw new Error('Market volatility must be a positive number');
  }
  
  return stockVolatility / marketVolatility;
}

/**
 * Calculates daily returns from an array of prices
 * @param {Array} prices - Array of historical prices (oldest first)
 * @returns {Array} - Array of daily returns
 */
function calculateDailyReturns(prices) {
  if (!prices || !Array.isArray(prices) || prices.length < 2) {
    throw new Error('Prices must be an array with at least 2 data points');
  }
  
  const returns = [];
  
  for (let i = 1; i < prices.length; i++) {
    if (prices[i-1] !== 0) {
      // Formula: (Current Price - Previous Price) / Previous Price
      const dailyReturn = (prices[i] - prices[i-1]) / prices[i-1];
      returns.push(dailyReturn);
    }
  }
  
  return returns;
}

/**
 * Calculates the correlation matrix between multiple assets
 * @param {Object} returns - Object with keys as asset symbols and values as arrays of returns
 * @returns {Object} - Object containing the correlation matrix and symbols array
 */
function calculateCorrelationMatrix(returns) {
  if (!returns || typeof returns !== 'object') {
    throw new Error('Returns must be an object with symbol keys and return arrays');
  }
  
  const symbols = Object.keys(returns);
  
  if (symbols.length === 0) {
    throw new Error('No valid symbols provided for correlation calculation');
  }
  
  // Initialize correlation matrix
  const correlationMatrix = Array(symbols.length).fill().map(() => Array(symbols.length).fill(0));
  
  // Fill correlation matrix
  for (let i = 0; i < symbols.length; i++) {
    // Diagonal elements are always 1 (self-correlation)
    correlationMatrix[i][i] = 1;
    
    for (let j = i + 1; j < symbols.length; j++) {
      const returnsI = returns[symbols[i]];
      const returnsJ = returns[symbols[j]];
      
      // Skip if either return array is missing or too short
      if (!returnsI || !returnsJ || returnsI.length < 2 || returnsJ.length < 2) {
        // Skip calculation but log warning - don't use arbitrary default values
        console.warn(`Cannot calculate correlation between ${symbols[i]} and ${symbols[j]}: insufficient data`);
        // Mark as null to indicate missing data rather than using an arbitrary default
        correlationMatrix[i][j] = null;
        correlationMatrix[j][i] = null;
        continue;
      }
      
      // Calculate correlation
      const meanI = returnsI.reduce((sum, ret) => sum + ret, 0) / returnsI.length;
      const meanJ = returnsJ.reduce((sum, ret) => sum + ret, 0) / returnsJ.length;
      
      let numerator = 0;
      let denominatorI = 0;
      let denominatorJ = 0;
      
      // Use the minimum length of the two arrays
      const minLength = Math.min(returnsI.length, returnsJ.length);
      
      for (let k = 0; k < minLength; k++) {
        const diffI = returnsI[k] - meanI;
        const diffJ = returnsJ[k] - meanJ;
        
        numerator += diffI * diffJ;
        denominatorI += diffI * diffI;
        denominatorJ += diffJ * diffJ;
      }
      
      if (denominatorI > 0 && denominatorJ > 0) {
        const correlation = numerator / (Math.sqrt(denominatorI) * Math.sqrt(denominatorJ));
        
        // Handle potential NaN or Infinity values
        if (isNaN(correlation) || !isFinite(correlation)) {
          console.warn(`Got invalid correlation between ${symbols[i]} and ${symbols[j]}: NaN or Infinity`);
          correlationMatrix[i][j] = null;
          correlationMatrix[j][i] = null;
        } else {
          correlationMatrix[i][j] = correlation;
          correlationMatrix[j][i] = correlation; // Symmetric
        }
      } else {
        // Denominator is zero, can't calculate correlation
        console.warn(`Cannot calculate correlation between ${symbols[i]} and ${symbols[j]}: zero variance`);
        correlationMatrix[i][j] = null;
        correlationMatrix[j][i] = null;
      }
    }
  }
  
  return {
    correlationMatrix,
    symbols
  };
}

/**
 * Calculates risk/return ratio (Sharpe Ratio without risk-free rate)
 * @param {Number} expectedReturn - Expected return as a decimal
 * @param {Number} volatility - Volatility as a decimal
 * @returns {Number} - Risk/return ratio
 */
function calculateRiskReturnRatio(expectedReturn, volatility) {
  if (isNaN(expectedReturn) || !isFinite(expectedReturn)) {
    throw new Error('Expected return must be a valid number');
  }
  
  if (isNaN(volatility) || !isFinite(volatility) || volatility <= 0) {
    throw new Error('Volatility must be a positive number');
  }
  
  return expectedReturn / volatility;
}

/**
 * Calculates Sharpe Ratio
 * @param {Number} expectedReturn - Expected return as a decimal
 * @param {Number} volatility - Volatility as a decimal
 * @param {Number} riskFreeRate - Risk-free rate as a decimal
 * @returns {Number} - Sharpe ratio
 */
function calculateSharpeRatio(expectedReturn, volatility, riskFreeRate) {
  if (isNaN(expectedReturn) || !isFinite(expectedReturn)) {
    throw new Error('Expected return must be a valid number');
  }
  
  if (isNaN(volatility) || !isFinite(volatility) || volatility <= 0) {
    throw new Error('Volatility must be a positive number');
  }
  
  if (isNaN(riskFreeRate) || !isFinite(riskFreeRate)) {
    throw new Error('Risk-free rate must be a valid number');
  }
  
  return (expectedReturn - riskFreeRate) / volatility;
}

/**
 * Performs portfolio analysis based on historical data
 * @param {Object} historicalData - Object with symbols as keys and price arrays as values
 * @param {Number} riskFreeRate - Risk-free rate as a decimal
 * @param {Number} marketReturn - Expected market return as a decimal
 * @returns {Object} - Analysis results including volatility, expected returns, and correlation
 */
function analyzePortfolio(historicalData, riskFreeRate = 0.045, marketReturn = 0.10) {
  if (!historicalData || typeof historicalData !== 'object') {
    throw new Error('Historical data must be an object with symbol keys');
  }
  
  const symbols = Object.keys(historicalData);
  
  if (symbols.length === 0) {
    throw new Error('No valid symbols provided for portfolio analysis');
  }
  
  // Calculate returns for each symbol
  const returns = {};
  for (const symbol of symbols) {
    if (historicalData[symbol] && historicalData[symbol].prices && 
        Array.isArray(historicalData[symbol].prices) && 
        historicalData[symbol].prices.length >= 2) {
      
      returns[symbol] = calculateDailyReturns(historicalData[symbol].prices);
    }
  }
  
  // Calculate volatility for each symbol
  const volatility = {};
  for (const symbol of Object.keys(returns)) {
    try {
      volatility[symbol] = calculateVolatility(returns[symbol]);
    } catch (error) {
      console.warn(`Could not calculate volatility for ${symbol}: ${error.message}`);
    }
  }
  
  // Calculate beta and expected returns using CAPM
  const beta = {};
  const expectedReturns = {};
  const marketVolatility = 0.20; // Default market volatility
  
  for (const symbol of Object.keys(volatility)) {
    beta[symbol] = calculateBeta(volatility[symbol], marketVolatility);
    expectedReturns[symbol] = calculateExpectedReturnCAPM(beta[symbol], riskFreeRate, marketReturn);
  }
  
  // Calculate correlation matrix
  const { correlationMatrix } = calculateCorrelationMatrix(returns);
  
  // Calculate risk/return metrics
  const riskReturnMetrics = {};
  for (const symbol of Object.keys(expectedReturns)) {
    riskReturnMetrics[symbol] = {
      riskReturnRatio: calculateRiskReturnRatio(expectedReturns[symbol], volatility[symbol]),
      sharpeRatio: calculateSharpeRatio(expectedReturns[symbol], volatility[symbol], riskFreeRate)
    };
  }
  
  return {
    symbols: Object.keys(volatility), // Only include symbols with valid calculations
    volatility,
    expectedReturns,
    beta,
    correlationMatrix,
    riskReturnMetrics
  };
}

module.exports = {
  calculateVolatility,
  calculateExpectedReturnCAPM,
  calculateBeta,
  calculateDailyReturns,
  calculateCorrelationMatrix,
  calculateRiskReturnRatio,
  calculateSharpeRatio,
  analyzePortfolio
};