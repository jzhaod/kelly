/**
 * Simple HTTP server for Kelly Criterion visualization
 */

const express = require('express');
const app = express();
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { createDataProcessor } = require('./data_processor');

// Import utility functions for financial calculations
const {
  calculateVolatility,
  calculateExpectedReturnCAPM,
  calculateBeta,
  calculateDailyReturns,
  calculateCorrelationMatrix,
  calculateRiskReturnRatio,
  calculateSharpeRatio,
  analyzePortfolio
} = require('./utils');

const PORT = 3000;
const SETTINGS_FILE = path.join(__dirname, 'stock_settings.json');

// Data directory
const DATA_DIR = path.join(__dirname, 'data');

// Import required modules
const { 
  getDataStatus,
  fetchHistoricalData,
  deleteHistoricalData,
  calculateVolatilityMetrics,
  calculateAllVolatilityMetrics,
  getVolatilityMetrics,
  updateSettingsWithVolatilityMetrics
} = require('./historical_data');

// Import advanced Kelly criterion module
const {
  calculateAdvancedKelly,
  calculateSimplifiedKelly,
  calculateReturns,
  calculateVolatility: calcKellyVolatility,
  calculateCorrelationMatrix: kellyCorrelationMatrix,
  calculateExpectedReturns
} = require('./advanced_kelly');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Create HTTP server
const server = express();

// Handle data availability request
server.get('/data-availability', async (req, res) => {
  try {
    const symbol = req.query.symbol;
    if (!symbol) {
      console.error('No symbol provided in request');
      return res.status(400).json({ error: 'Symbol parameter is required' });
    }

    console.log(`Processing data availability request for symbol: ${symbol}`);
    let data = null;
    let metrics = null;
    let processor = null;

    try {
      // Try to read JSON data first
      const jsonPath = path.join(__dirname, 'data', `${symbol}.json`);
      console.log(`Attempting to read JSON data from: ${jsonPath}`);
      const jsonData = await fs.readFile(jsonPath, 'utf8');
      data = JSON.parse(jsonData);
      processor = createDataProcessor('json');
      processor.symbol = symbol;
      console.log('Successfully loaded JSON data');
    } catch (jsonError) {
      console.log('JSON data not found, falling back to CSV:', jsonError.message);
      try {
        // Fall back to CSV data
        const csvPath = path.join(__dirname, 'data', `${symbol}.csv`);
        console.log(`Attempting to read CSV data from: ${csvPath}`);
        const csvContent = await fs.readFile(csvPath, 'utf8');
        processor = createDataProcessor('csv');
        processor.symbol = symbol;
        data = csvContent;
        console.log('Successfully loaded CSV data');
      } catch (csvError) {
        console.error('Failed to read CSV data:', csvError.message);
        return res.status(404).json({ error: 'Stock data not found' });
      }
    }

    try {
      // Try to read metrics data if available
      const metricsPath = path.join(__dirname, 'data', `${symbol}_metrics.json`);
      console.log(`Attempting to read metrics data from: ${metricsPath}`);
      const metricsData = await fs.readFile(metricsPath, 'utf8');
      metrics = JSON.parse(metricsData);
      console.log('Successfully loaded metrics data');
    } catch (metricsError) {
      console.log('Metrics data not found:', metricsError.message);
    }

    try {
      console.log('Processing data with processor');
      const processedData = await processor.processData(data);
      if (metrics) {
        processedData.metrics = metrics;
      }
      console.log('Successfully processed data:', {
        dataPoints: processedData.dataPoints,
        startDate: processedData.startDate,
        endDate: processedData.endDate,
        daysCovered: processedData.daysCovered
      });
      res.json(processedData);
    } catch (processError) {
      console.error('Error processing data:', processError);
      console.error('Error stack:', processError.stack);
      res.status(500).json({ error: 'Failed to process stock data' });
    }
  } catch (error) {
    console.error('Unexpected error in data-availability endpoint:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle save settings endpoint
server.post('/save-settings', (req, res) => {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      console.log('Saving settings...');
      
      // Parse the JSON data
      const settingsData = JSON.parse(body);
      
      // Create a timestamp for the backup
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
      const backupFileName = `stock_settings_backup_${timestamp}.json`;
      const backupPath = path.join(__dirname, 'backup', backupFileName);
      
      // Create a temporary new settings file with a unique name
      const tempSettingsFile = path.join(__dirname, `stock_settings_new_${timestamp}.json`);
      
      try {
        // Step 1: Check if there's an existing settings file to back up
        try {
          const currentSettings = await fsPromises.readFile(SETTINGS_FILE, 'utf8');
          // Step 2: Save backup of existing settings if found
          await fsPromises.writeFile(backupPath, currentSettings);
          console.log(`Created backup at ${backupPath}`);
        } catch (backupErr) {
          // No existing file to back up, that's okay
          console.log('No existing settings file to back up');
        }
        
        // Step 3: Write new settings to a temporary file first
        await fsPromises.writeFile(tempSettingsFile, JSON.stringify(settingsData, null, 2));
        console.log(`Created temporary settings at ${tempSettingsFile}`);
        
        // Step 4: Rename the temporary file to the real settings file
        // This is more atomic than directly writing to the destination
        try {
          await fsPromises.rename(tempSettingsFile, SETTINGS_FILE);
          console.log(`Renamed temporary settings to ${SETTINGS_FILE}`);
        } catch (renameErr) {
          // If rename fails (e.g., across devices), try copying instead
          console.log('Rename failed, falling back to copy operation');
          const tempContent = await fsPromises.readFile(tempSettingsFile, 'utf8');
          await fsPromises.writeFile(SETTINGS_FILE, tempContent);
          
          // Clean up temp file
          try {
            await fsPromises.unlink(tempSettingsFile);
          } catch (unlinkErr) {
            console.log('Failed to delete temporary file:', unlinkErr.message);
          }
        }
        
        // Successfully saved
        res.status(200).json({ 
          success: true, 
          message: 'Settings saved successfully',
          backup: backupPath
        });
      } catch (fsError) {
        console.error('File system error during settings save:', fsError);
        res.status(500).json({ error: 'Failed to save settings', details: fsError.message });
      }
    } catch (parseError) {
      console.error('Error parsing settings data:', parseError);
      res.status(400).json({ error: 'Invalid settings data', details: parseError.message });
    }
  });
});

// Handle load settings endpoint
server.get('/load-settings', async (req, res) => {
  try {
    // Use fs promises to read file
    const data = await fsPromises.readFile(SETTINGS_FILE, 'utf8');
    
    try {
      // Parse the JSON data
      const settingsData = JSON.parse(data);
      res.status(200).json(settingsData);
    } catch (parseError) {
      console.error('Error parsing settings file:', parseError);
      res.status(500).json({ error: 'Invalid settings file format' });
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Settings file doesn't exist yet
      res.status(404).json({ error: 'No saved settings found' });
    } else {
      console.error('Error reading settings:', err);
      res.status(500).json({ error: 'Failed to load settings' });
    }
  }
});

// Handle data status endpoint
server.get('/data-status', async (req, res) => {
  // Read directly from the data directory instead of using the status file
  const dataDir = path.join(__dirname, 'data');
  
  // Ensure the data directory exists
  try {
    await fsPromises.mkdir(dataDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.error('Error creating data directory:', err);
      res.status(500).json({ error: 'Failed to ensure data directory exists' });
      return;
    }
  }
  
  // Read all files in the data directory
  const files = await fsPromises.readdir(dataDir);
  
  // Filter for JSON and CSV files
  const dataFiles = files.filter(file => file.endsWith('.json') || file.endsWith('.csv'));
  
  // Group files by stock symbol
  const stockFiles = {};
  for (const file of dataFiles) {
    const symbol = path.basename(file, path.extname(file)).replace('_metrics', '');
    if (!stockFiles[symbol]) {
      stockFiles[symbol] = [];
    }
    stockFiles[symbol].push(file);
  }
  
  // Build status object
  const status = {
    lastUpdated: new Date().toISOString(),
    stocks: {}
  };
  
  // Process each stock
  for (const symbol of Object.keys(stockFiles)) {
    // Skip metadata files
    if (symbol === 'data_status' || symbol === 'volatility_metrics') {
      continue;
    }
    
    try {
      // Check for CSV or JSON data file
      const dataFile = stockFiles[symbol].find(file => 
        file === `${symbol}.csv` || file === `${symbol}.json`);
      
      if (!dataFile) {
        continue; // Skip if no data file found
      }
      
      // Get file stats
      const filePath = path.join(dataDir, dataFile);
      const fileStats = await fsPromises.stat(filePath);
      
      // Read data to get details
      let dataPoints = 0;
      let startDate = null;
      let endDate = null;
      let dataComplete = false;
      
      if (dataFile.endsWith('.json') || dataFile.endsWith('.csv')) {
        // Read data file
        const fileData = await fsPromises.readFile(filePath, 'utf8');
        const fileType = dataFile.endsWith('.json') ? 'json' : 'csv';
        
        // Parse the stock data using our common function
        const parsedInfo = parseStockData(fileData, fileType);
        
        dataPoints = parsedInfo.dataPoints;
        startDate = parsedInfo.startDate;
        endDate = parsedInfo.endDate;
        daysCovered = parsedInfo.daysCovered;
        
        console.log(`Processed ${symbol}: ${dataPoints} points, ${daysCovered} days covered`);
        
        // Check data freshness
        if (endDate) {
          const lastDate = new Date(endDate);
          const now = new Date();
          const daysDiff = Math.ceil((now - lastDate) / (1000 * 60 * 60 * 24));
          
          // Consider data complete if it's within the last 7 days
          dataComplete = daysDiff <= 7;
        } else {
          // Use file modification time instead
          const lastModified = new Date(fileStats.mtime);
          const now = new Date();
          const daysDiff = Math.ceil((now - lastModified) / (1000 * 60 * 60 * 24));
          
          // Consider data complete if file was modified recently
          dataComplete = daysDiff <= 7;
        }
      } else {
        // No data file
        console.log(`No supported data file found for ${symbol}`);
      }
      
      // Check for metrics file
      const metricsFile = stockFiles[symbol].find(file => file === `${symbol}_metrics.json`);
      let volatility = null;
      let expectedReturn = null;
      
      if (metricsFile) {
        const metricsPath = path.join(dataDir, metricsFile);
        const metricsData = await fsPromises.readFile(metricsPath, 'utf8');
        const metrics = JSON.parse(metricsData);
        
        volatility = metrics.volatility;
        expectedReturn = metrics.expectedReturn;
      }
      
      // Create status entry with all the information
      status.stocks[symbol] = {
        dataPoints,
        startDate,
        endDate,
        dataComplete,
        lastUpdated: new Date(fileStats.mtime).toISOString(),
        volatility,
        expectedReturn,
        daysCovered,
        gaps: [] // We'll calculate gaps if needed later
      };
      
      console.log(`Added status for ${symbol}: ${dataPoints} points, ${daysCovered} days`);
    } catch (error) {
      console.error(`Error processing ${symbol}:`, error);
      // Skip this stock on error
    }
  }
  
  res.status(200).json(status);
});

// Handle fetch historical data endpoint
server.post('/fetch-historical-data', async (req, res) => {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      // Parse the JSON data
      const requestData = JSON.parse(body);
      const { symbol, years = 5, forceRefresh = false } = requestData;
      
      if (!symbol) {
        res.status(400).json({ error: 'Symbol is required' });
        return;
      }
      
      // Fetch historical data
      const result = await fetchHistoricalData(symbol, years, forceRefresh);
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching historical data:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch historical data',
        message: error.message
      });
    }
  });
});

