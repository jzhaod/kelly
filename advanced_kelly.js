/**
 * Advanced Kelly Criterion Portfolio Allocation
 * 
 * This script implements a more sophisticated version of the Kelly Criterion
 * that takes into account correlations between assets.
 * 
 * Note: This requires external data (historical prices) to calculate correlations
 * and volatilities accurately. The example data below is for illustration.
 */

// Import required modules
const math = require('mathjs');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

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
  

  try {
    console.log("[DEBUG] Starting advanced Kelly calculation with inputs:", 
      { symbolsCount: symbols.length, riskFreeRate });
    
    // Validate inputs before calculation
    if (!symbols || symbols.length === 0) {
      throw new Error("No symbols provided for Kelly calculation");
    }
    
    // Check for missing expected returns or volatility values
    const missingReturns = symbols.filter(s => expectedReturns[s] === undefined);
    const missingVol = symbols.filter(s => volatility[s] === undefined);
    
    if (missingReturns.length > 0) {
      console.error(`[DEBUG] Missing expected returns for symbols: ${missingReturns.join(', ')}`);
      throw new Error(`Missing expected returns for ${missingReturns.length} symbols`);
    }
    
    if (missingVol.length > 0) {
      console.error(`[DEBUG] Missing volatility for symbols: ${missingVol.join(', ')}`);
      throw new Error(`Missing volatility for ${missingVol.length} symbols`);
    }
    
    // Check correlation matrix dimensions
    if (!correlationMatrix || !Array.isArray(correlationMatrix) || 
        correlationMatrix.length !== symbols.length) {
      console.error(`[DEBUG] Invalid correlation matrix dimensions: expected ${symbols.length}x${symbols.length}, got ${correlationMatrix?.length || 0}x${correlationMatrix?.[0]?.length || 0}`);
      throw new Error("Invalid correlation matrix dimensions");
    }
    
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
    
    console.log("[DEBUG] Covariance matrix calculated successfully");
    
    // Excess returns vector (expected return - risk-free rate)
    const excessReturns = symbols.map(symbol => expectedReturns[symbol] - riskFreeRate);
    
    // Check for negative excess returns
    const negativeExcessReturns = excessReturns.filter(r => r < 0);
    if (negativeExcessReturns.length > 0) {
      console.warn(`[DEBUG] ${negativeExcessReturns.length} symbols have expected returns lower than risk-free rate`);
    }
    
    // Calculate inverse of covariance matrix
    try {
      const covarianceMatrixInverse = math.inv(covarianceMatrix);
      console.log("[DEBUG] Covariance matrix inverse calculated successfully");
      
      // Calculate Kelly allocation (w = Σ^-1 * μ)
      const kellyWeights = math.multiply(covarianceMatrixInverse, excessReturns);
      
      // Sum of weights (for normalization)
      const sumWeights = math.sum(kellyWeights);
      
      console.log("[DEBUG] Kelly weights:", kellyWeights);
      console.log("[DEBUG] Sum of weights:", sumWeights);
      
      if (sumWeights === 0) {
        throw new Error("Sum of Kelly weights is zero, cannot normalize");
      }
      
      // Normalize to 100% allocation
      let normalizedWeights;
      
      // Check if kellyWeights is an array or matrix object
      if (Array.isArray(kellyWeights)) {
        normalizedWeights = kellyWeights.map(w => w / sumWeights);
      } else if (kellyWeights._data) {
        // Handle mathjs matrix object
        normalizedWeights = Array.from(kellyWeights._data).map(w => w / sumWeights);
      } else {
        console.error("[DEBUG] Unknown kellyWeights type:", typeof kellyWeights);
        throw new Error("Unable to normalize weights: unknown type");
      }
      
      console.log("[DEBUG] Normalized weights:", normalizedWeights);
      
      // Verify no NaN or Infinity values
      const hasInvalidValues = normalizedWeights.some(w => isNaN(w) || !isFinite(w));
      if (hasInvalidValues) {
        throw new Error("Invalid values (NaN or Infinity) in normalized weights");
      }
      
      const result = {};
      for (let i = 0; i < symbols.length; i++) {
        result[symbols[i]] = normalizedWeights[i];
      }
      
      console.log("[DEBUG] Advanced Kelly calculation completed successfully:", result);
      return result;
    } catch (matrixError) {
      console.error("[DEBUG] Matrix calculation error:", matrixError);
      throw new Error(`Matrix error: ${matrixError.message}`);
    }
  } catch (error) {
    console.error("[DEBUG] Error in advanced Kelly calculation:", error);
    console.warn("[DEBUG] Falling back to simplified Kelly calculation");
    
    // Log diagnostic information
    console.log("[DEBUG] Input diagnostics for fallback calculation:", {
      symbols,
      expectedReturnsPresent: symbols.map(s => expectedReturns[s] !== undefined),
      volatilityPresent: symbols.map(s => volatility[s] !== undefined),
      correlationMatrixShape: correlationMatrix ? 
        `${correlationMatrix.length}x${correlationMatrix[0]?.length}` : 'undefined'
    });
    
    // Fall back to simplified Kelly calculation if advanced method fails
    return calculateSimplifiedKelly(symbols, expectedReturns, volatility, riskFreeRate);
  }
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
  console.log("[DEBUG] Running simplified Kelly calculation");
  
  // Validate inputs
  if (!symbols || symbols.length === 0) {
    console.error("[DEBUG] No symbols provided for simplified Kelly calculation");
    return {};
  }
  
  const kellyFractions = {};
  const invalidSymbols = [];
  const negativeKellySymbols = [];
  
  // Calculate Kelly fraction for each asset
  for (const symbol of symbols) {
    try {
      // Check if we have expected return and volatility for this symbol
      if (expectedReturns[symbol] === undefined) {
        console.error(`[DEBUG] Missing expected return for ${symbol}`);
        invalidSymbols.push(symbol);
        continue;
      }
      
      if (volatility[symbol] === undefined) {
        console.error(`[DEBUG] Missing volatility for ${symbol}`);
        invalidSymbols.push(symbol);
        continue;
      }
      
      // Check if volatility is zero or very small
      if (volatility[symbol] === 0 || volatility[symbol] < 0.0001) {
        console.error(`[DEBUG] Volatility for ${symbol} is zero or too small: ${volatility[symbol]}`);
        invalidSymbols.push(symbol);
        continue;
      }
      
      const excessReturn = expectedReturns[symbol] - riskFreeRate;
      const kellyFraction = excessReturn / (volatility[symbol] * volatility[symbol]);
      kellyFractions[symbol] = kellyFraction;
      
      // Log negative Kelly fractions
      if (kellyFraction < 0) {
        negativeKellySymbols.push(symbol);
        console.warn(`[DEBUG] Negative Kelly fraction for ${symbol}: ${kellyFraction} (excess return: ${excessReturn}, volatility: ${volatility[symbol]})`);
      }
    } catch (error) {
      console.error(`[DEBUG] Error calculating Kelly fraction for ${symbol}:`, error);
      invalidSymbols.push(symbol);
    }
  }
  
  // Log summary of calculation state
  console.log(`[DEBUG] Calculated Kelly fractions for ${Object.keys(kellyFractions).length} valid symbols`);
  if (invalidSymbols.length > 0) {
    console.warn(`[DEBUG] Skipped ${invalidSymbols.length} invalid symbols: ${invalidSymbols.join(', ')}`);
  }
  if (negativeKellySymbols.length > 0) {
    console.warn(`[DEBUG] ${negativeKellySymbols.length} symbols have negative Kelly fractions: ${negativeKellySymbols.join(', ')}`);
  }
  
  // Handle empty kellyFractions
  if (Object.keys(kellyFractions).length === 0) {
    console.error("[DEBUG] No valid Kelly fractions calculated, returning empty allocations");
    return {};
  }
  
  // Sum of all Kelly fractions (for normalization)
  const totalKelly = Object.values(kellyFractions).reduce((sum, val) => sum + val, 0);
  
  if (totalKelly === 0) {
    console.error("[DEBUG] Sum of Kelly fractions is zero, cannot normalize");
    return {};
  }
  
  // Normalize fractions
  const normalizedFractions = {};
  for (const symbol in kellyFractions) {
    normalizedFractions[symbol] = kellyFractions[symbol] / totalKelly;
  }
  
  console.log("[DEBUG] Simplified Kelly calculation completed:", normalizedFractions);
  return normalizedFractions;
}

