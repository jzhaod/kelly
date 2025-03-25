/**
 * Test script for the file reading process in the server
 * 
 * This simulates how the server would read a real CSV file and process it
 */

const fs = require('fs');
const path = require('path');

// Path to data directory and an example stock file
const DATA_DIR = path.join(__dirname, 'data');
const symbol = 'AAPL'; // Change this to a symbol you know exists in your data directory

// Function to check if a file exists
function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (e) {
    return false;
  }
}

// Mock of the data-availability endpoint handler
function mockDataAvailabilityEndpoint(symbol) {
  console.log(`Checking data availability for ${symbol}...`);
  
  const dataDir = path.join(__dirname, 'data');
  let dataPath = path.join(dataDir, `${symbol}.json`);
  let metricsPath = path.join(dataDir, `${symbol}_metrics.json`);
  let fileType = 'json';
  
  // Check for JSON file first
  if (!fileExists(dataPath)) {
    // If JSON doesn't exist, check for CSV
    dataPath = path.join(dataDir, `${symbol}.csv`);
    fileType = 'csv';
    
    if (!fileExists(dataPath)) {
      console.log(`No data files found for ${symbol}`);
      return {
        error: `No data found for symbol ${symbol}`
      };
    }
  }
  
  console.log(`Found ${fileType.toUpperCase()} file at ${dataPath}`);
  
  // Now read the data file (synchronous for testing)
  try {
    const dataContent = fs.readFileSync(dataPath, 'utf8');
    console.log(`Read ${dataContent.length} bytes from ${path.basename(dataPath)}`);
    
    // Let's look at the first few lines to get a sense of the data
    const previewLines = dataContent.split('\n').slice(0, 3).join('\n');
    console.log(`Data preview:\n${previewLines}\n...`);
    
    // Parse the data and get metrics
    const parsedInfo = parseStockData(dataContent, fileType);
    console.log(`Parsed data: ${parsedInfo.dataPoints} points, ${parsedInfo.daysCovered} days covered`);
    
    // Get the structured data from parsed info
    let structuredData = parsedInfo.data;
    console.log(`Initial structured data: ${structuredData ? structuredData.length : 'null'} items`);
    
    // Try fallback converter if needed
    if (!structuredData && fileType === 'csv') {
      structuredData = convertCsvToStructuredData(dataContent);
      console.log(`Fallback structured data: ${structuredData ? structuredData.length : 'null'} items`);
    }
    
    // Check metrics file
    let metrics = null;
    if (fileExists(metricsPath)) {
      try {
        const metricsContent = fs.readFileSync(metricsPath, 'utf8');
        metrics = JSON.parse(metricsContent);
        console.log(`Found metrics file with volatility: ${metrics.volatility}, expected return: ${metrics.expectedReturn}`);
      } catch (err) {
        console.error(`Error reading metrics: ${err.message}`);
      }
    } else {
      console.log('No metrics file found');
    }
    
    // Create response
    const response = {
      symbol,
      dataPoints: parsedInfo.dataPoints,
      startDate: parsedInfo.startDate,
      endDate: parsedInfo.endDate,
      daysCovered: parsedInfo.daysCovered,
      metrics,
      data: structuredData
    };
    
    // Check if data is actually there
    console.log(`Response includes structured data: ${response.data ? 'Yes' : 'No'}`);
    if (response.data && response.data.length > 0) {
      console.log(`Data items: ${response.data.length}`);
      console.log('First data item:');
      console.log(JSON.stringify(response.data[0], null, 2));
    }
    
    return response;
  } catch (error) {
    console.error(`Error processing file: ${error.message}`);
    return {
      error: `Error processing data: ${error.message}`
    };
  }
}

