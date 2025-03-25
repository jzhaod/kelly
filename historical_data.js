/**
 * Historical Stock Data Processing Module
 * 
 * This module provides functions to process historical stock data
 * for use in Kelly Criterion calculations.
 */

const fs = require('fs').promises;
const path = require('path');

// Directory for storing data
const DATA_DIR = path.join(__dirname, 'data');
const STATUS_FILE = path.join(DATA_DIR, 'data_status.json');
const METRICS_FILE = path.join(DATA_DIR, 'volatility_metrics.json');

/**
 * Ensures the data directory exists
 * @returns {Promise<void>}
 */
async function ensureDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Gets the status of all historical data
 * @returns {Promise<Object>} - Status object with information for each stock
 */
async function getDataStatus() {
  await ensureDataDirectory();
  
  try {
    const statusData = await fs.readFile(STATUS_FILE, 'utf8');
    return JSON.parse(statusData);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Create a new status file
      const initialStatus = {
        lastUpdated: new Date().toISOString(),
        stocks: {}
      };
      
      await fs.writeFile(STATUS_FILE, JSON.stringify(initialStatus, null, 2));
      return initialStatus;
    }
    
    throw error;
  }
}

/**
 * Updates the data status for a stock
 * @param {string} symbol - Stock symbol
 * @param {Object} status - Status information
 * @returns {Promise<Object>} - Updated status object
 */
async function updateDataStatus(symbol, status) {
  const currentStatus = await getDataStatus();
  
  // Create or update status for the symbol
  currentStatus.stocks[symbol] = {
    ...currentStatus.stocks[symbol],
    ...status,
    lastUpdated: new Date().toISOString()
  };
  
  // Update overall last updated time
  currentStatus.lastUpdated = new Date().toISOString();
  
  // Save updated status
  await fs.writeFile(STATUS_FILE, JSON.stringify(currentStatus, null, 2));
  
  return currentStatus;
}

/**
 * Gets information about available historical data for a stock
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Status of the data
 */
async function fetchHistoricalData(symbol) {
  await ensureDataDirectory();
  
  const dataFile = path.join(DATA_DIR, `${symbol}.csv`);
  const metricsFile = path.join(DATA_DIR, `${symbol}_metrics.json`);
  const status = await getDataStatus();
  const stockStatus = status.stocks[symbol] || {};
  
  let existingData = '';
  let metrics = null;
  
  try {
    // Try to load existing metrics if available
    metrics = JSON.parse(await fs.readFile(metricsFile, 'utf8'));
    console.log(`Loaded existing metrics for ${symbol}:`, metrics);
  } catch (error) {
    // Metrics file doesn't exist yet, that's okay
    metrics = {
      dataPoints: 0,
      lastCalculatedDate: null,
      volatility: null,
      expectedReturn: null
    };
  }
  
  try {
    // Check if data file exists
    existingData = await fs.readFile(dataFile, 'utf8');
    
    // Parse the CSV data to get information about it
    const lines = existingData.trim().split('\n');
    const hasHeader = lines.length > 0;
    const dataPoints = Math.max(0, lines.length - 1); // Subtract header
    
    // Parse dates from the data
    let startDate = null;
    let endDate = null;
    
    if (lines.length > 1) {
      const headers = lines[0].split(',');
      const dateIndex = headers.indexOf('Date');
      
      if (dateIndex !== -1) {
        // Find all valid dates
        const dates = [];
        for (let i = 1; i < lines.length; i++) {
          const fields = lines[i].split(',');
          if (fields.length > dateIndex) {
            const dateStr = fields[dateIndex];
            if (dateStr) {
              try {
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                  dates.push({ date, dateStr });
                }
              } catch (e) {
                // Skip invalid dates
              }
            }
          }
        }
        
        // Sort dates
        dates.sort((a, b) => a.date - b.date);
        
        if (dates.length > 0) {
          startDate = dates[0].dateStr;
          endDate = dates[dates.length - 1].dateStr;
        }
      }
    }
    
    // Calculate days covered
    let daysCovered = 0;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      daysCovered = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      // Approximate from trading days
      daysCovered = Math.round(dataPoints * 7 / 5);
    }
    
    // Update status
    const newStatus = {
      dataPoints,
      startDate,
      endDate,
      dataComplete: true, // We assume the data is complete (already pre-processed)
      lastFetched: new Date().toISOString(),
      volatility: metrics ? metrics.volatility : null,
      expectedReturn: metrics ? metrics.expectedReturn : null,
      daysCovered,
      gaps: []
    };
    
    await updateDataStatus(symbol, newStatus);
    
    return {
      success: true,
      message: `Found ${dataPoints} data points for ${symbol}`,
      symbol,
      status: newStatus,
      metrics
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist
      return {
        success: false,
        message: `No data file found for ${symbol}. Please add a CSV file for this symbol in the data directory.`,
        symbol
      };
    }
    
    // Other errors
    return {
      success: false,
      message: `Error reading data for ${symbol}: ${error.message}`,
      symbol
    };
  }
}

