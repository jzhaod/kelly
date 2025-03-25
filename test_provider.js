/**
 * Test script for the new data provider module
 */

const { createDataProvider } = require('./data_provider');

async function testProvider(symbol) {
  try {
    console.log(`Testing data provider for ${symbol}...`);
    
    // Create provider
    const provider = await createDataProvider(symbol);
    console.log(`Created ${provider.constructor.name} for ${symbol}`);
    
    // Get data
    const data = await provider.getData();
    console.log(`Retrieved ${data.length} data points`);
    
    // Check first item
    if (data.length > 0) {
      console.log('First data item:');
      console.log(JSON.stringify(data[0], null, 2));
      
      // Check if Close and Adj Close are available
      if (data[0].Close !== undefined && data[0]['Adj Close'] !== undefined) {
        console.log(`✅ Data has both Close (${data[0].Close}) and Adj Close (${data[0]['Adj Close']}) fields`);
      } else {
        console.log(`❌ Data is missing Close or Adj Close fields`);
      }
    }
    
    // Get metadata
    const metadata = await provider.getMetadata();
    console.log('Metadata:');
    console.log(JSON.stringify(metadata, null, 2));
    
    console.log(`Test for ${symbol} completed successfully`);
    return true;
  } catch (error) {
    console.error(`Error testing ${symbol}:`, error);
    return false;
  }
}

// Find a CSV stock to test
const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, 'data');

function findStocks() {
  const files = fs.readdirSync(dataDir);
  const csvFiles = files.filter(file => file.endsWith('.csv') && !file.includes('_metrics'));
  const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('_metrics') && file !== 'data_status.json');
  
  return {
    csv: csvFiles.map(file => path.basename(file, '.csv')),
    json: jsonFiles.map(file => path.basename(file, '.json'))
  };
}

// Run tests
async function runTests() {
  const stocks = findStocks();
  
  console.log('Available stocks:');
  console.log('CSV:', stocks.csv);
  console.log('JSON:', stocks.json);
  
  // Test a CSV stock if available
  if (stocks.csv.length > 0) {
    console.log('\n========== Testing CSV Stock ==========');
    await testProvider(stocks.csv[0]);
  }
  
  // Test a JSON stock if available
  if (stocks.json.length > 0) {
    console.log('\n========== Testing JSON Stock ==========');
    await testProvider(stocks.json[0]);
  }
}

runTests().catch(console.error);
