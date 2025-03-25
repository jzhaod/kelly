/**
 * Test script for the server's data handling pipeline
 * 
 * This script tests the full pipeline from:
 * 1. parseStockData (extracting metadata and parsing CSV)
 * 2. processDataFile (the main function that sends data to the client)
 * 
 * To run this test:
 * node test_server.js
 */

// Sample CSV data with all fields
const sampleCSV = `Date,Open,High,Low,Close,Adj Close,Volume
2023-01-03,130.28,130.90,124.17,125.07,125.07,246000
2023-01-04,127.26,128.56,125.08,126.36,126.36,200500
2023-01-05,125.85,127.85,124.76,127.10,127.10,160700
`;

// Mock functions from server.js with only the relevant code
function parseStockData(dataContent, fileType) {
  let dataPoints = 0;
  let startDate = null;
  let endDate = null;
  let daysCovered = 0;
  let parsedData = null;
  
  try {
    if (fileType === 'csv') {
      // Parse CSV data
      const lines = dataContent.trim().split('\n');
      
      if (lines.length > 1) {
        // Get headers
        const headers = lines[0].split(',');
        const dateIndex = headers.indexOf('Date');
        
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
                  const value = fields[j].trim();
                  // Try to convert to number if possible
                  const numValue = parseFloat(value);
                  dataObj[headers[j]] = isNaN(numValue) ? value : numValue;
                }
              }
              
              parsedData.push(dataObj);
            }
            
            console.log(`Created parsedData array with ${parsedData.length} items`);
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
 * Convert CSV content to structured data array (fallback method)
 */
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
  
  console.log(`Fallback converter created ${structuredData.length} items`);
  return structuredData;
}

/**
 * Mock of the processDataFile function
 */
function mockProcessDataFile(symbol, dataContent, fileType) {
  try {
    // Parse the stock data
    const parsedInfo = parseStockData(dataContent, fileType);
    console.log(`Parsed ${symbol}: ${parsedInfo.dataPoints} points, days covered: ${parsedInfo.daysCovered}`);
    
    // Get the structured data from parsedInfo
    let structuredData = parsedInfo.data;
    console.log(`Initial structured data from parseStockData: ${structuredData ? structuredData.length : 'null'} items`);
    
    // If there's still no structured data (rare case), try the converter as a fallback
    if (!structuredData && fileType === 'csv') {
      structuredData = convertCsvToStructuredData(dataContent);
      console.log(`Used fallback CSV converter with ${structuredData ? structuredData.length : 0} items`);
    }
    
    // For a real response, we would include metrics and other data
    const responseData = {
      symbol,
      dataPoints: parsedInfo.dataPoints,
      startDate: parsedInfo.startDate,
      endDate: parsedInfo.endDate,
      daysCovered: parsedInfo.daysCovered,
      metrics: null, // In a real scenario, we would include metrics if available
      data: structuredData // Include data for both JSON and CSV files
    };
    
    // Log some diagnostic information
    console.log(`Response data summary for ${symbol}:`);
    console.log(`- Data points: ${responseData.dataPoints}`);
    console.log(`- Date range: ${responseData.startDate} to ${responseData.endDate}`);
    console.log(`- Days covered: ${responseData.daysCovered}`);
    console.log(`- Data included: ${responseData.data ? 'Yes' : 'No'}`);
    console.log(`- Data length: ${responseData.data ? responseData.data.length : 'N/A'}`);
    
    if (responseData.data && responseData.data.length > 0) {
      console.log('- First data item:');
      console.log(JSON.stringify(responseData.data[0], null, 2));
    }
    
    return responseData;
  } catch (error) {
    console.error('Error in mock processDataFile:', error);
    return { error: error.message };
  }
}

// Test the full pipeline
console.log("======== Testing Full Server Pipeline ========");
console.log("\nTesting with CSV data:");
const result = mockProcessDataFile('TSLA', sampleCSV, 'csv');

// Validate the result
console.log("\n======== Validation ========");
if (result.data && result.data.length > 0) {
  console.log("Test PASSED: CSV data was properly parsed and structured data was returned.");
} else {
  console.error("Test FAILED: No structured data was returned!");
  console.error("Make sure parseStockData is correctly creating the data array for CSV files.");
}
