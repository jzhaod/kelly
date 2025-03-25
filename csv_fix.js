/**
 * CSV data format fixer for Kelly Criterion app
 * This script creates a fix for the CSV data format issue
 */

// Import needed modules
const fs = require('fs').promises;
const path = require('path');

// Directory paths
const DATA_DIR = path.join(__dirname, 'data');

// A specific function to fix the data processing in parseStockData
async function fixCsvProcessing() {
  try {
    // Find all CSV files
    const files = await fs.readdir(DATA_DIR);
    const csvFiles = files.filter(file => file.endsWith('.csv') && !file.includes('_metrics'));
    
    console.log(`Found ${csvFiles.length} CSV files to process`);
    
    // Process each CSV file
    for (const csvFile of csvFiles) {
      const symbol = path.basename(csvFile, '.csv');
      const csvPath = path.join(DATA_DIR, csvFile);
      
      console.log(`Processing ${symbol} CSV file...`);
      
      // Read the file
      const csvData = await fs.readFile(csvPath, 'utf8');
      
      // Get header line and first data line to analyze
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        console.log(`CSV file for ${symbol} is too short, skipping`);
        continue;
      }
      
      const headerLine = lines[0];
      const firstDataLine = lines[1];
      
      // Parse header columns
      const headers = headerLine.split(',').map(h => h.trim());
      console.log(`CSV headers: ${headers.join(', ')}`);
      
      // Check for specific column name issues
      const needsFix = headers.includes('Close/Last') || 
                      firstDataLine.includes('$') ||
                      !headers.includes('Close');
      
      if (!needsFix) {
        console.log(`CSV for ${symbol} seems to have correct format, skipping`);
        continue;
      }
      
      // Create a fixed CSV
      // First fix the header line
      let fixedHeaderLine = headerLine;
      if (headers.includes('Close/Last')) {
        fixedHeaderLine = fixedHeaderLine.replace('Close/Last', 'Close');
      }
      
      // Fix data lines - remove $ and other currency symbols
      const fixedLines = [fixedHeaderLine];
      
      for (let i = 1; i < lines.length; i++) {
        // Replace all $ signs in the data
        fixedLines.push(lines[i].replace(/\$/g, ''));
      }
      
      // Create the fixed CSV content
      const fixedCsvData = fixedLines.join('\n');
      
      // Create a backup of the original file
      await fs.copyFile(csvPath, `${csvPath}.bak`);
      
      // Write the fixed CSV data
      await fs.writeFile(csvPath, fixedCsvData);
      
      console.log(`Fixed CSV format for ${symbol} and saved with backup`);
    }
    
    console.log('CSV format fix complete!');
  } catch (error) {
    console.error('Error fixing CSV data:', error);
  }
}

// Run the fix
fixCsvProcessing()
  .then(() => console.log('Processing complete'))
  .catch(err => console.error('Processing failed:', err));
