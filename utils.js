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
 * To calculate stock volatility, you can use the standard deviation of the stock's historical returns, which involves finding the average return, calculating the difference between each return and the average, squaring those differences, averaging the squared differences, and finally taking the square root of that average. [1, 2, 3, 4]
 * 
 * NOTE: This function now uses the volatilityPeriod setting from stock_settings.json to limit calculations 
 * to the most recent trading days specified by that value. It also always reads annualizationFactor from
 * settings rather than using default values.
 * 
 * Here's a more detailed breakdown: [2, 5, 6]
 * 1. Gather Historical Data: [2, 5, 6]
 * • Collect the stock's closing prices (or other relevant price data) over a specific period (e.g., daily, weekly, monthly).
 * • The longer the period, the more data you'll have, potentially leading to a more accurate volatility estimate. [2, 5, 6]
 *
 * 2. Calculate Daily Returns: [7, 8]
 * • For each period (e.g., day), calculate the return by subtracting the previous period's price from the current period's price and dividing by the previous period's price.
 *    • Formula: Return = (Current Price - Previous Price) / Previous Price
 *
 * • Example: If the price was $100 yesterday and $105 today, the return is ($105 - $100) / $100 = 5%. [7, 8]
 *
 * 3. Calculate the Mean (Average) Return: [1, 2]
 * • Add up all the daily returns and divide by the number of periods (e.g., days). [1, 2]
 *
 * 4. Calculate Standard Deviation: [1, 2]
 * • Step 1: Find the Difference from the Mean: Subtract the mean return from each individual return.
 * • Step 2: Square the Differences: Square each of the differences calculated in the previous step.
 * • Step 3: Calculate the Variance: Add up all the squared differences and divide by the number of periods minus 1 (this is the sample variance).
 * • Step 4: Calculate the Standard Deviation: Take the square root of the variance. [1, 2]
 *
 * 5. Annualize the Volatility (Optional): [3, 6, 9]
 *
 * • If you want to express volatility on an annual basis, multiply the standard deviation by the square root of the number of periods in a year (e.g., square root of 252 for trading days).
 *    • Formula: Annualized Volatility = Standard Deviation * √Number of Periods in a Year [3, 6, 9]
 *
 * Example: [1, 2]
 * Let's say you have the following daily returns: 2%, -1%, 3%, 0%, -2%. [1, 2, 3, 6, 9]
 *
 * 1. Mean Return: (2% - 1% + 3% + 0% - 2%) / 5 = 0.6%
 * 2. Calculate Differences: 2% - 0.6% = 1.4%, -1% - 0.6% = -1.6%, etc.
 * 3. Square the Differences: (1.4%)^2 = 1.96%, (-1.6%)^2 = 2.56%, etc.
 * 4. Variance: (1.96% + 2.56% + ... ) / 4 = 2.2%
 * 5. Standard Deviation: √2.2% = 1.48%
 * 6. Annualized Volatility: 1.48% * √252 = 21.3%
 *
 * Tools for Calculation: [8, 9]
 *
 * • Spreadsheets (like Excel): Use the STDEV function to calculate standard deviation and the SQRT function for the square root. [8, 9]
 * • Financial Software: Many financial software platforms offer built-in volatility calculation tools. [10]
 * • Online Calculators: You can find online calculators that can help you with the calculations. [10]
 *
 * Generative AI is experimental.
 *
 * [1]https://www.investopedia.com/terms/v/volatility.asp
 * [2]https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/volatility-vol/
 * [3]https://www.tiingo.com/blog/how-to-calculate-volatility/
 * [4]https://www.sofi.com/learn/content/understanding-stock-volatility/
 * [5]https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/historical-volatility-hv/
 * [6]https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/stockbased_compensat/stockbased_compensat__3_US/chapter_9_developing_US/94_expected_volatili_US.html
 * [7]https://www.youtube.com/watch?v=A7LtrEJKHpg
 * [8]https://zerodha.com/varsity/chapter/volatility-calculation-historical/
 * [9]https://www.fool.com/investing/how-to-invest/stocks/how-to-calculate-stock-volatility
 * [10]https://m.youtube.com/watch?v=lcPZcFZXDNA&pp=ygUPI215ZGRhaWx5dm9sbG9n
 * @param {Array} returns - Array of daily returns (can be either an array of numbers or objects with 'return' property)
 * @returns {Number} - Annualized volatility as a decimal (e.g., 0.30 for 30%)
 */