/**
 * Deletes historical data for a stock
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Status of the delete operation
 */
async function deleteHistoricalData(symbol) {
  await ensureDataDirectory();
  
  const dataFile = path.join(DATA_DIR, `${symbol}.csv`);
  const metricsFile = path.join(DATA_DIR, `${symbol}_metrics.json`);
  const status = await getDataStatus();
  
  try {
    // Check if files exist
    const dataFileExists = await fileExists(dataFile);
    const metricsFileExists = await fileExists(metricsFile);
    
    // Delete the data file if it exists
    if (dataFileExists) {
      await fs.unlink(dataFile);
    }
    
    // Delete the metrics file if it exists
    if (metricsFileExists) {
      await fs.unlink(metricsFile);
    }
    
    // Remove from status
    if (status.stocks[symbol]) {
      delete status.stocks[symbol];
      await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
    }
    
    return {
      success: true,
      message: `Successfully deleted historical data for ${symbol}`,
      symbol
    };
  } catch (error) {
    console.error(`Error deleting data for ${symbol}:`, error.message);
    
    return {
      success: false,
      message: `Error deleting data for ${symbol}: ${error.message}`,
      symbol
    };
  }
}

/**
 * Checks if a file exists
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} - True if file exists, false otherwise
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Calculates daily returns from CSV data
 * @param {string} csvData - Raw CSV data
 * @returns {Array} - Array of daily returns
 */
function calculateDailyReturnsFromCSV(csvData) {
  const lines = csvData.trim().split('\n');
  
  if (lines.length < 3) {
    throw new Error('Not enough data points to calculate returns');
  }
  
  const headers = lines[0].split(',');
  const dateIndex = headers.indexOf('Date');
  const priceIndex = headers.indexOf('Adj Close');
  
  // If Adj Close is not found, try using Close
  const actualPriceIndex = priceIndex === -1 ? headers.indexOf('Close') : priceIndex;
  
  if (dateIndex === -1 || actualPriceIndex === -1) {
    throw new Error('Required columns not found in data');
  }
  
  const returns = [];
  
  // Start from the second row (index 1) because we need to compare with the previous day
  for (let i = 2; i < lines.length; i++) {
    try {
      const currentRow = lines[i].split(',');
      const previousRow = lines[i-1].split(',');
      
      const currentPrice = parseFloat(currentRow[actualPriceIndex]);
      const previousPrice = parseFloat(previousRow[actualPriceIndex]);
      
      if (isNaN(currentPrice) || isNaN(previousPrice) || previousPrice <= 0) {
        continue; // Skip invalid data points
      }
      
      const dailyReturn = (currentPrice / previousPrice) - 1;
      returns.push({
        date: currentRow[dateIndex],
        return: dailyReturn
      });
    } catch (error) {
      console.warn(`Error processing row ${i}: ${error.message}`);
      // Continue with the next row
    }
  }
  
  return returns;
}

/**
 * Calculates annualized volatility from daily returns
 * @param {Array} dailyReturns - Array of daily return values
 * @returns {number} - Annualized volatility as a decimal
 */
function calculateVolatility(dailyReturns) {
  // Extract just the return values
  const returnValues = dailyReturns.map(r => r.return);
  
  // Calculate mean
  const mean = returnValues.reduce((sum, val) => sum + val, 0) / returnValues.length;
  
  // Calculate sum of squared differences
  const squaredDiffs = returnValues.map(r => Math.pow(r - mean, 2));
  const sumSquaredDiffs = squaredDiffs.reduce((sum, val) => sum + val, 0);
  
  // Calculate variance
  const variance = sumSquaredDiffs / (returnValues.length - 1);
  
  // Calculate daily standard deviation
  const dailyStdDev = Math.sqrt(variance);
  
  // Annualize (multiply by square root of trading days in a year)
  const annualizedVolatility = dailyStdDev * Math.sqrt(252);
  
  return annualizedVolatility;
}

/**
 * Calculates annualized return from daily returns
 * @param {Array} dailyReturns - Array of daily return values
 * @returns {number} - Annualized return as a decimal
 */
