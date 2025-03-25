/**
 * Historical Stock Data Processing Module
 * 
 * This module provides functions to fetch and process historical stock data
 * for use in Kelly Criterion calculations.
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Directory for storing data
const DATA_DIR = path.join(__dirname, 'data');
const STATUS_FILE = path.join(DATA_DIR, 'data_status.json');
const METRICS_FILE = path.join(DATA_DIR, 'volatility_metrics.json');

/**
 * Makes an HTTPS request to fetch data with retry logic
 * @param {string} url - URL to fetch
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Delay between retries in milliseconds
 * @returns {Promise<string>} - Response body
 */
function httpsGet(url, maxRetries = 3, delay = 2000) {
  return new Promise((resolve, reject) => {
    const attemptRequest = (retriesLeft) => {
      console.log(`Fetching ${url}, retries left: ${retriesLeft}`);
      
      https.get(url, (response) => {
        let data = '';
        
        // Handle HTTP errors
        if (response.statusCode < 200 || response.statusCode >= 300) {
          // If we get rate limited (429) or server error (5xx), retry
          if ((response.statusCode === 429 || response.statusCode >= 500) && retriesLeft > 0) {
            console.log(`Received status code ${response.statusCode}, retrying in ${delay}ms...`);
            return setTimeout(() => attemptRequest(retriesLeft - 1), delay);
          }
          return reject(new Error(`HTTP Error: ${response.statusCode}`));
        }
        
        // Collect data
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        // Resolve promise when all data is received
        response.on('end', () => {
          resolve(data);
        });
        
      }).on('error', (error) => {
        // Retry on network errors
        if (retriesLeft > 0) {
          console.log(`Network error: ${error.message}, retrying in ${delay}ms...`);
          setTimeout(() => attemptRequest(retriesLeft - 1), delay);
        } else {
          reject(error);
        }
      });
    };
    
    // Start the first attempt
    attemptRequest(maxRetries);
  });
}

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
 * Analyzes the date coverage of existing data to find gaps
 * @param {string} csvData - Existing CSV data
 * @param {Date} targetStartDate - Desired start date
 * @param {Date} targetEndDate - Desired end date
 * @returns {Array} - Array of gap objects with start and end dates
 */
function findDataGaps(csvData, targetStartDate, targetEndDate) {
  // Parse CSV data
  const lines = csvData.trim().split('\n');
  
  // If there's no data (just header or empty), return one big gap
  if (lines.length <= 1) {
    return [{
      start: targetStartDate,
      end: targetEndDate
    }];
  }
  
  const headers = lines[0].split(',');
  const dateIndex = headers.indexOf('Date');
  
  if (dateIndex === -1) {
    throw new Error('Date column not found in data');
  }
  
  // Extract all dates in the CSV
  const dates = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const fields = line.split(',');
    if (fields.length <= dateIndex) continue; // Skip invalid lines
    
    const dateStr = fields[dateIndex];
    if (!dateStr) continue; // Skip if date is empty
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue; // Skip invalid dates
      
      dates.push({
        date,
        dateStr
      });
    } catch (e) {
      // Skip invalid dates
    }
  }
  
  // Sort dates chronologically
  dates.sort((a, b) => a.date - b.date);
  
  // If no valid dates were found, return one big gap
  if (dates.length === 0) {
    return [{
      start: targetStartDate,
      end: targetEndDate
    }];
  }
  
  // Find gaps between the dates
  const gaps = [];
  
  // Check if there's a gap at the beginning
  if (dates[0].date > targetStartDate) {
    gaps.push({
      start: targetStartDate,
      end: new Date(dates[0].date.getTime() - 86400000) // Day before first date
    });
  }
  
  // Check for gaps in the middle
  for (let i = 0; i < dates.length - 1; i++) {
    const currentDate = dates[i].date;
    const nextDate = dates[i+1].date;
    
    // Check if there's more than 1 day between consecutive dates
    const diffDays = Math.round((nextDate - currentDate) / 86400000);
    
    if (diffDays > 1) {
      const gapStart = new Date(currentDate.getTime() + 86400000); // Day after current date
      const gapEnd = new Date(nextDate.getTime() - 86400000); // Day before next date
      
      gaps.push({
        start: gapStart,
        end: gapEnd
      });
    }
  }
  
  // Check if there's a gap at the end
  if (dates[dates.length-1].date < targetEndDate) {
    gaps.push({
      start: new Date(dates[dates.length-1].date.getTime() + 86400000), // Day after last date
      end: targetEndDate
    });
  }
  
  return gaps;
}

