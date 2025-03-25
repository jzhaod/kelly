/**
 * Simple HTTP server for Kelly Criterion visualization
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const SETTINGS_FILE = path.join(__dirname, 'stock_settings.json');

// Data directory
const DATA_DIR = path.join(__dirname, 'data');

// Import historical data functionality
const { 
  getDataStatus,
  fetchHistoricalData,
  deleteHistoricalData,
  calculateVolatilityMetrics,
  calculateAllVolatilityMetrics,
  getVolatilityMetrics,
  updateSettingsWithVolatilityMetrics
} = require('./historical_data');

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
const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Handle save settings endpoint
  if (req.method === 'POST' && req.url === '/save-settings') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Parse the JSON data
        const settingsData = JSON.parse(body);
        
        // Save to file
        fs.writeFile(SETTINGS_FILE, JSON.stringify(settingsData, null, 2), err => {
          if (err) {
            console.error('Error saving settings:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save settings' }));
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Settings saved successfully' }));
        });
      } catch (error) {
        console.error('Error parsing settings data:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid settings data' }));
      }
    });
    
    return;
  }
  
  // Handle load settings endpoint
  if (req.method === 'GET' && req.url === '/load-settings') {
    fs.readFile(SETTINGS_FILE, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // Settings file doesn't exist yet
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No saved settings found' }));
        } else {
          console.error('Error reading settings:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to load settings' }));
        }
        return;
      }
      
      try {
        // Parse the JSON data
        const settingsData = JSON.parse(data);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(settingsData));
      } catch (error) {
        console.error('Error parsing settings file:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid settings file format' }));
      }
    });
    
    return;
  }
  
  // Handle data status endpoint
  if (req.method === 'GET' && req.url === '/data-status') {
    // Read directly from the data directory instead of using the status file
    const dataDir = path.join(__dirname, 'data');
    
    // Ensure the data directory exists
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        console.error('Error creating data directory:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to ensure data directory exists' }));
        return;
      }
    }
    
    // Read all files in the data directory
    fs.readdir(dataDir, async (err, files) => {
      if (err) {
        console.error('Error reading data directory:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read data directory' }));
        return;
      }
      
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
          const fileStats = await fs.promises.stat(filePath);
          
          // Read data to get details
          let dataPoints = 0;
          let startDate = null;
          let endDate = null;
          let dataComplete = false;
          
          if (dataFile.endsWith('.json') || dataFile.endsWith('.csv')) {
            // Read data file
            const fileData = await fs.promises.readFile(filePath, 'utf8');
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
            const metricsData = await fs.promises.readFile(metricsPath, 'utf8');
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
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    });
    
    return;
  }
  
  // Handle fetch historical data endpoint
  if (req.method === 'POST' && req.url === '/fetch-historical-data') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Parse the JSON data
        const requestData = JSON.parse(body);
        const { symbol, years = 5, forceRefresh = false } = requestData;
        
        if (!symbol) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Symbol is required' }));
          return;
        }
        
        // Fetch historical data
        fetchHistoricalData(symbol, years, forceRefresh)
          .then(result => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          })
          .catch(error => {
            console.error('Error fetching historical data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false,
              error: 'Failed to fetch historical data',
              message: error.message
            }));
          });
      } catch (error) {
        console.error('Error parsing request data:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request data' }));
      }
    });
    
    return;
  }
  
  // Handle delete historical data endpoint
  if (req.method === 'POST' && req.url === '/delete-historical-data') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Parse the JSON data
        const requestData = JSON.parse(body);
        const { symbol } = requestData;
        
        if (!symbol) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Symbol is required' }));
          return;
        }
        
        // Delete historical data
        deleteHistoricalData(symbol)
          .then(result => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          })
          .catch(error => {
            console.error('Error deleting historical data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false,
              error: 'Failed to delete historical data',
              message: error.message
            }));
          });
      } catch (error) {
        console.error('Error parsing request data:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request data' }));
      }
    });
    
    return;
  }
  
  // Handle fill data gaps endpoint
  if (req.method === 'POST' && req.url === '/fill-data-gaps') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Parse the JSON data
        const requestData = JSON.parse(body);
        const { symbol, gaps } = requestData;
        
        if (!symbol || !gaps || !Array.isArray(gaps) || gaps.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Symbol and gaps are required' }));
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
        Promise.all(fetchPromises)
          .then(results => {
            // Combine results
            const successCount = results.filter(r => r.success).length;
            const newDataPoints = results.reduce((sum, r) => sum + (r.newDataCount || 0), 0);
            
            if (successCount === gaps.length) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                message: `Successfully filled ${successCount} gaps with ${newDataPoints} new data points.`,
                results
              }));
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                message: `Partially filled gaps. Filled ${successCount} out of ${gaps.length} gaps with ${newDataPoints} new data points.`,
                results
              }));
            }
          })
          .catch(error => {
            console.error('Error filling data gaps:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false,
              error: 'Failed to fill data gaps',
              message: error.message
            }));
          });
      } catch (error) {
        console.error('Error parsing request data:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request data' }));
      }
    });
    
    return;
  }
  
  // Handle calculate volatility endpoint
  if (req.method === 'POST' && req.url === '/calculate-volatility') {
    calculateAllVolatilityMetricsCustom()
      .then(result => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      })
      .catch(error => {
        console.error('Error calculating volatility:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false,
          error: 'Failed to calculate volatility',
          message: error.message
        }));
      });
    return;
  }
  
  // Handle volatility metrics endpoint
  if (req.method === 'GET' && req.url === '/volatility-metrics') {
    getVolatilityMetrics()
      .then(metrics => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metrics));
      })
      .catch(error => {
        console.error('Error getting volatility metrics:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to get volatility metrics' }));
      });
    
    return;
  }
  
  // Handle data availability endpoint
  if (req.method === 'GET' && req.url.startsWith('/data-availability')) {
    // Parse symbol from query parameters
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const symbol = urlObj.searchParams.get('symbol');
    
    if (!symbol) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Symbol parameter is required' }));
      return;
    }
    
    const dataDir = path.join(__dirname, 'data');
    let dataPath = path.join(dataDir, `${symbol}.json`);
    let metricsPath = path.join(dataDir, `${symbol}_metrics.json`);
    
    // Check for JSON file first
    fs.access(dataPath, fs.constants.F_OK, (jsonErr) => {
      if (jsonErr) {
        // If JSON doesn't exist, check for CSV
        dataPath = path.join(dataDir, `${symbol}.csv`);
        fs.access(dataPath, fs.constants.F_OK, (csvErr) => {
          if (csvErr) {
            // Neither JSON nor CSV exists
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              symbol,
              dataPoints: 0,
              startDate: null,
              endDate: null,
              daysCovered: 0,
              metrics: null,
              error: 'No data found for this symbol'
            }));
            return;
          } else {
            // CSV exists, process it
            processDataFile(symbol, dataPath, metricsPath, 'csv', res);
          }
        });
      } else {
        // JSON exists, process it
        processDataFile(symbol, dataPath, metricsPath, 'json', res);
      }
    });
    
    return;
  }
  
  // Handle on-demand volatility calculation endpoint
  if (req.method === 'POST' && req.url === '/calculate-volatility-on-demand') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Parse the JSON data
        const requestData = JSON.parse(body);
        const { symbol } = requestData;
        
        if (!symbol) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Symbol is required' }));
          return;
        }
        
        // Get the historical data
        readHistoricalDataFromJson(symbol)
          .then(async result => {
            console.log(`Got data for ${symbol}:`, result.summary);
            
            if (!result.data || result.summary.dataPoints < 30) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                error: 'Insufficient data',
                message: `Need at least 30 data points for ${symbol}, but only have ${result.summary ? result.summary.dataPoints : 0}`
              }));
              return;
            }
            
            // Prepare returns data
            let returnsArray = [];
            
            // Check if data is an array of objects with Adj Close/Close
            if (Array.isArray(result.data)) {
              // Sort data by date just to be sure
              result.data.sort((a, b) => new Date(a.Date) - new Date(b.Date));
              
              // Calculate daily returns from prices
              for (let i = 1; i < result.data.length; i++) {
                const prevPrice = result.data[i-1]['Adj Close'] || result.data[i-1].Close;
                const currPrice = result.data[i]['Adj Close'] || result.data[i].Close;
                
                if (prevPrice && currPrice) {
                  returnsArray.push({
                    date: result.data[i].Date,
                    return: currPrice / prevPrice - 1
                  });
                }
              }
            } 
            // Check if data has returns property
            else if (result.data.returns && Array.isArray(result.data.returns)) {
              // Format returns as array of objects
              returnsArray = result.data.returns.map((ret, i) => ({
                date: result.data.dates[i + 1], // Return is for the second day in each pair
                return: ret
              }));
            }
            
            if (returnsArray.length < 30) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                error: 'Insufficient return data',
                message: `Need at least 30 return data points for ${symbol}, but could only calculate ${returnsArray.length}`
              }));
              return;
            }
            
            // Use only the most recent year of data (approximately 252 trading days)
            const recentReturns = returnsArray.length > 252 ? 
              returnsArray.slice(-252) : returnsArray;
            
            // Calculate volatility and expected return
            const volatility = calculateVolatility(recentReturns);
            const expectedReturn = calculateAnnualizedReturn(recentReturns);
            
            // Check for valid results
            if (!isFinite(volatility) || volatility <= 0 || !isFinite(expectedReturn)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                error: 'Invalid calculation results',
                message: 'Could not calculate valid volatility or return values'
              }));
              return;
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
              daysCovered: result.summary.daysCovered,
              synthetic: false
            };
            
            // Save metrics
            const metricsFile = path.join(DATA_DIR, `${symbol}_metrics.json`);
            await fs.promises.writeFile(metricsFile, JSON.stringify(metrics, null, 2));
            
            // Update status - we need to handle this differently now
            try {
              // Get data status
              const status = await getDataStatus();
              
              // Update status directly
              if (status.stocks[symbol]) {
                status.stocks[symbol].volatility = metrics.volatility;
                status.stocks[symbol].expectedReturn = metrics.expectedReturn;
                status.stocks[symbol].lastMetricsUpdate = new Date().toISOString();
                
                // Save status
                await fs.promises.writeFile(path.join(DATA_DIR, 'data_status.json'), 
                  JSON.stringify(status, null, 2));
              }
            } catch (statusErr) {
              console.error(`Error updating status for ${symbol}:`, statusErr);
              // Continue anyway, not critical
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: true,
              message: `Successfully calculated volatility metrics for ${symbol}`,
              metrics
            }));
          })
          .catch(error => {
            console.error(`Error calculating volatility for ${symbol}:`, error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: `Failed to calculate volatility for ${symbol}`,
              message: error.message
            }));
          });
      } catch (error) {
        console.error('Error parsing request data:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request data' }));
      }
    });
    
    return;
  }
  
  // Handle list-stocks endpoint
  if (req.method === 'GET' && req.url === '/list-stocks') {
    const dataDir = path.join(__dirname, 'data');
    
    // Read all files in the data directory
    fs.readdir(dataDir, (err, files) => {
      if (err) {
        console.error('Error reading data directory:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read data directory' }));
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
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ stocks: uniqueSymbols }));
    });
    
    return;
  }
  
  // Handle static files
  // Parse the URL to extract the path without query parameters
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  let filePath = urlObj.pathname === '/' ? 
    path.join(__dirname, 'index.html') : 
    path.join(__dirname, urlObj.pathname);
  
  // Get file extension
  const extname = path.extname(filePath);
  
  // Default content type
  let contentType = MIME_TYPES[extname] || 'text/plain';
  
  // Read file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Page not found
        fs.readFile(path.join(__dirname, '404.html'), (err, content) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(content || '<h1>404 Not Found</h1>', 'utf8');
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf8');
    }
  });
});

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
          parsedData.sort((a, b) => new Date(a.Date) - new Date(b.Date));
          
          startDate = parsedData[0].Date;
          endDate = parsedData[dataPoints - 1].Date;
          
          // Calculate days covered
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            daysCovered = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
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
        
        if (dateIndex !== -1) {
          dataPoints = lines.length - 1; // Subtract header
          
          // Sort by date
          const sortedLines = lines.slice(1).sort((a, b) => {
            const dateA = new Date(a.split(',')[dateIndex]);
            const dateB = new Date(b.split(',')[dateIndex]);
            return dateA - dateB;
          });
          
          if (sortedLines.length > 0) {
            startDate = sortedLines[0].split(',')[dateIndex];
            endDate = sortedLines[sortedLines.length - 1].split(',')[dateIndex];
            
            // Calculate days covered
            if (startDate && endDate) {
              const start = new Date(startDate);
              const end = new Date(endDate);
              daysCovered = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
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
      const fileData = await fs.promises.readFile(jsonFile, 'utf8');
      const parsedInfo = parseStockData(fileData, 'json');
      
      // Get metrics if available
      let metrics = null;
      try {
        const metricsData = await fs.promises.readFile(metricsFile, 'utf8');
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
      const fileData = await fs.promises.readFile(csvFile, 'utf8');
      const parsedInfo = parseStockData(fileData, 'csv');
      
      // Get metrics if available
      let metrics = null;
      try {
        const metricsData = await fs.promises.readFile(metricsFile, 'utf8');
        metrics = JSON.parse(metricsData);
      } catch (metricsErr) {
        // No metrics file, that's okay
      }
      
      return {
        data: null, // We don't parse CSV into a structured object currently
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
 * Process data file for data availability endpoint
 * @param {string} symbol - Stock symbol
 * @param {string} dataPath - Path to data file
 * @param {string} metricsPath - Path to metrics file
 * @param {string} fileType - File type ('json' or 'csv')
 * @param {Object} res - HTTP response object
 */