function calculateAnnualizedReturn(dailyReturns) {
  // Extract just the return values
  const returnValues = dailyReturns.map(r => r.return);
  
  // Calculate compound return
  const compoundReturn = returnValues.reduce((product, r) => product * (1 + r), 1);
  
  // Calculate average daily return
  const avgDailyReturn = Math.pow(compoundReturn, 1 / returnValues.length) - 1;
  
  // Annualize (compound over trading days in a year)
  const annualizedReturn = Math.pow(1 + avgDailyReturn, 252) - 1;
  
  return annualizedReturn;
}

/**
 * Gets default volatility for a stock based on its symbol
 * @param {string} symbol - Stock symbol
 * @returns {number} - Default volatility
 */
function getDefaultVolatility(symbol) {
  if (symbol === 'TSLA') return 0.55;
  if (symbol === 'NVDA') return 0.45;
  if (symbol === 'CPNG') return 0.50;
  if (symbol === 'SHOP') return 0.50;
  if (symbol === 'MELI') return 0.45;
  
  // Default for unknown stocks
  return 0.40;
}

/**
 * Gets default expected return for a stock based on its symbol
 * @param {string} symbol - Stock symbol
 * @returns {number} - Default expected return
 */
function getDefaultReturn(symbol) {
  if (symbol === 'TSLA') return 0.35;
  if (symbol === 'NVDA') return 0.40;
  if (symbol === 'CPNG') return 0.20;
  if (symbol === 'SHOP') return 0.25;
  if (symbol === 'MELI') return 0.30;
  
  // Default for unknown stocks
  return 0.15;
}

/**
 * Calculates volatility metrics from historical data
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Volatility metrics
 */
async function calculateVolatilityMetrics(symbol) {
  await ensureDataDirectory();
  
  const dataFile = path.join(DATA_DIR, `${symbol}.csv`);
  const status = await getDataStatus();
  const stockStatus = status.stocks[symbol] || {};
  
  // Check if we have data to calculate volatility
  if (!stockStatus.dataComplete) {
    console.log(`No complete data available for ${symbol}, using default values`);
    return {
      symbol,
      volatility: getDefaultVolatility(symbol),
      expectedReturn: getDefaultReturn(symbol),
      synthetic: true,
      reason: 'No complete data available'
    };
  }
  
  try {
    // Read the data file
    const csvData = await fs.readFile(dataFile, 'utf8');
    
    // Calculate daily returns
    const dailyReturns = calculateDailyReturnsFromCSV(csvData);
    
    // Check if we have enough data
    if (dailyReturns.length < 30) {
      console.log(`Not enough return data points for ${symbol}, using default values`);
      return {
        symbol,
        volatility: getDefaultVolatility(symbol),
        expectedReturn: getDefaultReturn(symbol),
        synthetic: true,
        reason: 'Not enough return data points'
      };
    }
    
    // Calculate volatility and return
    const volatility = calculateVolatility(dailyReturns);
    const expectedReturn = calculateAnnualizedReturn(dailyReturns);
    
    // Validate the results
    if (!isFinite(volatility) || volatility <= 0) {
      console.log(`Invalid volatility calculated for ${symbol}, using default value`);
      return {
        symbol,
        volatility: getDefaultVolatility(symbol),
        expectedReturn: isFinite(expectedReturn) ? expectedReturn : getDefaultReturn(symbol),
        synthetic: true,
        reason: 'Invalid volatility calculated'
      };
    }
    
    if (!isFinite(expectedReturn)) {
      console.log(`Invalid expected return calculated for ${symbol}, using default value`);
      return {
        symbol,
        volatility: volatility,
        expectedReturn: getDefaultReturn(symbol),
        synthetic: true,
        reason: 'Invalid expected return calculated'
      };
    }
    
    // Apply some reasonable constraints
    let adjustedReturn = expectedReturn;
    
    // Cap very high returns (likely data issues or outliers)
    if (adjustedReturn > 0.6) {
      adjustedReturn = 0.6;
    }
    
    // Floor very negative returns
    if (adjustedReturn < -0.2) {
      adjustedReturn = -0.2;
    }
    
    return {
      symbol,
      volatility,
      expectedReturn: adjustedReturn,
      originalExpectedReturn: expectedReturn,
      dataPoints: dailyReturns.length,
      synthetic: false
    };
  } catch (error) {
    console.error(`Error calculating volatility metrics for ${symbol}:`, error.message);
    
    return {
      symbol,
      volatility: getDefaultVolatility(symbol),
      expectedReturn: getDefaultReturn(symbol),
      synthetic: true,
      reason: error.message
    };
  }
}

/**
 * Calculates volatility metrics for all stocks with complete data
 * @returns {Promise<Object>} - Metrics for all stocks
 */
