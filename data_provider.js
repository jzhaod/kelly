/**
 * Stock Data Provider Module
 * 
 * Provides a clean, consistent interface for accessing stock data
 * regardless of the underlying data storage format (CSV or JSON).
 */

const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Base data provider class
class StockDataProvider {
  constructor(symbol) {
    this.symbol = symbol;
    this.dataDir = path.join(__dirname, 'data');
    this.metricsPath = path.join(this.dataDir, `${symbol}_metrics.json`);
  }
  
  /**
   * Get the actual price data for this stock
   * @returns {Promise<Array>} Array of standardized price data objects
   */
  async getData() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get metadata about this stock
   * @returns {Promise<Object>} Metadata object with dataPoints, dates, etc.
   */
  async getMetadata() {
    // Get basic metadata
    const data = await this.getData();
    
    let startDate = null;
    let endDate = null;
    let daysCovered = 0;
    
    if (data && data.length > 0) {
      // Sort data by date to ensure we get correct range
      data.sort((a, b) => new Date(a.Date) - new Date(b.Date));
      
      startDate = data[0].Date;
      endDate = data[data.length - 1].Date;
      
      // Calculate days covered
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start) && !isNaN(end)) {
        daysCovered = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    
    // Try to get metrics if available
    let metrics = null;
    try {
      const metricsData = await fs.readFile(this.metricsPath, 'utf8');
      metrics = JSON.parse(metricsData);
    } catch (err) {
      // Metrics not available, that's okay
    }
    
    return {
      symbol: this.symbol,
      dataPoints: data.length,
      startDate,
      endDate,
      daysCovered,
      metrics
    };
  }
  
  /**
   * Get complete data including both price data and metadata
   * @returns {Promise<Object>} Complete data object
   */
  async getCompleteData() {
    const [data, metadata] = await Promise.all([
      this.getData(),
      this.getMetadata()
    ]);
    
    return {
      ...metadata,
      data
    };
  }
  
  /**
   * Helper to parse numeric values, handling currency symbols
   * @param {string|number} value - Value to parse
   * @returns {number} Parsed numeric value or 0 if invalid
   */
  parseNumericValue(value) {
    if (value === null || value === undefined) return 0;
    
    // If already a number, just return it
    if (typeof value === 'number') return value;
    
    // Remove currency symbols and commas
    const cleanValue = String(value).replace(/[$,]/g, '');
    const parsed = parseFloat(cleanValue);
    
    return isNaN(parsed) ? 0 : parsed;
  }
}

// CSV implementation
class CsvStockDataProvider extends StockDataProvider {
  constructor(symbol) {
    super(symbol);
    this.filePath = path.join(this.dataDir, `${symbol}.csv`);
  }
  
  /**
   * Parse CSV data using csv-parser
   * @returns {Promise<Array>} Parsed and standardized data
   */
  async getData() {
    const fileContent = await fs.readFile(this.filePath, 'utf8');
    const results = [];
    
    // Create a readable stream from the file content
    const stream = Readable.from([fileContent]);
    
    // Process with csv-parser
    return new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => {
          // Transform to standard format 
          const standardizedData = this.standardizeData(data);
          results.push(standardizedData);
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }
  
  /**
   * Convert CSV row to standardized data format
   * @param {Object} rawData - Raw CSV row data
   * @returns {Object} Standardized data object
   */
  standardizeData(rawData) {
    // Create unified data format regardless of CSV column names
    return {
      Date: rawData.Date,
      Close: this.parseNumericValue(rawData.Close || rawData['Close/Last']),
      'Adj Close': this.parseNumericValue(rawData['Adj Close'] || rawData.Close || rawData['Close/Last']),
      Volume: parseInt(rawData.Volume || 0),
      Open: this.parseNumericValue(rawData.Open),
      High: this.parseNumericValue(rawData.High),
      Low: this.parseNumericValue(rawData.Low)
    };
  }
}

// JSON implementation
class JsonStockDataProvider extends StockDataProvider {
  constructor(symbol) {
    super(symbol);
    this.filePath = path.join(this.dataDir, `${symbol}.json`);
  }
  
  /**
   * Read and parse JSON data file
   * @returns {Promise<Array>} Parsed data array
   */
  async getData() {
    const data = await fs.readFile(this.filePath, 'utf8');
    const parsedData = JSON.parse(data);
    
    // Handle different JSON formats
    if (Array.isArray(parsedData)) {
      // Already an array of data objects
      return parsedData.map(item => this.standardizeData(item));
    } else if (typeof parsedData === 'object' && parsedData.dates && parsedData.prices) {
      // Data split into separate arrays by property
      const result = [];
      const length = Math.min(
        parsedData.dates.length,
        parsedData.prices.length,
        parsedData.volumes ? parsedData.volumes.length : Infinity
      );
      
      for (let i = 0; i < length; i++) {
        result.push({
          Date: parsedData.dates[i],
          Close: parsedData.prices[i],
          'Adj Close': parsedData.prices[i],
          Volume: parsedData.volumes ? parsedData.volumes[i] : 0,
          Open: parsedData.open ? parsedData.open[i] : parsedData.prices[i],
          High: parsedData.high ? parsedData.high[i] : parsedData.prices[i],
          Low: parsedData.low ? parsedData.low[i] : parsedData.prices[i]
        });
      }
      
      return result;
    }
    
    // Unknown format
    throw new Error(`Unsupported JSON format for ${this.symbol}`);
  }
  
  /**
   * Standardize JSON data item
   * @param {Object} item - Raw data item
   * @returns {Object} Standardized data object
   */
  standardizeData(item) {
    return {
      Date: item.Date,
      Close: this.parseNumericValue(item.Close),
      'Adj Close': this.parseNumericValue(item['Adj Close'] || item.Close),
      Volume: parseInt(item.Volume || 0),
      Open: this.parseNumericValue(item.Open),
      High: this.parseNumericValue(item.High),
      Low: this.parseNumericValue(item.Low)
    };
  }
}

/**
 * Factory function to create the appropriate data provider
 * @param {string} symbol - Stock symbol
 * @returns {Promise<StockDataProvider>} Data provider instance
 */
async function createDataProvider(symbol) {
  const dataDir = path.join(__dirname, 'data');
  const jsonPath = path.join(dataDir, `${symbol}.json`);
  const csvPath = path.join(dataDir, `${symbol}.csv`);
  
  try {
    // Check for JSON file
    await fs.access(jsonPath);
    return new JsonStockDataProvider(symbol);
  } catch (jsonErr) {
    try {
      // Check for CSV file
      await fs.access(csvPath);
      return new CsvStockDataProvider(symbol);
    } catch (csvErr) {
      throw new Error(`No data found for symbol ${symbol}`);
    }
  }
}

module.exports = {
  StockDataProvider,
  CsvStockDataProvider,
  JsonStockDataProvider,
  createDataProvider
};