function processDataFile(symbol, dataPath, metricsPath, fileType, res) {
  // Read the data file
  fs.readFile(dataPath, 'utf8', (dataErr, dataContent) => {
    if (dataErr) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: `Error reading data file: ${dataErr.message}`
      }));
      return;
    }
    
    try {
      // Parse the stock data
      const parsedInfo = parseStockData(dataContent, fileType);
      console.log(`Parsed ${symbol}: ${parsedInfo.dataPoints} points, ${parsedInfo.daysCovered} days covered`);
      
      // Try to read metrics file
      fs.readFile(metricsPath, 'utf8', (metricsErr, metricsContent) => {
        let metrics = null;
        
        if (!metricsErr) {
          try {
            metrics = JSON.parse(metricsContent);
          } catch (parseErr) {
            console.error(`Error parsing metrics for ${symbol}:`, parseErr);
          }
        }
        
        // Return the data availability summary
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          symbol,
          dataPoints: parsedInfo.dataPoints,
          startDate: parsedInfo.startDate,
          endDate: parsedInfo.endDate,
          daysCovered: parsedInfo.daysCovered,
          metrics,
          data: fileType === 'json' ? parsedInfo.data : null // Only include data for JSON files
        }));
      });
    } catch (parseErr) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: `Error parsing data file: ${parseErr.message}`
      }));
    }
  });
}