// Handle delete historical data endpoint
server.post('/delete-historical-data', async (req, res) => {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      // Parse the JSON data
      const requestData = JSON.parse(body);
      const { symbol } = requestData;
      
      if (!symbol) {
        res.status(400).json({ error: 'Symbol is required' });
        return;
      }
      
      // Delete historical data
      const result = await deleteHistoricalData(symbol);
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error deleting historical data:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to delete historical data',
        message: error.message
      });
    }
  });
});

// Handle fill data gaps endpoint
server.post('/fill-data-gaps', async (req, res) => {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      // Parse the JSON data
      const requestData = JSON.parse(body);
      const { symbol, gaps } = requestData;
      
      if (!symbol || !gaps || !Array.isArray(gaps) || gaps.length === 0) {
        res.status(400).json({ error: 'Symbol and gaps are required' });
        return;
      }
      
      // Process each gap
      let fetchPromises = [];
      for (const gap of gaps) {
        // Create a date range for the gap
        const startDate = new Date(gap.start);
        const endDate = new Date(gap.end);
        
        // Use 1-month chunk size for improved incremental loading
        // Custom fetch for this specific gap
        fetchPromises.push(
          fetchHistoricalData(symbol, 1, false, {
            specificGap: {
              start: startDate,
              end: endDate
            },
            chunkSize: 30, // 1 month chunks
            minDataPoints: 250 // ~1 year of trading days
          })
        );
      }
      
      // Wait for all fetches to complete
      const results = await Promise.all(fetchPromises);
      
      // Combine results
      const successCount = results.filter(r => r.success).length;
      const newDataPoints = results.reduce((sum, r) => sum + (r.newDataCount || 0), 0);
      
      if (successCount === gaps.length) {
        res.status(200).json({
          success: true,
          message: `Successfully filled ${successCount} gaps with ${newDataPoints} new data points.`,
          results
        });
      } else {
        res.status(200).json({
          success: true,
          message: `Partially filled gaps. Filled ${successCount} out of ${gaps.length} gaps with ${newDataPoints} new data points.`,
          results
        });
      }
    } catch (error) {
      console.error('Error filling data gaps:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fill data gaps',
        message: error.message
      });
    }
  });
});

