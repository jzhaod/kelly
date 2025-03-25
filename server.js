/**
 * Simple HTTP server for Kelly Criterion visualization
 */

const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const app = express();
const port = 3000;
const fs = require('fs').promises;
const { createDataProcessor } = require('./data_processor');

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

// Set up EJS and layout middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes for EJS templates
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'Kelly Criterion Portfolio',
        page: 'index'
    });
});

app.get('/stock-settings', (req, res) => {
    res.render('stock_settings', { 
        title: 'Stock Settings - Kelly Criterion',
        page: 'stock_settings'
    });
});

app.get('/about', (req, res) => {
    res.render('about', { 
        title: 'About - Kelly Criterion',
        page: 'about'
    });
});

app.get('/stock/:symbol', (req, res) => {
    res.render('stock_detail', { 
        title: `${req.params.symbol} - Stock Details`,
        page: 'stock_detail',
        symbol: req.params.symbol
    });
});

// Routes for old HTML files
app.get('/historical_data_management.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'historical_data_management.html'));
});

app.get('/settings.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'settings.html'));
});

app.get('/stock_detail.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'stock_detail.html'));
});

// API routes for stock settings
app.get('/api/stocks', (req, res) => {
    const settings = require('./stock_settings.json');
    const stocks = Object.entries(settings.stocks).map(([symbol, data]) => ({
        symbol,
        ...data
    }));
    res.json(stocks);
});

app.post('/api/stocks', (req, res) => {
    const fs = require('fs');
    const settings = require('./stock_settings.json');
    const { symbol, expectedReturn, volatility } = req.body;
    
    settings.stocks[symbol] = {
        expectedReturn,
        volatility
    };
    
    fs.writeFileSync('./stock_settings.json', JSON.stringify(settings, null, 2));
    res.json({ success: true });
});

app.delete('/api/stocks/:symbol', (req, res) => {
    const fs = require('fs');
    const settings = require('./stock_settings.json');
    delete settings.stocks[req.params.symbol];
    fs.writeFileSync('./stock_settings.json', JSON.stringify(settings, null, 2));
    res.json({ success: true });
});

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

// Handle data availability request
app.get('/data-availability', async (req, res) => {
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
app.post('/save-settings', (req, res) => {
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
          res.status(500).json({ error: 'Failed to save settings' });
          return;
        }
        
        res.status(200).json({ success: true, message: 'Settings saved successfully' });
      });
    } catch (error) {
      console.error('Error parsing settings data:', error);
      res.status(400).json({ error: 'Invalid settings data' });
    }
  });
  
  return;
});

// Handle load settings endpoint
app.get('/load-settings', (req, res) => {
  fs.readFile(SETTINGS_FILE, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Settings file doesn't exist yet
        res.status(404).json({ error: 'No saved settings found' });
      } else {
        console.error('Error reading settings:', err);
        res.status(500).json({ error: 'Failed to load settings' });
      }
      return;
    }
    
    try {
      // Parse the JSON data
      const settingsData = JSON.parse(data);
      
      res.status(200).json(settingsData);
    } catch (error) {
      console.error('Error parsing settings file:', error);
      res.status(500).json({ error: 'Invalid settings file format' });
    }
  });
  
  return;
});

// Handle data status endpoint
app.get('/data-status', async (req, res) => {
  // Read directly from the data directory instead of using the status file
  const dataDir = path.join(__dirname, 'data');
  
  // Ensure the data directory exists
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.error('Error creating data directory:', err);
      res.status(500).json({ error: 'Failed to ensure data directory exists' });
      return;
    }
  }
  
  // Read all files in the data directory
  const files = await fs.readdir(dataDir);
  
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
      const fileStats = await fs.stat(filePath);
      
      // Read data to get details
      let dataPoints = 0;
      let startDate = null;
      let endDate = null;
      let dataComplete = false;
      
      if (dataFile.endsWith('.json') || dataFile.endsWith('.csv')) {
        // Read data file
        const fileData = await fs.readFile(filePath, 'utf8');
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
        const metricsData = await fs.readFile(metricsPath, 'utf8');
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
app.post('/fetch-historical-data', async (req, res) => {
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
app.post('/delete-historical-data', async (req, res) => {
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
app.post('/fill-data-gaps', async (req, res) => {
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
app.post('/calculate-volatility', async (req, res) => {
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
app.get('/volatility-metrics', async (req, res) => {
  try {
    const metrics = await getVolatilityMetrics();
    res.status(200).json(metrics);
  } catch (error) {
    console.error('Error getting volatility metrics:', error);
    res.status(500).json({ error: 'Failed to get volatility metrics' });
  }
});

// Handle list-stocks endpoint
app.get('/list-stocks', (req, res) => {
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

// Handle static files
app.use(express.static(__dirname, {
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
      const fileData = await fs.readFile(jsonFile, 'utf8');
      const parsedInfo = parseStockData(fileData, 'json');
      
      // Get metrics if available
      let metrics = null;
      try {
        const metricsData = await fs.readFile(metricsFile, 'utf8');
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
      const fileData = await fs.readFile(csvFile, 'utf8');
      const parsedInfo = parseStockData(fileData, 'csv');
      
      // Get metrics if available
      let metrics = null;
      try {
        const metricsData = await fs.readFile(metricsFile, 'utf8');
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
 * Calculates volatility metrics for all stocks with custom implementation
 * @returns {Promise<Object>} - Results of calculation
 */
async function calculateAllVolatilityMetricsCustom() {
  try {
    const dataDir = DATA_DIR;
    
    // Read all files in data directory
    const files = await fs.readdir(dataDir);
    
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
        await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2));
        
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
        const settingsData = await fs.readFile(settingsPath, 'utf8');
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
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
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

// Error handling
app.use((req, res) => {
    res.status(404).render('404', { 
        title: '404 - Page Not Found',
        page: '404'
    });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Open your browser to see the Kelly Criterion visualization`);
  console.log(`Using modern data provider architecture for improved data handling`);
});