/**
 * Merges new CSV data with existing CSV data
 * @param {string} existingData - Existing CSV data
 * @param {string} newData - New CSV data to merge
 * @returns {string} - Merged CSV data
 */
function mergeCSVData(existingData, newData) {
  // Split into lines
  const existingLines = existingData.trim().split('\n');
  const newLines = newData.trim().split('\n');
  
  // If either is empty, return the other
  if (existingLines.length <= 1) return newData;
  if (newLines.length <= 1) return existingData;
  
  // Get headers
  const existingHeader = existingLines[0];
  const newHeader = newLines[0];
  
  // Make sure headers match
  if (existingHeader !== newHeader) {
    console.warn('Warning: CSV headers do not match. Using existing header.');
  }
  
  // Prepare the date index mapping
  const existingFields = existingHeader.split(',');
  const newFields = newHeader.split(',');
  
  const existingDateIndex = existingFields.indexOf('Date');
  const newDateIndex = newFields.indexOf('Date');
  
  if (existingDateIndex === -1 || newDateIndex === -1) {
    throw new Error('Date column not found in one of the CSV files');
  }
  
  // Extract dates and data from both CSVs
  const dataMap = new Map();
  
  // Process existing data
  for (let i = 1; i < existingLines.length; i++) {
    const line = existingLines[i].trim();
    if (!line) continue;
    
    const fields = line.split(',');
    if (fields.length <= existingDateIndex) continue;
    
    const dateStr = fields[existingDateIndex];
    if (dateStr) {
      dataMap.set(dateStr, line);
    }
  }
  
  // Process new data
  for (let i = 1; i < newLines.length; i++) {
    const line = newLines[i].trim();
    if (!line) continue;
    
    const fields = line.split(',');
    if (fields.length <= newDateIndex) continue;
    
    const dateStr = fields[newDateIndex];
    if (dateStr) {
      dataMap.set(dateStr, line);
    }
  }
  
  // Sort the dates
  const sortedDates = Array.from(dataMap.keys()).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateA - dateB;
  });
  
  // Rebuild the CSV
  const result = [existingHeader];
  for (const date of sortedDates) {
    result.push(dataMap.get(date));
  }
  
  return result.join('\n');
}

/**
 * Fetches historical stock data from Yahoo Finance incrementally
 * @param {string} symbol - Stock symbol
 * @param {number} periodYears - Number of years of historical data to fetch
 * @param {boolean} forceRefresh - Whether to force refresh the data
 * @param {Object} options - Additional options
 * @param {Object} options.specificGap - Specific gap to fill
 * @param {number} options.chunkSize - Size of chunks to fetch in days (default: 365)
 * @param {number} options.minDataPoints - Minimum data points needed before calculating volatility (default: 300)
 * @returns {Promise<Object>} - Status of the fetch operation
 */