// Handle calculate volatility endpoint
server.post('/calculate-volatility', async (req, res) => {
  try {
    const result = await calculateAllVolatilityMetricsCustom();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error calculating volatility:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to calculate volatility',
      message: error.message
    });
  }
});

// Handle volatility metrics endpoint
server.get('/volatility-metrics', async (req, res) => {
  try {
    const metrics = await getVolatilityMetrics();
    res.status(200).json(metrics);
  } catch (error) {
    console.error('Error getting volatility metrics:', error);
    res.status(500).json({ error: 'Failed to get volatility metrics' });
  }
});

// Handle all portfolio calculations in a single endpoint
server.post('/calculate-all-portfolio-values', async (req, res) => {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      // Parse the JSON data
      const requestData = JSON.parse(body);
      const { symbols } = requestData;
      
      if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        res.status(400).json({ error: 'Symbols array is required' });
        return;
      }
      
      console.log(`Starting comprehensive portfolio calculation for ${symbols.length} symbols: ${symbols.join(', ')}`);
      
      try {
        // Step 1: Load historical data for all symbols
        const dataDir = path.join(__dirname, 'data');
        console.log('Loading historical data from', dataDir);
        
        // This will contain the processed historical data
        const historicalData = {};
        const metricsData = {};
        
        // Process each symbol
        for (const symbol of symbols) {
          try {
            // We'll calculate everything fresh, ignoring any existing metrics
            console.log(`Processing data for ${symbol} to calculate fresh metrics`);
            
            // Clear any previously stored metrics data for this symbol
            if (metricsData[symbol]) {
              delete metricsData[symbol];
            }
            
            // Try to load from CSV first
            const csvPath = path.join(dataDir, `${symbol}.csv`);
            try {
              const csvData = await fsPromises.readFile(csvPath, 'utf8');
              const lines = csvData.trim().split('\n');
              if (lines.length > 1) {
                const headers = lines[0].split(',');
                const dateIndex = headers.findIndex(h => h === 'Date');
                const closeIndex = headers.findIndex(h => h.includes('Close'));
                
                if (dateIndex !== -1 && closeIndex !== -1) {
                  historicalData[symbol] = {
                    prices: [],
                    dates: []
                  };
                  
                  // Process each line
                  for (let i = 1; i < lines.length; i++) {
                    const fields = lines[i].split(',');
                    if (fields.length > Math.max(dateIndex, closeIndex)) {
                      const price = parseFloat(fields[closeIndex]);
                      if (!isNaN(price)) {
                        historicalData[symbol].prices.push(price);
                        historicalData[symbol].dates.push(fields[dateIndex]);
                      }
                    }
                  }
                  
                  console.log(`Loaded ${historicalData[symbol].prices.length} data points for ${symbol} from CSV`);
                } else {
                  console.log(`CSV headers not found for ${symbol}`);
                }
              } else {
                console.log(`Not enough data in CSV for ${symbol}`);
              }
            } catch (csvError) {
              console.log(`Could not load CSV data for ${symbol}, trying JSON...`);
              
              // Try JSON next
              try {
                const jsonPath = path.join(dataDir, `${symbol}.json`);
                const jsonData = await fsPromises.readFile(jsonPath, 'utf8');
                const jsonObj = JSON.parse(jsonData);
                
                // Handle different JSON formats
                if (Array.isArray(jsonObj)) {
                  // Array of price objects
                  historicalData[symbol] = {
                    prices: [],
                    dates: []
                  };
                  
                  // Sort by date if needed
                  if (jsonObj[0] && jsonObj[0].Date) {
                    jsonObj.sort((a, b) => new Date(a.Date) - new Date(b.Date));
                  }
                  
                  // Process data
                  for (const item of jsonObj) {
                    const price = item['Adj Close'] || item.Close;
                    if (price !== undefined && item.Date) {
                      historicalData[symbol].prices.push(parseFloat(price));
                      historicalData[symbol].dates.push(item.Date);
                    }
                  }
                } else if (jsonObj.prices && Array.isArray(jsonObj.prices)) {
                  // Object with price array
                  historicalData[symbol] = {
                    prices: jsonObj.prices,
                    dates: jsonObj.dates || []
                  };
                }
                
                console.log(`Loaded ${historicalData[symbol].prices.length} data points for ${symbol} from JSON`);
              } catch (jsonError) {
                console.error(`Could not load data for ${symbol}:`, jsonError.message);
              }
            }
          } catch (error) {
            console.error(`Error processing ${symbol}:`, error.message);
          }
        }
        
        // Check if we have any data
        const symbolsWithData = Object.keys(historicalData);
        if (symbolsWithData.length === 0) {
          res.status(400).json({ 
            error: 'No historical data found for any of the provided symbols', 
            message: 'Make sure you have data files in the /data directory'
          });
          return;
        }
        
        console.log(`Successfully loaded data for ${symbolsWithData.length} symbols`);
        
        // Step 2: Process the historical data to ensure chronological order
        const processedData = {};
        
        for (const symbol of symbolsWithData) {
          const prices = historicalData[symbol].prices;
          const dates = historicalData[symbol].dates || [];
          
          // Make sure data is in chronological order (oldest to newest)
          let pricesToUse = [...prices]; // Copy to avoid modifying original data
          let datesToUse = [...dates];
          
          // Check if dates are available and if we need to sort the data
          if (dates.length === prices.length && dates.length > 1) {
            // Detect if data is in reverse chronological order (newest first)
            const firstDate = new Date(dates[0]);
            const lastDate = new Date(dates[dates.length - 1]);
            
            if (firstDate > lastDate) {
              console.log(`Data for ${symbol} appears to be in reverse chronological order, sorting...`);
              
              // Create paired arrays and sort by date
              let combined = [];
              for (let i = 0; i < prices.length; i++) {
                combined.push({ price: prices[i], date: new Date(dates[i]) });
              }
              
              // Sort by date (oldest first)
              combined.sort((a, b) => a.date - b.date);
              
              // Extract sorted arrays
              pricesToUse = combined.map(item => item.price);
              datesToUse = combined.map(item => item.date.toISOString().split('T')[0]);
            }
          }
          
          processedData[symbol] = {
            prices: pricesToUse,
            dates: datesToUse
          };
          
          console.log(`Processed ${pricesToUse.length} price points for ${symbol}`);
        }
        
        // Step 3: Use the analyzePortfolio utility to calculate everything in one go
        console.log('Analyzing portfolio data...');
        
        // Get settings to use current risk-free rate
        const { loadStockSettings } = require('./kelly_criterion');
        const stockSettings = loadStockSettings();
        
        // Get risk-free rate from settings or use default
        const riskFreeRate = stockSettings && stockSettings.riskFreeRate ? 
            stockSettings.riskFreeRate / 100 : 0.045;
          
        // Use standard market return assumption
        const marketReturn = 0.10; // 10% long-term average
          
        // Analyze the portfolio - this calculates returns, volatility, beta, and correlation
        const portfolioAnalysis = analyzePortfolio(processedData, riskFreeRate, marketReturn);
          
        console.log(`Analysis complete for ${portfolioAnalysis.symbols.length} symbols`);
          
        // Extract results
        const { volatility, expectedReturns, beta, correlationMatrix } = portfolioAnalysis;
        const validSymbols = portfolioAnalysis.symbols;
          
        // Save metrics to file for future use
        for (const symbol of validSymbols) {
          try {
            // Create metrics object
            const metrics = {
              symbol,
              volatility: volatility[symbol],
              expectedReturn: expectedReturns[symbol],
              beta: beta[symbol],
              dataPoints: processedData[symbol].prices.length,
              lastCalculatedDate: new Date().toISOString()
            };
              
            // Log for debugging
            console.log(`Metrics for ${symbol}:`);
            console.log(`- Volatility: ${(volatility[symbol] * 100).toFixed(2)}%`);
            console.log(`- Expected Return: ${(expectedReturns[symbol] * 100).toFixed(2)}%`);
            console.log(`- Beta: ${beta[symbol].toFixed(2)}`);
              
            // Save to file
            const metricsPath = path.join(dataDir, `${symbol}_metrics.json`);
            await fsPromises.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
            console.log(`Saved metrics for ${symbol}`);
          } catch (saveError) {
            console.error(`Error saving metrics for ${symbol}:`, saveError.message);
          }
        }
        
        // Step 4: Create settings object to return
        const settingsData = {
          riskFreeRate: riskFreeRate * 100, // Convert back to percentage
          symbols: validSymbols,
          correlationMatrix,
          stocks: {}
        };
        
        // Convert metrics to settings format (expected format for client)
        for (const symbol of validSymbols) {
          settingsData.stocks[symbol] = {
            expectedReturn: Math.round(expectedReturns[symbol] * 100), // Convert to percentage
            volatility: Math.round(volatility[symbol] * 100), // Convert to percentage
            beta: Number(beta[symbol].toFixed(2)) // Add beta information
          };
        }
        
        // Step 5: Save comprehensive settings to stock_settings.json
        try {
          const settingsPath = path.join(__dirname, 'stock_settings.json');
          
          // Try to read existing settings to preserve any other fields
          try {
            const existingSettings = await fsPromises.readFile(settingsPath, 'utf8');
            const parsedSettings = JSON.parse(existingSettings);
            
            // Preserve risk-free rate from existing settings
            if (parsedSettings && parsedSettings.riskFreeRate) {
              settingsData.riskFreeRate = parsedSettings.riskFreeRate;
            }
            
            // Merge any existing stocks that aren't in our current calculation
            if (parsedSettings && parsedSettings.stocks) {
              for (const symbol in parsedSettings.stocks) {
                if (!settingsData.stocks[symbol]) {
                  settingsData.stocks[symbol] = parsedSettings.stocks[symbol];
                }
              }
            }
          } catch (readError) {
            console.log('No existing settings file, creating new one');
          }
          
          // Write updated settings
          await fsPromises.writeFile(settingsPath, JSON.stringify(settingsData, null, 2));
          console.log('Successfully saved comprehensive settings to stock_settings.json');
        } catch (saveError) {
          console.error('Error saving settings:', saveError);
        }
        
        // Extract risk/return metrics for the response
        const riskReturnMetrics = portfolioAnalysis.riskReturnMetrics || {};
        
        // Return results in a consistent format
        res.status(200).json({
          success: true,
          message: `Successfully calculated portfolio values for ${validSymbols.length} stocks`,
          symbols: validSymbols,
          // Return both raw values (0-1 range) and percentage values (0-100 range)
          volatility,
          expectedReturns,
          beta,
          percentageVolatility: Object.fromEntries(validSymbols.map(s => [s, Math.round(volatility[s] * 100)])),
          percentageExpectedReturns: Object.fromEntries(validSymbols.map(s => [s, Math.round(expectedReturns[s] * 100)])),
          correlationMatrix,
          riskReturnMetrics,
          settingsData
        });
        
      } catch (calculationError) {
        console.error('Error calculating portfolio values:', calculationError);
        res.status(500).json({ 
          error: 'Failed to calculate portfolio values', 
          message: calculationError.message,
          stack: calculationError.stack
        });
      }
    } catch (error) {
      console.error('Error parsing request:', error);
      res.status(400).json({ error: 'Invalid request data' });
    }
  });
});