/**
 * Calculates volatility (standard deviation) from returns
 * @param {Array} returns - Array of return objects
 * @returns {number} - Annualized volatility
 */
function calculateVolatility(returns) {
  // Extract return values
  const returnValues = returns.map(r => r.return);
  
  // Calculate mean
  const mean = returnValues.reduce((sum, val) => sum + val, 0) / returnValues.length;
  
  // Calculate sum of squared differences
  const squaredDiffs = returnValues.map(val => Math.pow(val - mean, 2));
  const sumSquaredDiffs = squaredDiffs.reduce((sum, val) => sum + val, 0);
  
  // Calculate variance
  const variance = sumSquaredDiffs / (returnValues.length - 1);
  
  // Calculate daily standard deviation
  const dailyStdDev = Math.sqrt(variance);
  
  // Annualize (multiply by square root of trading days in a year)
  return dailyStdDev * Math.sqrt(252);
}

/**
 * Calculates volatility metrics for all stocks with custom implementation
 * @returns {Promise<Object>} - Results of calculation
 */
async function calculateAllVolatilityMetricsCustom() {
  try {
    const dataDir = DATA_DIR;
    
    // Read all files in data directory
    const files = await fs.promises.readdir(dataDir);
    
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
        await fs.promises.writeFile(metricsFile, JSON.stringify(metrics, null, 2));
        
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
        const settingsData = await fs.promises.readFile(settingsPath, 'utf8');
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
      await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    } catch (settingsErr) {
      console.error('Error updating settings:', settingsErr);
    }
    
    return results;
  } catch (error) {
    throw new Error(`Failed to calculate volatility metrics: ${error.message}`);
  }
}

/**
 * Gets default volatility for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {number} - Default volatility as decimal (not percentage)
 */
function getDefaultVolatility(symbol) {
  switch(symbol.toUpperCase()) {
    case 'TSLA': return 0.55;
    case 'NVDA': return 0.45;
    case 'CPNG': return 0.50;
    case 'SHOP': return 0.50;
    case 'MELI': return 0.45;
    default: return 0.40;  // Default for unknown stocks
  }
}

/**
 * Gets default expected return for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {number} - Default expected return as decimal (not percentage)
 */
function getDefaultReturn(symbol) {
  switch(symbol.toUpperCase()) {
    case 'TSLA': return 0.35;
    case 'NVDA': return 0.40;
    case 'CPNG': return 0.20;
    case 'SHOP': return 0.25;
    case 'MELI': return 0.30;
    default: return 0.15;  // Default for unknown stocks
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
});