function calculateVolatility(returns) {
  if (!returns || !Array.isArray(returns) || returns.length < 2) {
    throw new Error('Returns must be an array with at least 2 data points');
  }
  
  // Get parameters from settings
  let limitedReturns = returns;
  let annualizationFactor;
  
  try {
    // Get settings parameters
    const { getFinancialParameters } = require('./settings_loader');
    const params = getFinancialParameters();
    
    // Always use annualizationFactor from settings
    annualizationFactor = params.annualizationFactor;
    
    // Limit the number of returns based on volatilityPeriod
    if (returns.length > params.volatilityPeriod) {
      // If returns is an array of objects with a 'return' property (like in server.js)
      if (typeof returns[0] === 'object' && 'return' in returns[0]) {
        limitedReturns = returns.slice(-params.volatilityPeriod);
        console.log(`Using ${limitedReturns.length} most recent returns for volatility calculation (volatilityPeriod=${params.volatilityPeriod})`);
      } 
      // If returns is a simple array of numbers
      else {
        limitedReturns = returns.slice(-params.volatilityPeriod);
        console.log(`Using ${limitedReturns.length} most recent returns for volatility calculation (volatilityPeriod=${params.volatilityPeriod})`);
      }
    }
  } catch (error) {
    console.error('Error loading settings for volatility calculation:', error.message);
    throw new Error(`Failed to calculate volatility: ${error.message}`);
  }
  
  // Extract return values if working with objects
  const returnValues = typeof limitedReturns[0] === 'object' && 'return' in limitedReturns[0] 
    ? limitedReturns.map(r => r.return) 
    : limitedReturns;
  
  // Filter out invalid or extreme returns
  const filteredReturns = returnValues.filter(ret => 
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
 * To calculate the expected return of a stock, you can use the Capital Asset Pricing Model (CAPM), which uses the formula:  Expected Return = Risk-Free Rate (rf) + Beta (β) × Equity Risk Premium (ERP). [1, 2, 3]
 * Here's a breakdown: [1, 2]
 * 1. Understand the Components: [1, 2]
 *
 * • Risk-Free Rate (rf): This is the return you'd expect from a risk-free investment, often represented by the yield on government debt (like a 10-year Treasury note).
 * • Beta (β): This measures the stock's volatility relative to the overall market. A beta of 1 means the stock moves in line with the market, while a beta greater than 1 suggests higher volatility.
 * • Equity Risk Premium (ERP): This is the extra return investors expect for investing in the stock market compared to risk-free investments. It's calculated as: ERP = Market Return (rm) - Risk-Free Rate (rf). [1, 2]
 *
 * 2. Calculate the Expected Return: [1, 2]
 *
 * • Formula: Expected Return = Risk-Free Rate (rf) + Beta (β) × Equity Risk Premium (ERP)
 * • Example:
 *    • Let's say the risk-free rate (rf) is 2%, the stock's beta (β) is 1.2, and the expected market return (rm) is 10%.
 *    • ERP = 10% - 2% = 8%
 *    • Expected Return = 2% + 1.2 * 8% = 11.6% [1, 2, 4]
 *
 * 3. Additional Considerations: [5, 6]
 *
 * • Historical Data: You can also estimate expected returns by analyzing historical stock returns and probabilities of different outcomes. [5, 6]
 * • Scenario Analysis: Consider various scenarios (e.g., optimistic, pessimistic, and most likely) and their associated probabilities to calculate a more comprehensive expected return. [5, 6]
 * • Limitations: CAPM is a model and has limitations. It's based on certain assumptions, and the actual return may differ from the expected return. [7]
 *
 * Generative AI is experimental.
 *
 * [1]https://www.wallstreetprep.com/knowledge/expected-return
 * [2]https://www.investopedia.com/ask/answers/061215/how-can-i-calculate-expected-return-my-portfolio.asp
 * [3]https://www.fe.training/free-resources/portfolio-management/expected-returns
 * [4]https://www.wallstreetprep.com/knowledge/capm-capital-asset-pricing-model
 * [5]https://www.sofi.com/learn/content/how-to-calculate-expected-rate-of-return
 * [6]https://www.indeed.com/career-advice/career-development/expected-return
 * [7]https://www.investopedia.com/terms/e/expectedreturn.asp
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
 * @param {Number} riskFreeRate - Risk-free rate as a decimal (optional, will use settings if not provided)
 * @param {Number} marketReturn - Expected market return as a decimal (optional, will use settings if not provided)
 * @returns {Object} - Analysis results including volatility, expected returns, and correlation
 */
function analyzePortfolio(historicalData, riskFreeRate = null, marketReturn = null) {
  if (!historicalData || typeof historicalData !== 'object') {
    throw new Error('Historical data must be an object with symbol keys');
  }
  
  const symbols = Object.keys(historicalData);
  
  if (symbols.length === 0) {
    throw new Error('No valid symbols provided for portfolio analysis');
  }
  
  // Load financial parameters from settings
  let marketVolatility;
  let annualizationFactor;
  try {
    const { getFinancialParameters } = require('./settings_loader');
    const params = getFinancialParameters();
    
    // Use provided values or fall back to settings
    if (riskFreeRate === null) riskFreeRate = params.riskFreeRate;
    if (marketReturn === null) marketReturn = params.marketReturn;
    marketVolatility = params.marketVolatility;
    annualizationFactor = params.annualizationFactor;
    
    console.log(`Using financial parameters from settings: riskFreeRate=${riskFreeRate}, marketReturn=${marketReturn}, marketVolatility=${marketVolatility}, annualizationFactor=${annualizationFactor}`);
    
    // Verify that the values are valid
    if (!isFinite(riskFreeRate) || !isFinite(marketReturn) || !isFinite(marketVolatility) || !isFinite(annualizationFactor)) {
      throw new Error(`Invalid financial parameters detected: riskFreeRate=${riskFreeRate}, marketReturn=${marketReturn}, marketVolatility=${marketVolatility}, annualizationFactor=${annualizationFactor}`);
    }
  } catch (error) {
    console.error('Error loading financial parameters:', error);
    throw error;
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