// Handle advanced Kelly calculation endpoint
server.post('/calculate-kelly', async (req, res) => {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      // Parse the JSON data
      const requestData = JSON.parse(body);
      const { 
        symbols, 
        portfolioSize = 1000, 
        returnAdjustments = {}
      } = requestData;
      
      if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        res.status(400).json({ error: 'Symbols array is required' });
        return;
      }
      
      try {
        // Use the kelly_criterion module's loadStockSettings function to get settings
        const { loadStockSettings } = require('./kelly_criterion');
        const settings = loadStockSettings();
        
        if (!settings || !settings.stocks) {
          res.status(400).json({ 
            error: 'Invalid stock settings', 
            message: 'The stock_settings.json file does not contain valid data'
          });
          return;
        }
        
        // Get risk-free rate from settings
        const effectiveRiskFreeRate = settings.riskFreeRate / 100; // Convert from % to decimal
        
        // Prepare expected returns and volatility from settings
        const expectedReturns = {};
        const volatility = {};
        
        for (const symbol of symbols) {
          if (!settings.stocks[symbol]) {
            console.warn(`Symbol ${symbol} not found in stock settings, using defaults`);
            expectedReturns[symbol] = getDefaultReturn(symbol);
            volatility[symbol] = getDefaultVolatility(symbol);
            continue;
          }
          
          // Convert from percentage to decimal
          expectedReturns[symbol] = settings.stocks[symbol].expectedReturn / 100;
          volatility[symbol] = settings.stocks[symbol].volatility / 100;
          
          // Apply adjustments if specified
          if (returnAdjustments[symbol]) {
            expectedReturns[symbol] += returnAdjustments[symbol];
          }
        }
        
        // Get ordered symbols from settings if available
        const orderedSymbols = settings.symbols || symbols;
        
        // Get correlation matrix from settings or create default
        let correlationMatrix;
        
        if (settings.correlationMatrix) {
          correlationMatrix = settings.correlationMatrix;
          console.log('Using correlation matrix from settings');
        } else {
          // Create a default correlation matrix
          console.log('Creating default correlation matrix');
          correlationMatrix = [];
          for (let i = 0; i < symbols.length; i++) {
            correlationMatrix[i] = [];
            for (let j = 0; j < symbols.length; j++) {
              if (i === j) {
                correlationMatrix[i][j] = 1; // Self-correlation is 1
              } else {
                correlationMatrix[i][j] = 0.5; // Default correlation between stocks
              }
            }
          }
        }
        
        // Filter to ensure we only use symbols that have data for all metrics
        const completeSymbols = symbols.filter(symbol => 
          expectedReturns[symbol] !== undefined && 
          volatility[symbol] !== undefined &&
          Number.isFinite(expectedReturns[symbol]) &&
          Number.isFinite(volatility[symbol])
        );
        
        // Check if we have enough data to calculate
        if (completeSymbols.length === 0) {
          res.status(400).json({
            success: false,
            error: 'No valid data available for calculation',
            message: 'Could not find complete data for any of the requested symbols'
          });
          return;
        }
        
        // Map order of correlation matrix to requested symbols
        const adjustedMatrix = [];
        const adjustedSymbols = completeSymbols;
        
        // Prepare correlation matrix based on ordered symbols from settings
        if (settings.correlationMatrix && settings.symbols) {
          // Check if all requested symbols are in settings
          const allSymbolsInSettings = completeSymbols.every(symbol => 
            settings.symbols.includes(symbol)
          );
          
          if (allSymbolsInSettings) {
            // Reorder correlation matrix to match requested symbols
            for (let i = 0; i < completeSymbols.length; i++) {
              adjustedMatrix[i] = [];
              const symbolIndexI = settings.symbols.indexOf(completeSymbols[i]);
              
              for (let j = 0; j < completeSymbols.length; j++) {
                const symbolIndexJ = settings.symbols.indexOf(completeSymbols[j]);
                adjustedMatrix[i][j] = settings.correlationMatrix[symbolIndexI][symbolIndexJ];
              }
            }
          } else {
            // Fall back to default matrix if some symbols are missing
            for (let i = 0; i < completeSymbols.length; i++) {
              adjustedMatrix[i] = [];
              for (let j = 0; j < completeSymbols.length; j++) {
                if (i === j) {
                  adjustedMatrix[i][j] = 1; // Self-correlation is 1
                } else {
                  adjustedMatrix[i][j] = 0.5; // Default correlation
                }
              }
            }
          }
        } else {
          // Use default matrix if no correlation data in settings
          for (let i = 0; i < completeSymbols.length; i++) {
            adjustedMatrix[i] = [];
            for (let j = 0; j < completeSymbols.length; j++) {
              if (i === j) {
                adjustedMatrix[i][j] = 1; // Self-correlation is 1
              } else {
                adjustedMatrix[i][j] = 0.5; // Default correlation
              }
            }
          }
        }
        
        // Print inputs for debugging
        console.log('Symbols with complete data:', completeSymbols);
        console.log('Expected Returns:', expectedReturns);
        console.log('Volatility:', volatility);
        
        // Calculate Kelly allocations with only the symbols that have complete data
        // Use advanced Kelly calculation with precomputed values
        const kellyAllocations = calculateAdvancedKelly(
          completeSymbols,
          expectedReturns,
          volatility,
          adjustedMatrix,
          effectiveRiskFreeRate
        );
        
        console.log('Kelly Allocations result:', kellyAllocations);
        
        // Return the results with all Kelly fractions
        res.status(200).json({
          success: true,
          kellyAllocations,
          ninetyPercentKelly: kellyAllocations.ninetyPercentKelly || {},
          halfKelly: kellyAllocations.halfKelly || {},
          quarterKelly: kellyAllocations.quarterKelly || {},
          expectedReturns,
          volatility,
          correlationMatrix: adjustedMatrix
        });
      } catch (calculationError) {
        console.error('Error calculating Kelly allocations:', calculationError);
        res.status(500).json({ 
          error: 'Failed to calculate Kelly allocations', 
          message: calculationError.message
        });
      }
    } catch (error) {
      console.error('Error parsing request:', error);
      res.status(400).json({ error: 'Invalid request data' });
    }
  });
});