async function fetchHistoricalData(symbol, periodYears = 5, forceRefresh = false, options = {}) {
  await ensureDataDirectory();
  
  const dataFile = path.join(DATA_DIR, `${symbol}.csv`);
  const metricsFile = path.join(DATA_DIR, `${symbol}_metrics.json`);
  const status = await getDataStatus();
  const stockStatus = status.stocks[symbol] || {};
  
  // Configure options
  const chunkSize = options.chunkSize || 30; // Default to 1 month chunks (30 days)
  const minDataPoints = options.minDataPoints || 250; // Minimum data points needed (~1 year of trading days)
  
  // Calculate target date range
  let targetEndDate, targetStartDate;
  
  if (options.specificGap) {
    targetStartDate = new Date(options.specificGap.start);
    targetEndDate = new Date(options.specificGap.end);
  } else {
    targetEndDate = new Date();
    targetStartDate = new Date();
    // Default to 1 year of data regardless of periodYears parameter
    targetStartDate.setFullYear(targetStartDate.getFullYear() - 1);
  }
  
  let existingData = '';
  let dataGaps = [];
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
  
  if (!forceRefresh) {
    try {
      // Check if data file exists
      existingData = await fs.readFile(dataFile, 'utf8');
      
      // Find gaps in the data
      dataGaps = findDataGaps(existingData, targetStartDate, targetEndDate);
      
      // If no gaps and metrics are calculated, data is good to use
      if (dataGaps.length === 0 && metrics.volatility !== null) {
        console.log(`Using existing complete data for ${symbol}`);
        
        if (!stockStatus.dataComplete) {
          // Update status to mark as complete
          await updateDataStatus(symbol, {
            dataComplete: true,
            lastChecked: new Date().toISOString(),
            volatility: metrics.volatility,
            expectedReturn: metrics.expectedReturn
          });
        }
        
        return {
          success: true,
          message: `Using existing complete data for ${symbol}`,
          symbol,
          status: stockStatus,
          metrics
        };
      }
      
      if (dataGaps.length > 0) {
        console.log(`Found ${dataGaps.length} gaps in ${symbol} data, fetching missing data...`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Error reading existing data for ${symbol}:`, error.message);
      }
      
      // If file doesn't exist or other error, fetch all data
      dataGaps = [{
        start: targetStartDate,
        end: targetEndDate
      }];
    }
  } else {
    // Force refresh, fetch all data
    dataGaps = [{
      start: targetStartDate,
      end: targetEndDate
    }];
  }
  
  // Fetch data for each gap, breaking them into smaller chunks
  let newDataCount = 0;
  let mergedData = existingData;
  
  for (const gap of dataGaps) {
    try {
      // Break the gap into smaller chunks
      const chunkStartDate = new Date(gap.start);
      const gapEnd = new Date(gap.end);
      
      while (chunkStartDate < gapEnd) {
        // Calculate chunk end date (either chunkSize days later or the gap end, whichever is earlier)
        const chunkEndDate = new Date(chunkStartDate);
        chunkEndDate.setDate(chunkEndDate.getDate() + chunkSize);
        
        if (chunkEndDate > gapEnd) {
          chunkEndDate.setTime(gapEnd.getTime());
        }
        
        // Convert to timestamps
        const period1 = Math.floor(chunkStartDate.getTime() / 1000);
        const period2 = Math.floor(chunkEndDate.getTime() / 1000);
        
        // Skip chunks that are too small (less than 1 day)
        if (period2 - period1 < 86400) {
          chunkStartDate.setTime(chunkEndDate.getTime());
          continue;
        }
        
        console.log(`Fetching ${symbol} data chunk from ${chunkStartDate.toISOString().split('T')[0]} to ${chunkEndDate.toISOString().split('T')[0]}...`);
        
        // Yahoo Finance API URL
        const url = `https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
        
        // Fetch the data
        const response = await httpsGet(url);
        
        // Parse the data to count rows
        const lines = response.trim().split('\n');
        const newPoints = Math.max(0, lines.length - 1); // Subtract header
        
        if (newPoints > 0) {
          // Merge with existing data
          mergedData = mergeCSVData(mergedData, response);
          newDataCount += newPoints;
          
          // Save the merged data after each chunk
          await fs.writeFile(dataFile, mergedData);
          
          // Check if we have enough data points to calculate metrics
          const totalDataPoints = (mergedData.trim().split('\n').length - 1); // Subtract header
          
          if (totalDataPoints >= minDataPoints) {
            // Calculate volatility incrementally after we have enough data
            const newMetrics = await calculateIncrementalMetrics(symbol, mergedData, metrics);
            
            if (newMetrics) {
              metrics = newMetrics;
              // Save metrics
              await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2));
              
              // Update status with metrics
              await updateDataStatus(symbol, {
                volatility: metrics.volatility,
                expectedReturn: metrics.expectedReturn,
                lastMetricsUpdate: new Date().toISOString()
              });
              
              console.log(`Updated metrics for ${symbol}: Volatility ${(metrics.volatility * 100).toFixed(2)}%, Expected Return ${(metrics.expectedReturn * 100).toFixed(2)}%`);
            }
          } else {
            console.log(`Currently have ${totalDataPoints} data points for ${symbol}, need ${minDataPoints} to calculate metrics.`);
          }
        }
        
        // Move to next chunk
        chunkStartDate.setTime(chunkEndDate.getTime());
        
        // Wait a bit before next request to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error fetching gap data for ${symbol}:`, error.message);
      // Continue with next gap
    }
  }
  
  // Check for completeness
  // Find gaps in the updated data
  const remainingGaps = findDataGaps(mergedData, targetStartDate, targetEndDate);
  const isComplete = remainingGaps.length === 0;
  
  // Parse the merged data to get the full date range
  const lines = mergedData.trim().split('\n');
  const headers = lines[0].split(',');
  const dateIndex = headers.indexOf('Date');
  
  // Make sure we have data
  if (lines.length < 2 || dateIndex === -1) {
    throw new Error('Failed to parse merged data');
  }
  
  // Sort dates to ensure first and last are correct
  const datelines = lines.slice(1).filter(line => line.trim());
  datelines.sort((a, b) => {
    const dateA = new Date(a.split(',')[dateIndex]);
    const dateB = new Date(b.split(',')[dateIndex]);
    return dateA - dateB;
  });
  
  if (datelines.length === 0) {
    throw new Error('No valid data points after parsing');
  }
  
  const firstRow = datelines[0].split(',');
  const lastRow = datelines[datelines.length - 1].split(',');
  
  const startDateStr = firstRow[dateIndex];
  const endDateStr = lastRow[dateIndex];
  
  // Update status
  const newStatus = {
    dataPoints: lines.length - 1,
    startDate: startDateStr,
    endDate: endDateStr,
    dataComplete: isComplete,
    lastFetched: new Date().toISOString(),
    volatility: metrics ? metrics.volatility : null,
    expectedReturn: metrics ? metrics.expectedReturn : null,
    gaps: isComplete ? [] : remainingGaps.map(gap => ({
      start: gap.start.toISOString().split('T')[0],
      end: gap.end.toISOString().split('T')[0]
    }))
  };
  
  await updateDataStatus(symbol, newStatus);
  
  return {
    success: true,
    message: `Successfully fetched ${newDataCount} new data points for ${symbol}`,
    symbol,
    status: newStatus,
    metrics,
    newDataCount
  };
}