/**
 * Fetches historical data for stocks from local data files
 * @param {Array} symbols - Array of asset symbols
 * @param {Number} lookbackPeriod - Number of days to look back
 * @returns {Object} - Historical price data
 */
async function fetchHistoricalData(symbols, lookbackPeriod = 252) {
  console.log(`Fetching historical data for ${symbols.join(', ')} for the past ${lookbackPeriod} trading days...`);
  
  // Import the data processor
  const { createDataProcessor } = require('./data_processor');
  
  // Define paths
  const DATA_DIR = path.join(__dirname, 'data');
  const YAHOO_DIR = path.join(DATA_DIR, 'yahoo');
  
  const historicalData = {};
  const missingSymbols = [];
  
  for (const symbol of symbols) {
    try {
      let dataLoaded = false;
      
      // Try to load data from CSV file first
      const csvPath = path.join(DATA_DIR, `${symbol}.csv`);
      
      try {
        // Check if CSV file exists
        await fsPromises.access(csvPath);
        
        // Read CSV file
        const csvData = await fsPromises.readFile(csvPath, 'utf8');
        
        // Process data using the CSV data processor
        const csvProcessor = createDataProcessor('csv');
        const processedData = await csvProcessor.processData(csvData);
        
        // Extract the necessary data
        if (processedData && processedData.data && processedData.data.length > 0) {
          // Convert data format to what is expected by the Kelly calculations
          const prices = [];
          const dates = [];
          
          // Take the last lookbackPeriod data points (or all if less than lookbackPeriod)
          const limitedData = processedData.data.slice(-lookbackPeriod);
          
          for (const point of limitedData) {
            prices.push(point['Adj Close'] || point.Close);
            dates.push(point.Date);
          }
          
          if (prices.length > 0) {
            historicalData[symbol] = {
              prices,
              dates
            };
            
            console.log(`Loaded ${prices.length} data points for ${symbol} from CSV`);
            dataLoaded = true;
          }
        }
      } catch (error) {
        // If CSV file doesn't exist or can't be processed, try JSON
        console.log(`Could not load CSV data for ${symbol}: ${error.message}. Trying JSON...`);
        console.log(`Debug - Error type: ${error.name}, Stack: ${error.stack}`);
      }
      
      // If CSV didn't work, try to load data from JSON file
      if (!dataLoaded) {
        try {
          const jsonPath = path.join(YAHOO_DIR, `${symbol}.json`);
          await fsPromises.access(jsonPath);
          
          // Read JSON file
          const jsonData = await fsPromises.readFile(jsonPath, 'utf8');
          const jsonContent = JSON.parse(jsonData);
          
          // Process data using the JSON data processor
          const jsonProcessor = createDataProcessor('json');
          const processedData = await jsonProcessor.processData({ 
            symbol, 
            data: jsonContent 
          });
          
          // Extract the necessary data
          if (processedData && processedData.data && processedData.data.length > 0) {
            // Convert data format to what is expected by the Kelly calculations
            const prices = [];
            const dates = [];
            
            // Take the last lookbackPeriod data points (or all if less than lookbackPeriod)
            const limitedData = processedData.data.slice(-lookbackPeriod);
            
            for (const point of limitedData) {
              prices.push(point['Adj Close'] || point.Close);
              dates.push(point.Date);
            }
            
            if (prices.length > 0) {
              historicalData[symbol] = {
                prices,
                dates
              };
              
              console.log(`Loaded ${prices.length} data points for ${symbol} from JSON`);
              dataLoaded = true;
            }
          }
        } catch (error) {
          console.log(`Could not load JSON data for ${symbol}: ${error.message}`);
          console.log(`Debug - Error type: ${error.name}, Stack: ${error.stack}`);
        }
      }
      
      // If no data was loaded, track this symbol as missing
      if (!dataLoaded) {
        console.error(`No historical data found for ${symbol}. Please ensure data files exist.`);
        missingSymbols.push(symbol);
      }
    } catch (error) {
      console.error(`Error processing data for ${symbol}:`, error);
      missingSymbols.push(symbol);
    }
  }
  
  // Check if we have any data at all
  if (Object.keys(historicalData).length === 0) {
    throw new Error(`No historical data found for any symbols: ${symbols.join(', ')}. Please ensure data files exist in the /data or /data/yahoo directories.`);
  }
  
  // Check if we have any missing symbols
  if (missingSymbols.length > 0) {
    console.warn(`Warning: Missing historical data for the following symbols: ${missingSymbols.join(', ')}`);
  }
  
  return historicalData;
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
 * This function has been moved to utils.js to avoid duplication
 * @param {Object} returns - Daily returns
 * @returns {Array} - Correlation matrix
 */
function calculateCorrelationMatrix(returns) {
  // Import the utility function
  const { calculateCorrelationMatrix } = require('./utils');
  return calculateCorrelationMatrix(returns).correlationMatrix;
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
    // The utility function returns {correlationMatrix, symbols} so we need to extract just the matrix
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
    
    // Calculate and print 90%, half, and quarter Kelly
    console.log('\n90% Kelly Allocation:');
    console.log('------------------------------------');
    total = 0;
    for (const symbol of symbols) {
      const percentage = kellyAllocations[symbol] * 90;
      const dollars = kellyAllocations[symbol] * portfolioSize * 0.9;
      const cashPerAsset = (portfolioSize * 0.1) / symbols.length;
      const cashPercentage = 10 / symbols.length;
      
      console.log(`${symbol}: ${percentage.toFixed(2)}% ($${dollars.toFixed(2)}) + Cash: ${cashPercentage.toFixed(2)}% ($${cashPerAsset.toFixed(2)})`);
      total += percentage + cashPercentage;
    }
    console.log(`Total: ${total.toFixed(2)}%`);

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
    
    // Calculate fractional Kelly allocations for return value
    const ninetyPercentKelly = {};
    const halfKelly = {};
    const quarterKelly = {};
    
    for (const symbol of symbols) {
      ninetyPercentKelly[symbol] = kellyAllocations[symbol] * 0.9;
      halfKelly[symbol] = kellyAllocations[symbol] * 0.5;
      quarterKelly[symbol] = kellyAllocations[symbol] * 0.25;
    }
    
    return {
      kellyAllocations,
      ninetyPercentKelly,
      halfKelly,
      quarterKelly,
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
runAdvancedKellyAllocation(symbols, 1000, returnAdjustments)
   .then(results => console.log('Analysis complete'))
   .catch(error => console.error('Analysis failed:', error));

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