// Handle list-stocks endpoint
server.get('/list-stocks', (req, res) => {
  const dataDir = path.join(__dirname, 'data');
  
  // Read all files in the data directory
  fs.readdir(dataDir, (err, files) => {
    if (err) {
      console.error('Error reading data directory:', err);
      res.status(500).json({ error: 'Failed to read data directory' });
      return;
    }
    
    // Filter for JSON and CSV files
    const dataFiles = files.filter(file => file.endsWith('.json') || file.endsWith('.csv'));
    
    // Extract stock symbols
    const stockSymbols = dataFiles
      .map(file => path.basename(file, path.extname(file)))
      .filter(symbol => 
        symbol !== 'data_status' && 
        symbol !== 'volatility_metrics' && 
        !symbol.endsWith('_metrics'));
    
    // Remove duplicates
    const uniqueSymbols = [...new Set(stockSymbols)];
    
    // Return the list
    res.status(200).json({ stocks: uniqueSymbols });
  });
});

// Handle save-simulation endpoint
server.post('/save-simulation', (req, res) => {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      // Parse the JSON data
      const simulationData = JSON.parse(body);
      const { prefix = 'kelly' } = simulationData;
      
      // Create a timestamp for the filename
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
      const filename = `${prefix}_${timestamp}.json`;
      
      // Ensure the simulations directory exists
      const simulationsDir = path.join(__dirname, 'simulations');
      try {
        await fsPromises.mkdir(simulationsDir, { recursive: true });
      } catch (err) {
        if (err.code !== 'EEXIST') {
          throw err;
        }
      }
      
      // Save the simulation data
      const filePath = path.join(simulationsDir, filename);
      await fsPromises.writeFile(filePath, JSON.stringify(simulationData, null, 2));
      
      res.status(200).json({ 
        success: true, 
        message: 'Simulation saved successfully',
        filename,
        filePath
      });
    } catch (error) {
      console.error('Error saving simulation:', error);
      res.status(500).json({ error: 'Failed to save simulation', details: error.message });
    }
  });
});