/**
 * Deletes historical data for a stock
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Status of the delete operation
 */
async function deleteHistoricalData(symbol) {
  await ensureDataDirectory();
  
  const dataFile = path.join(DATA_DIR, `${symbol}.csv`);
  const status = await getDataStatus();
  
  try {
    // Delete the data file
    await fs.unlink(dataFile);
    
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
  const status = await getDataStatus();
  const metrics = {};
  
  // Get all symbols with complete data
  const symbols = Object.keys(status.stocks).filter(symbol => 
    status.stocks[symbol].dataComplete);
  
  if (symbols.length === 0) {
    console.log('No stocks with complete data found');
    return {};
  }
  
  // Calculate metrics for each symbol
  for (const symbol of symbols) {
    metrics[symbol] = await calculateVolatilityMetrics(symbol);
  }
  
  // Save the metrics to file
  await saveVolatilityMetrics(metrics);
  
  return metrics;
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
 * Calculates metrics incrementally from new data
 * @param {string} symbol - Stock symbol
 * @param {string} csvData - CSV data to analyze
 * @param {Object} existingMetrics - Previous metrics (if any)
 * @returns {Promise<Object>} - Updated metrics
 */
async function calculateIncrementalMetrics(symbol, csvData, existingMetrics = null) {
  try {
    // Calculate daily returns from the entire dataset
    const dailyReturns = calculateDailyReturnsFromCSV(csvData);
    
    // Check if we have enough data
    if (dailyReturns.length < 30) {
      console.log(`Not enough return data points for ${symbol}, need at least 30`);
      return existingMetrics;
    }
    
    // Use only the most recent year of data (approximately 252 trading days)
    // This gives the most relevant metric for current market conditions
    const recentReturns = dailyReturns.length > 252 ? 
      dailyReturns.slice(-252) : dailyReturns;
    
    // Calculate volatility and return
    const volatility = calculateVolatility(recentReturns);
    const expectedReturn = calculateAnnualizedReturn(recentReturns);
    
    // Validate the results
    if (!isFinite(volatility) || volatility <= 0 || !isFinite(expectedReturn)) {
      console.log(`Invalid calculation results for ${symbol}, using previous or default values`);
      
      // Use existing metrics if available, otherwise defaults
      return {
        symbol,
        dataPoints: dailyReturns.length,
        lastCalculatedDate: new Date().toISOString(),
        volatility: existingMetrics?.volatility || getDefaultVolatility(symbol),
        expectedReturn: existingMetrics?.expectedReturn || getDefaultReturn(symbol),
        synthetic: true,
        reason: 'Invalid calculation results'
      };
    }
    
    // Apply reasonable constraints
    let adjustedReturn = expectedReturn;
    
    // Cap very high returns (likely data issues or outliers)
    if (adjustedReturn > 0.6) adjustedReturn = 0.6;
    
    // Floor very negative returns
    if (adjustedReturn < -0.2) adjustedReturn = -0.2;
    
    return {
      symbol,
      dataPoints: dailyReturns.length,
      lastCalculatedDate: new Date().toISOString(),
      volatility,
      expectedReturn: adjustedReturn,
      originalExpectedReturn: expectedReturn,
      synthetic: false
    };
  } catch (error) {
    console.error(`Error calculating metrics for ${symbol}:`, error.message);
    
    // Return existing metrics if available, otherwise null
    return existingMetrics;
  }
}

/**
 * Reads historical data from JSON file instead of CSV
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Historical data and summary
 */
async function readHistoricalDataFromJson(symbol) {
  await ensureDataDirectory();
  
  const jsonFile = path.join(DATA_DIR, `${symbol}.json`);
  const metricsFile = path.join(DATA_DIR, `${symbol}_metrics.json`);
  
  try {
    // Check if JSON file exists
    const stockData = JSON.parse(await fs.readFile(jsonFile, 'utf8'));
    
    // Try to load metrics if they exist
    let metrics = null;
    try {
      metrics = JSON.parse(await fs.readFile(metricsFile, 'utf8'));
    } catch (error) {
      // No metrics file, that's okay
    }
    
    // Summary of available data
    const summary = {
      symbol,
      dataPoints: stockData.prices.length,
      startDate: stockData.dates[0],
      endDate: stockData.dates[stockData.dates.length - 1],
      daysCovered: calculateDaysCovered(stockData.dates),
      metrics
    };
    
    return { 
      data: stockData,
      summary
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // JSON file doesn't exist, check if we need to convert from CSV
      const csvFile = path.join(DATA_DIR, `${symbol}.csv`);
      
      try {
        const csvData = await fs.readFile(csvFile, 'utf8');
        // Convert CSV to JSON
        const jsonData = convertCsvToJson(csvData);
        
        // Save as JSON for future use
        await fs.writeFile(jsonFile, JSON.stringify(jsonData, null, 2));
        
        // Return the converted data
        const summary = {
          symbol,
          dataPoints: jsonData.prices.length,
          startDate: jsonData.dates[0],
          endDate: jsonData.dates[jsonData.dates.length - 1],
          daysCovered: calculateDaysCovered(jsonData.dates),
          metrics: null
        };
        
        return { 
          data: jsonData,
          summary
        };
      } catch (csvError) {
        // Neither JSON nor CSV exists
        return {
          data: null,
          summary: {
            symbol,
            dataPoints: 0,
            startDate: null,
            endDate: null,
            daysCovered: 0,
            metrics: null
          }
        };
      }
    }
    
    throw error;
  }
}

/**
 * Convert CSV historical data to JSON format
 * @param {string} csvData - CSV data string
 * @returns {Object} - Structured JSON data
 */
function convertCsvToJson(csvData) {
  const lines = csvData.trim().split('\n');
  
  if (lines.length <= 1) {
    return {
      dates: [],
      prices: [],
      volumes: [],
      returns: []
    };
  }
  
  // Parse header
  const headers = lines[0].split(',');
  const dateIndex = headers.indexOf('Date');
  const priceIndex = headers.indexOf('Adj Close');  
  const volumeIndex = headers.indexOf('Volume');
  
  // Use Close if Adj Close is not available
  const actualPriceIndex = priceIndex === -1 ? headers.indexOf('Close') : priceIndex;
  
  if (dateIndex === -1 || actualPriceIndex === -1) {
    throw new Error('Required columns not found in CSV data');
  }
  
  const dates = [];
  const prices = [];
  const volumes = [];
  const returns = [];
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const fields = line.split(',');
    if (fields.length <= Math.max(dateIndex, actualPriceIndex)) continue;
    
    const dateStr = fields[dateIndex];
    const price = parseFloat(fields[actualPriceIndex]);
    
    if (!dateStr || isNaN(price)) continue;
    
    dates.push(dateStr);
    prices.push(price);
    
    // Parse volume if available
    if (volumeIndex !== -1 && fields.length > volumeIndex) {
      const volume = parseInt(fields[volumeIndex], 10);
      volumes.push(isNaN(volume) ? 0 : volume);
    } else {
      volumes.push(0);
    }
    
    // Calculate returns
    if (prices.length > 1) {
      const prevPrice = prices[prices.length - 2];
      const dailyReturn = price / prevPrice - 1;
      returns.push(dailyReturn);
    } else {
      returns.push(0);
    }
  }
  
  return {
    dates,
    prices,
    volumes,
    returns
  };
}

/**
 * Calculate how many days are covered by the dataset
 * @param {Array} dates - Array of date strings
 * @returns {number} - Number of days covered
 */
function calculateDaysCovered(dates) {
  if (!dates || dates.length < 2) return 0;
  
  const firstDate = new Date(dates[0]);
  const lastDate = new Date(dates[dates.length - 1]);
  
  return Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
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
    
    // Get all stock symbols from data directory
    const files = await fs.readdir(DATA_DIR);
    const metricFiles = files.filter(file => file.endsWith('_metrics.json'));
    const symbols = metricFiles.map(file => path.basename(file, '_metrics.json'));
    
    // If no metric files, look for CSV files
    if (symbols.length === 0) {
      const csvFiles = files.filter(file => file.endsWith('.csv'));
      const csvSymbols = csvFiles.map(file => path.basename(file, '.csv'));
      
      if (csvSymbols.length === 0) {
        return {
          success: false,
          message: 'No stock data files found'
        };
      }
      
      // For each CSV file, calculate metrics if there's enough data
      for (const symbol of csvSymbols) {
        try {
          const dataFile = path.join(DATA_DIR, `${symbol}.csv`);
          const metricsFile = path.join(DATA_DIR, `${symbol}_metrics.json`);
          const csvData = await fs.readFile(dataFile, 'utf8');
          
          // Calculate metrics
          const metrics = await calculateIncrementalMetrics(symbol, csvData, null);
          
          if (metrics) {
            // Save the metrics
            await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2));
            symbols.push(symbol);
          }
        } catch (error) {
          console.error(`Error calculating metrics for ${symbol}:`, error.message);
        }
      }
    }
    
    if (symbols.length === 0) {
      return {
        success: false,
        message: 'No metrics data available for any stocks'
      };
    }
    
    // Update settings for each symbol
    for (const symbol of symbols) {
      try {
        const metricsFile = path.join(DATA_DIR, `${symbol}_metrics.json`);
        const metricsData = await fs.readFile(metricsFile, 'utf8');
        const metrics = JSON.parse(metricsData);
        
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
      } catch (error) {
        console.error(`Error processing metrics for ${symbol}:`, error.message);
      }
    }
    
    // Save updated settings
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    
    return {
      success: true,
      message: 'Settings updated with volatility metrics',
      settings
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