// Copy of parseStockData function
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
        
        if (dateIndex !== -1) {
          dataPoints = 0; // We'll count valid rows
          
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
                dataPoints++; // Count valid rows
              }
            } catch (e) {
              // Skip invalid dates
              console.error('Error parsing date:', e.message);
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
                  const fieldName = headers[j].trim();
                  const value = fields[j].trim();
                  // Try to convert to number if possible
                  const numValue = parseFloat(value);
                  dataObj[fieldName] = isNaN(numValue) ? value : numValue;
                }
              }
              
              parsedData.push(dataObj);
            }
            
            console.log(`CSV parsing created ${parsedData.length} data items`);
          }
        } else {
          // No Date column, estimate from points
          dataPoints = lines.length - 1;
          daysCovered = Math.ceil(dataPoints * 7 / 5);
          console.log('CSV has no Date column, using estimated days covered');
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

// Copy of convertCsvToStructuredData function (fallback)
function convertCsvToStructuredData(csvContent) {
  // Parse CSV lines
  const lines = csvContent.trim().split('\n');
  
  if (lines.length <= 1) {
    return [];
  }
  
  // Parse headers and find necessary columns
  const headers = lines[0].split(',');
  const dateIndex = headers.indexOf('Date');
  const closeIndex = headers.indexOf('Close');
  const adjCloseIndex = headers.indexOf('Adj Close');
  const volumeIndex = headers.indexOf('Volume');
  const openIndex = headers.indexOf('Open');
  const highIndex = headers.indexOf('High');
  const lowIndex = headers.indexOf('Low');
  
  if (dateIndex === -1) {
    console.error('CSV is missing Date column');
    return [];
  }
  
  // Use Close if Adj Close isn't available
  const priceIndex = adjCloseIndex !== -1 ? adjCloseIndex : closeIndex;
  
  if (priceIndex === -1) {
    console.error('CSV is missing both Close and Adj Close columns');
    return [];
  }
  
  // Convert each line to a structured object
  const structuredData = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const fields = line.split(',');
    if (fields.length <= Math.max(dateIndex, priceIndex)) continue;
    
    // Extract values
    const dateStr = fields[dateIndex];
    const close = parseFloat(fields[closeIndex !== -1 ? closeIndex : priceIndex]);
    const adjClose = parseFloat(fields[adjCloseIndex !== -1 ? adjCloseIndex : priceIndex]);
    
    if (!dateStr || (isNaN(close) && isNaN(adjClose))) continue;
    
    // Create data object
    const dataObject = {
      Date: dateStr,
      Close: isNaN(close) ? null : close
    };
    
    // Add Adj Close if available
    if (adjCloseIndex !== -1 && !isNaN(adjClose)) {
      dataObject['Adj Close'] = adjClose;
    }
    
    // Add Volume if available
    if (volumeIndex !== -1 && fields.length > volumeIndex) {
      const volume = parseInt(fields[volumeIndex]);
      if (!isNaN(volume)) {
        dataObject.Volume = volume;
      }
    }
    
    // Add Open, High, Low if available
    if (openIndex !== -1 && fields.length > openIndex) {
      const open = parseFloat(fields[openIndex]);
      if (!isNaN(open)) {
        dataObject.Open = open;
      }
    }
    
    if (highIndex !== -1 && fields.length > highIndex) {
      const high = parseFloat(fields[highIndex]);
      if (!isNaN(high)) {
        dataObject.High = high;
      }
    }
    
    if (lowIndex !== -1 && fields.length > lowIndex) {
      const low = parseFloat(fields[lowIndex]);
      if (!isNaN(low)) {
        dataObject.Low = low;
      }
    }
    
    structuredData.push(dataObject);
  }
  
  return structuredData;
}

// Check if data directory exists
if (!fileExists(DATA_DIR)) {
  console.error(`Data directory does not exist: ${DATA_DIR}`);
  console.log('Please provide a valid data directory path');
  process.exit(1);
}

// Helper to find a stock symbol that has CSV data
function findCsvStocks() {
  const files = fs.readdirSync(DATA_DIR);
  const csvFiles = files.filter(file => file.endsWith('.csv') && !file.includes('_metrics'));
  return csvFiles.map(file => path.basename(file, '.csv'));
}

// Helper to find a stock symbol that has JSON data
function findJsonStocks() {
  const files = fs.readdirSync(DATA_DIR);
  const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('_metrics') && file !== 'data_status.json');
  return jsonFiles.map(file => path.basename(file, '.json'));
}

// Run tests on CSV and JSON files
console.log('Available data in directory:', DATA_DIR);
const csvStocks = findCsvStocks();
const jsonStocks = findJsonStocks();

console.log('CSV stocks:', csvStocks);
console.log('JSON stocks:', jsonStocks);

// Test a CSV stock if available
if (csvStocks.length > 0) {
  console.log('\n========== Testing CSV Stock ==========');
  const csvSymbol = csvStocks[0];
  const csvResult = mockDataAvailabilityEndpoint(csvSymbol);
  
  if (csvResult.error) {
    console.error(`Error with CSV stock ${csvSymbol}:`, csvResult.error);
  } else {
    console.log(`CSV test finished for ${csvSymbol}`);
  }
}

// Test a JSON stock if available
if (jsonStocks.length > 0) {
  console.log('\n========== Testing JSON Stock ==========');
  const jsonSymbol = jsonStocks[0];
  const jsonResult = mockDataAvailabilityEndpoint(jsonSymbol);
  
  if (jsonResult.error) {
    console.error(`Error with JSON stock ${jsonSymbol}:`, jsonResult.error);
  } else {
    console.log(`JSON test finished for ${jsonSymbol}`);
  }
}

if (csvStocks.length === 0 && jsonStocks.length === 0) {
  console.log('No stock data files found in the data directory. Please make sure you have data files.');
  process.exit(1);
}