// Handle list-simulations endpoint
server.get('/list-simulations', async (req, res) => {
  try {
    const simulationsDir = path.join(__dirname, 'simulations');
    
    // Ensure the simulations directory exists
    try {
      await fsPromises.mkdir(simulationsDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
    
    // Read all files in the simulations directory
    const files = await fsPromises.readdir(simulationsDir);
    
    // Filter for JSON files
    const simulationFiles = files.filter(file => file.endsWith('.json'));
    
    // Get file stats for each simulation file
    const simulations = [];
    for (const file of simulationFiles) {
      const filePath = path.join(simulationsDir, file);
      const stats = await fsPromises.stat(filePath);
      
      simulations.push({
        filename: file,
        created: stats.mtime.toISOString(),
        size: stats.size
      });
    }
    
    // Sort by most recent first
    simulations.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.status(200).json({ simulations });
  } catch (error) {
    console.error('Error listing simulations:', error);
    res.status(500).json({ error: 'Failed to list simulations', details: error.message });
  }
});

// Handle load-simulation endpoint
server.get('/load-simulation', async (req, res) => {
  try {
    const { filename } = req.query;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename parameter is required' });
    }
    
    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(__dirname, 'simulations', filename);
    
    try {
      // Check if file exists
      await fsPromises.access(filePath);
    } catch (err) {
      return res.status(404).json({ error: 'Simulation file not found' });
    }
    
    // Read and parse the simulation data
    const data = await fsPromises.readFile(filePath, 'utf8');
    const simulationData = JSON.parse(data);
    
    res.status(200).json({ 
      success: true,
      simulationData
    });
  } catch (error) {
    console.error('Error loading simulation:', error);
    res.status(500).json({ error: 'Failed to load simulation', details: error.message });
  }
});

// Handle delete-simulation endpoint
server.delete('/delete-simulation', async (req, res) => {
  try {
    const { filename } = req.query;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename parameter is required' });
    }
    
    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(__dirname, 'simulations', filename);
    
    try {
      // Check if file exists
      await fsPromises.access(filePath);
    } catch (err) {
      return res.status(404).json({ error: 'Simulation file not found' });
    }
    
    // Delete the file
    await fsPromises.unlink(filePath);
    
    res.status(200).json({ 
      success: true,
      message: `Simulation ${filename} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting simulation:', error);
    res.status(500).json({ error: 'Failed to delete simulation', details: error.message });
  }
});

// Handle static files
server.use(express.static(__dirname, {
  setHeaders: (res, path) => {
    // Set proper MIME types
    const ext = path.split('.').pop().toLowerCase();
    if (MIME_TYPES[`.${ext}`]) {
      res.setHeader('Content-Type', MIME_TYPES[`.${ext}`]);
    }
    
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }
}));

/**
 * Parse stock data from JSON or CSV file
 * @param {string} dataContent - File content
 * @param {string} fileType - 'json' or 'csv'
 * @returns {Object} - Parsed data information
 */
function parseStockData(dataContent, fileType) {
  let dataPoints = 0;
  let startDate = null;
  let endDate = null;
  let daysCovered = 0;
  let parsedData = null;
  
  try {
    if (fileType === 'json') {
      // Parse JSON data
      parsedData = JSON.parse(dataContent);
      
      // Handle array of objects (most common format)
      if (Array.isArray(parsedData)) {
        console.log(`Found array data with ${parsedData.length} records`);
        dataPoints = parsedData.length;
        
        // Check if records have Date field
        if (dataPoints > 0 && parsedData[0].Date) {
          // Sort by date to ensure correct order
          // Use manual sorting to avoid potential stack overflow with large arrays
          const dateStrs = [];
          const itemsByDate = {};
          
          for (let i = 0; i < parsedData.length; i++) {
            const item = parsedData[i];
            if (item && item.Date) {
              const dateStr = String(item.Date);
              dateStrs.push(dateStr);
              itemsByDate[dateStr] = item;
            }
          }
          
          // Sort date strings
          dateStrs.sort();
          
          // Rebuild parsed data in date order
          if (dateStrs.length > 0) {
            startDate = dateStrs[0];
            endDate = dateStrs[dateStrs.length - 1];
            
            // If date strings are available but not all items have corresponding dates
            // we'll keep the original parsedData to avoid data loss
            if (dateStrs.length === parsedData.length) {
              // Safe to rebuild the array
              const sortedData = [];
              for (let i = 0; i < dateStrs.length; i++) {
                sortedData.push(itemsByDate[dateStrs[i]]);
              }
              parsedData = sortedData;
            }
            
            // Calculate days covered
            if (startDate && endDate) {
              const start = new Date(startDate);
              const end = new Date(endDate);
              if (!isNaN(start) && !isNaN(end)) {
                daysCovered = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
              } else {
                // Fallback if dates are invalid
                daysCovered = Math.ceil(dataPoints * 7 / 5); // trading days -> calendar days
              }
            }
          } else {
            // No valid dates, estimate from array length
            daysCovered = Math.ceil(dataPoints * 7 / 5); // trading days -> calendar days
          }
        } else {
          // No Date field, estimate from array length
          daysCovered = Math.ceil(dataPoints * 7 / 5); // trading days -> calendar days
        }
      }
      // Handle object with property arrays
      else if (typeof parsedData === 'object') {
        // Check for dates array
        if (parsedData.dates && Array.isArray(parsedData.dates)) {
          dataPoints = parsedData.dates.length;
          startDate = parsedData.dates[0];
          endDate = parsedData.dates[parsedData.dates.length - 1];
          
          // Calculate days covered
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            daysCovered = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
          }
        }
        // Check for prices array
        else if (parsedData.prices && Array.isArray(parsedData.prices)) {
          dataPoints = parsedData.prices.length;
          daysCovered = Math.ceil(dataPoints * 7 / 5);
        }
        // Find any array property
        else {
          const arrayProps = Object.keys(parsedData).filter(key => 
            Array.isArray(parsedData[key]) && parsedData[key].length > 0);
          
          if (arrayProps.length > 0) {
            const firstArrayProp = arrayProps[0];
            dataPoints = parsedData[firstArrayProp].length;
            daysCovered = Math.ceil(dataPoints * 7 / 5);
          }
        }
      }
    } else if (fileType === 'csv') {
      // Parse CSV data
      const lines = dataContent.trim().split('\n');
      
      if (lines.length > 1) {
        // Get headers
        const headers = lines[0].split(',');
        const dateIndex = headers.indexOf('Date');
        const closeIndex = headers.indexOf('Close');
        const adjCloseIndex = headers.indexOf('Adj Close');
        
        if (dateIndex !== -1) {
          dataPoints = lines.length - 1; // Subtract header
          
          // Collect data for sorting
          const dataWithDates = [];
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const fields = line.split(',');
            if (fields.length <= dateIndex) continue;
            
            const dateStr = fields[dateIndex];
            if (!dateStr) continue;
            
            try {
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) {
                dataWithDates.push({
                  date,
                  dateStr,
                  line
                });
              }
            } catch (e) {
              // Skip invalid dates
            }
          }
          
          // Sort by date
          dataWithDates.sort((a, b) => a.date - b.date);
          
          if (dataWithDates.length > 0) {
            startDate = dataWithDates[0].dateStr;
            endDate = dataWithDates[dataWithDates.length - 1].dateStr;
            
            // Calculate days covered
            if (startDate && endDate) {
              const start = new Date(startDate);
              const end = new Date(endDate);
              daysCovered = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            }
            
            // Create structured data from CSV for consistent return format
            parsedData = [];
            for (const item of dataWithDates) {
              const fields = item.line.split(',');
              const dataObj = { Date: item.dateStr };
              
              // Add all available fields
              for (let j = 0; j < headers.length; j++) {
                if (j !== dateIndex && j < fields.length) {
                  let fieldName = headers[j].trim();
                  let value = fields[j].trim();
                  
                  // Handle special column name cases for better compatibility
                  if (fieldName === 'Close/Last') {
                    fieldName = 'Close';
                  }
                  
                  // Remove $ or other currency symbols if present
                  if (typeof value === 'string') {
                    value = value.replace(/[$,]/g, '');
                  }
                  
                  // Try to convert to number if possible
                  const numValue = parseFloat(value);
                  
                  // Store both Close and Adj Close for compatibility
                  if (fieldName === 'Close') {
                    dataObj[fieldName] = isNaN(numValue) ? 0 : numValue;
                    if (!dataObj['Adj Close']) {
                      dataObj['Adj Close'] = isNaN(numValue) ? 0 : numValue;
                    }
                  } else {
                    dataObj[fieldName] = isNaN(numValue) ? value : numValue;
                  }
                }
              }
              
              parsedData.push(dataObj);
            }
          }
        } else {
          // No Date column, estimate from points
          dataPoints = lines.length - 1;
          daysCovered = Math.ceil(dataPoints * 7 / 5);
        }
      }
    }
  } catch (error) {
    console.error('Error parsing stock data:', error);
  }
  
  return {
    data: parsedData,
    dataPoints,
    startDate,
    endDate,
    daysCovered
  };
}

/**
 * Reads historical data for a stock from JSON or CSV file
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Historical data and summary
 */
async function readHistoricalDataFromJson(symbol) {
  const dataDir = path.join(__dirname, 'data');
  const jsonFile = path.join(dataDir, `${symbol}.json`);
  const csvFile = path.join(dataDir, `${symbol}.csv`);
  const metricsFile = path.join(dataDir, `${symbol}_metrics.json`);
  
  try {
    // First try JSON file
    try {
      const fileData = await fsPromises.readFile(jsonFile, 'utf8');
      const parsedInfo = parseStockData(fileData, 'json');
      
      // Get metrics if available
      let metrics = null;
      try {
        const metricsData = await fsPromises.readFile(metricsFile, 'utf8');
        metrics = JSON.parse(metricsData);
      } catch (metricsErr) {
        // No metrics file, that's okay
      }
      
      return {
        data: parsedInfo.data,
        summary: {
          symbol,
          dataPoints: parsedInfo.dataPoints,
          startDate: parsedInfo.startDate,
          endDate: parsedInfo.endDate,
          daysCovered: parsedInfo.daysCovered,
          metrics
        }
      };
    } catch (jsonErr) {
      // If JSON file doesn't exist, try CSV
      const fileData = await fsPromises.readFile(csvFile, 'utf8');
      const parsedInfo = parseStockData(fileData, 'csv');
      
      // Get metrics if available
      let metrics = null;
      try {
        const metricsData = await fsPromises.readFile(metricsFile, 'utf8');
        metrics = JSON.parse(metricsData);
      } catch (metricsErr) {
        // No metrics file, that's okay
      }
      
      return {
        data: parsedInfo.data, // Return parsed data from CSV
        summary: {
          symbol,
          dataPoints: parsedInfo.dataPoints,
          startDate: parsedInfo.startDate,
          endDate: parsedInfo.endDate,
          daysCovered: parsedInfo.daysCovered,
          metrics
        }
      };
    }
  } catch (error) {
    throw new Error(`Failed to read historical data for ${symbol}: ${error.message}`);
  }
}

/**
 * Calculates volatility metrics for all stocks with custom implementation
 * @returns {Promise<Object>} - Results of calculation
 */
async function calculateAllVolatilityMetricsCustom() {
  try {
    const dataDir = DATA_DIR;
    
    // Read all files in data directory
    const files = await fsPromises.readdir(dataDir);
    
    // Filter for JSON and CSV files that aren't metrics files
    const dataFiles = files.filter(file => 
      (file.endsWith('.json') || file.endsWith('.csv')) && 
      !file.includes('_metrics') &&
      file !== 'data_status.json' && 
      file !== 'volatility_metrics.json');
    
    // Extract symbols
    const symbols = dataFiles.map(file => path.basename(file, path.extname(file)));
    const uniqueSymbols = [...new Set(symbols)];
    
    console.log(`Found ${uniqueSymbols.length} stocks: ${uniqueSymbols.join(', ')}`);
    
    // Results object
    const results = {
      success: true,
      message: `Calculated volatility for ${uniqueSymbols.length} stocks`,
      metrics: {},
      settings: { stocks: {} }
    };
    
    // Process each stock
    for (const symbol of uniqueSymbols) {
      try {
        console.log(`Processing ${symbol}...`);
        
        // Read data
        const stockData = await readHistoricalDataFromJson(symbol);
        console.log(`Read data for ${symbol}: ${stockData.summary.dataPoints} points`);
        
        // Make sure we have enough data
        if (!stockData.data || stockData.summary.dataPoints < 30) {
          console.log(`Not enough data for ${symbol}, using defaults`);
          
          // Use default values
          results.metrics[symbol] = {
            symbol,
            volatility: getDefaultVolatility(symbol),
            expectedReturn: getDefaultReturn(symbol),
            synthetic: true,
            reason: 'Insufficient data'
          };
          
          // Settings entry
          results.settings.stocks[symbol] = {
            volatility: Math.round(getDefaultVolatility(symbol) * 100),
            expectedReturn: Math.round(getDefaultReturn(symbol) * 100)
          };
          
          continue;
        }
        
        // Calculate returns
        let returnsArray = [];
        
        // Check if data is an array of objects with Adj Close/Close
        if (Array.isArray(stockData.data)) {
          // Sort data by date just to be sure
          stockData.data.sort((a, b) => new Date(a.Date) - new Date(b.Date));
          
          // Calculate daily returns from prices
          for (let i = 1; i < stockData.data.length; i++) {
            const prevPrice = stockData.data[i-1]['Adj Close'] || stockData.data[i-1].Close;
            const currPrice = stockData.data[i]['Adj Close'] || stockData.data[i].Close;
            
            if (prevPrice && currPrice) {
              returnsArray.push({
                date: stockData.data[i].Date,
                return: currPrice / prevPrice - 1
              });
            }
          }
        } 
        // Check if data has returns property
        else if (stockData.data.returns && Array.isArray(stockData.data.returns)) {
          // Format returns as array of objects
          returnsArray = stockData.data.returns.map((ret, i) => ({
            date: stockData.data.dates[i + 1], // Return is for the second day in each pair
            return: ret
          }));
        }
        
        if (returnsArray.length < 30) {
          console.log(`Not enough return data for ${symbol}, using defaults`);
          
          // Use default values
          results.metrics[symbol] = {
            symbol,
            volatility: getDefaultVolatility(symbol),
            expectedReturn: getDefaultReturn(symbol),
            synthetic: true,
            reason: 'Insufficient return data'
          };
          
          // Settings entry
          results.settings.stocks[symbol] = {
            volatility: Math.round(getDefaultVolatility(symbol) * 100),
            expectedReturn: Math.round(getDefaultReturn(symbol) * 100)
          };
          
          continue;
        }
        
        // Use only the most recent year of data (approximately 252 trading days)
        const recentReturns = returnsArray.length > 252 ? 
          returnsArray.slice(-252) : returnsArray;
        
        // Calculate volatility and expected return
        const volatility = calculateVolatility(recentReturns);
        const expectedReturn = calculateAnnualizedReturn(recentReturns);
        
        // Check for valid results
        if (!isFinite(volatility) || volatility <= 0 || !isFinite(expectedReturn)) {
          console.log(`Invalid calculation results for ${symbol}, using defaults`);
          
          // Use default values
          results.metrics[symbol] = {
            symbol,
            volatility: getDefaultVolatility(symbol),
            expectedReturn: getDefaultReturn(symbol),
            synthetic: true,
            reason: 'Invalid calculation results'
          };
          
          // Settings entry
          results.settings.stocks[symbol] = {
            volatility: Math.round(getDefaultVolatility(symbol) * 100),
            expectedReturn: Math.round(getDefaultReturn(symbol) * 100)
          };
          
          continue;
        }
        
        // Apply reasonable constraints
        let adjustedReturn = expectedReturn;
        if (adjustedReturn > 0.6) adjustedReturn = 0.6;
        if (adjustedReturn < -0.2) adjustedReturn = -0.2;
        
        // Create metrics object
        const metrics = {
          symbol,
          dataPoints: returnsArray.length,
          recentDataPoints: recentReturns.length,
          lastCalculatedDate: new Date().toISOString(),
          volatility,
          expectedReturn: adjustedReturn,
          originalExpectedReturn: expectedReturn,
          daysCovered: stockData.summary.daysCovered,
          synthetic: false
        };
        
        // Save metrics
        const metricsFile = path.join(dataDir, `${symbol}_metrics.json`);
        await fsPromises.writeFile(metricsFile, JSON.stringify(metrics, null, 2));
        
        // Add to results
        results.metrics[symbol] = metrics;
        
        // Settings entry
        results.settings.stocks[symbol] = {
          volatility: Math.round(volatility * 100),
          expectedReturn: Math.round(adjustedReturn * 100)
        };
        
        console.log(`Updated ${symbol}: Volatility ${Math.round(volatility * 100)}%, Expected Return ${Math.round(adjustedReturn * 100)}% (historical data)`);
      } catch (stockError) {
        console.error(`Error processing ${symbol}:`, stockError);
        
        // Use default values on error
        results.metrics[symbol] = {
          symbol,
          volatility: getDefaultVolatility(symbol),
          expectedReturn: getDefaultReturn(symbol),
          synthetic: true,
          reason: `Error: ${stockError.message}`
        };
        
        // Settings entry
        results.settings.stocks[symbol] = {
          volatility: Math.round(getDefaultVolatility(symbol) * 100),
          expectedReturn: Math.round(getDefaultReturn(symbol) * 100)
        };
      }
    }
    
    // Save settings
    try {
      const settingsPath = path.join(__dirname, 'stock_settings.json');
      let settings = { riskFreeRate: 4.5, stocks: {} };
      
      // Try to read existing settings
      try {
        const settingsData = await fsPromises.readFile(settingsPath, 'utf8');
        settings = JSON.parse(settingsData);
      } catch (readErr) {
        // No settings file, that's okay
      }
      
      // Update settings with calculated values
      for (const symbol in results.settings.stocks) {
        if (!settings.stocks[symbol]) {
          settings.stocks[symbol] = {};
        }
        
        settings.stocks[symbol].volatility = results.settings.stocks[symbol].volatility;
        settings.stocks[symbol].expectedReturn = results.settings.stocks[symbol].expectedReturn;
      }
      
      // Save updated settings
      await fsPromises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    } catch (settingsErr) {
      console.error('Error updating settings:', settingsErr);
    }
    
    return results;
  } catch (error) {
    throw new Error(`Failed to calculate volatility metrics: ${error.message}`);
  }
}

/**
 * Gets volatility for a symbol from stock settings in stock_settings.json
 * @param {string} symbol - Stock symbol
 * @returns {number} - Volatility as decimal (not percentage)
 * @throws {Error} - Throws error if value can't be retrieved
 */
function getDefaultVolatility(symbol) {
  // Get value from stock settings
  try {
    const { loadStockSettings } = require('./kelly_criterion');
    const settings = loadStockSettings();
    
    if (settings && settings.stocks && settings.stocks[symbol] && 
        typeof settings.stocks[symbol].volatility === 'number') {
      // Convert from percentage to decimal
      return settings.stocks[symbol].volatility / 100;
    }
    
    throw new Error(`No volatility data found for ${symbol} in stock settings`);
  } catch (error) {
    console.error(`Failed to get volatility for ${symbol}:`, error.message);
    throw new Error(`Cannot determine volatility for ${symbol}: ${error.message}`);
  }
}

/**
 * Gets expected return for a symbol from stock settings in stock_settings.json
 * @param {string} symbol - Stock symbol
 * @returns {number} - Expected return as decimal (not percentage)
 * @throws {Error} - Throws error if value can't be retrieved
 */
function getDefaultReturn(symbol) {
  // Get value from stock settings
  try {
    const { loadStockSettings } = require('./kelly_criterion');
    const settings = loadStockSettings();
    
    if (settings && settings.stocks && settings.stocks[symbol] && 
        typeof settings.stocks[symbol].expectedReturn === 'number') {
      // Convert from percentage to decimal
      return settings.stocks[symbol].expectedReturn / 100;
    }
    
    throw new Error(`No expected return data found for ${symbol} in stock settings`);
  } catch (error) {
    console.error(`Failed to get expected return for ${symbol}:`, error.message);
    throw new Error(`Cannot determine expected return for ${symbol}: ${error.message}`);
  }
}

/**
 * Calculates annualized return from daily returns
 * @param {Array} returns - Array of return objects
 * @returns {number} - Annualized return
 */
function calculateAnnualizedReturn(returns) {
  // Extract return values
  const returnValues = returns.map(r => r.return);
  
  // Calculate compound return
  const compoundReturn = returnValues.reduce((product, ret) => product * (1 + ret), 1);
  
  // Calculate average daily return
  const avgDailyReturn = Math.pow(compoundReturn, 1 / returnValues.length) - 1;
  
  // Annualize (compound over trading days in a year)
  return Math.pow(1 + avgDailyReturn, 252) - 1;
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Open your browser to see the Kelly Criterion visualization`);
  console.log(`Using modern data provider architecture for improved data handling`);
});