async function calculateAllVolatilityMetrics() {
  const metrics = {};
  
  try {
    // List all CSV files in the data directory
    const files = await fs.readdir(DATA_DIR);
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      console.log('No CSV files found in data directory');
      return { metrics: {} };
    }
    
    // Extract symbols from filenames
    const symbols = csvFiles.map(file => path.basename(file, '.csv'));
    
    console.log(`Found ${symbols.length} stocks with CSV data`);
    
    // Calculate metrics for each symbol
    for (const symbol of symbols) {
      console.log(`Calculating metrics for ${symbol}`);
      metrics[symbol] = await calculateVolatilityMetrics(symbol);
      
      // Save individual metrics file
      const metricsFile = path.join(DATA_DIR, `${symbol}_metrics.json`);
      await fs.writeFile(metricsFile, JSON.stringify(metrics[symbol], null, 2));
      
      // Update the data status
      await updateDataStatus(symbol, {
        volatility: metrics[symbol].volatility,
        expectedReturn: metrics[symbol].expectedReturn,
        lastMetricsUpdate: new Date().toISOString()
      });
    }
    
    // Save the metrics to the combined metrics file
    await saveVolatilityMetrics(metrics);
    
    return {
      success: true,
      message: `Calculated volatility metrics for ${symbols.length} stocks`,
      metrics
    };
  } catch (error) {
    console.error('Error calculating all volatility metrics:', error);
    return {
      success: false,
      message: `Error calculating volatility metrics: ${error.message}`,
      metrics
    };
  }
}

/**
 * Saves volatility metrics to file
 * @param {Object} metrics - Volatility metrics
 * @returns {Promise<void>}
 */
async function saveVolatilityMetrics(metrics) {
  await ensureDataDirectory();
  
  const metricData = {
    lastUpdated: new Date().toISOString(),
    metrics
  };
  
  await fs.writeFile(METRICS_FILE, JSON.stringify(metricData, null, 2));
}

/**
 * Gets saved volatility metrics
 * @returns {Promise<Object>} - Saved metrics
 */
async function getVolatilityMetrics() {
  await ensureDataDirectory();
  
  try {
    const metricsData = await fs.readFile(METRICS_FILE, 'utf8');
    return JSON.parse(metricsData);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // No metrics file yet
      return {
        lastUpdated: null,
        metrics: {}
      };
    }
    
    throw error;
  }
}

/**
 * Updates stock_settings.json with volatility metrics
 * @returns {Promise<Object>} - Updated settings
 */
async function updateSettingsWithVolatilityMetrics() {
  try {
    // Calculate all volatility metrics
    const calcResult = await calculateAllVolatilityMetrics();
    
    // Read current settings
    const settingsPath = path.join(__dirname, 'stock_settings.json');
    let settings;
    
    try {
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      settings = JSON.parse(settingsData);
    } catch (error) {
      // Create a new settings file if it doesn't exist
      settings = {
        riskFreeRate: 4.5,
        stocks: {}
      };
    }
    
    // Update settings with calculated metrics
    for (const symbol in calcResult.metrics) {
      const metrics = calcResult.metrics[symbol];
      
      if (metrics && metrics.volatility !== null) {
        // Convert to percentages for the settings file
        const volatility = Math.round(metrics.volatility * 100);
        
        // For expected returns, adjust historical returns to be more conservative
        const historicalReturn = metrics.expectedReturn;
        let expectedReturn;
        
        if (historicalReturn > 0.4) {
          // Cap very high returns
          expectedReturn = 40;
        } else if (historicalReturn < 0) {
          // Use a minimum positive return for stocks with negative history
          expectedReturn = 8;
        } else {
          // Round to nearest whole number
          expectedReturn = Math.round(historicalReturn * 100);
        }
        
        // Create the stock entry if it doesn't exist
        if (!settings.stocks[symbol]) {
          settings.stocks[symbol] = {};
        }
        
        // Update the values
        settings.stocks[symbol].volatility = volatility;
        settings.stocks[symbol].expectedReturn = expectedReturn;
        
        // Add whether data was synthetic or real
        const dataSource = metrics.synthetic ? "estimated" : "historical";
        console.log(`Updated ${symbol}: Volatility ${volatility}%, Expected Return ${expectedReturn}% (${dataSource} data)`);
      }
    }
    
    // Save updated settings
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    
    return {
      success: true,
      message: 'Settings updated with volatility metrics',
      settings,
      metrics: calcResult.metrics
    };
  } catch (error) {
    console.error('Error updating settings with volatility metrics:', error.message);
    
    return {
      success: false,
      message: `Error updating settings: ${error.message}`
    };
  }
}

module.exports = {
  getDataStatus,
  fetchHistoricalData,
  deleteHistoricalData,
  calculateVolatilityMetrics,
  calculateAllVolatilityMetrics,
  getVolatilityMetrics,
  updateSettingsWithVolatilityMetrics
};
