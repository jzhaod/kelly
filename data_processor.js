/**
 * Data Processor Classes
 * 
 * This module provides classes for processing stock data from different sources (JSON and CSV)
 * while maintaining a consistent data structure for display and analysis.
 */

// Import csv-parse with proper handling for sync/async
// Using different approach for newer csv-parse versions (5.x+)
const { parse } = require('csv-parse/sync');
// Fallback for callback API if needed
const csvParseAsync = require('csv-parse');

// Base class for data processing
class BaseDataProcessor {
  constructor() {
    this.data = null;
    this.metrics = null;
  }

  // Common data structure for all processors
  getProcessedData() {
    return {
      symbol: this.symbol,
      data: this.data,
      metrics: this.metrics,
      dataPoints: this.data ? this.data.length : 0,
      startDate: this.data && this.data.length > 0 ? this.data[0].Date : null,
      endDate: this.data && this.data.length > 0 ? this.data[this.data.length - 1].Date : null,
      daysCovered: this.calculateDaysCovered()
    };
  }

  calculateDaysCovered() {
    if (!this.data || this.data.length < 2) return 0;
    const start = new Date(this.data[0].Date);
    const end = new Date(this.data[this.data.length - 1].Date);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  }

  // Common validation method
  validateDataItem(item) {
    return item && 
           item.Date && 
           (item.Close !== undefined || item['Adj Close'] !== undefined);
  }

  // Common data cleaning method
  cleanDataItem(item) {
    return {
      Date: item.Date,
      Close: parseFloat(item.Close) || 0,
      'Adj Close': parseFloat(item['Adj Close']) || parseFloat(item.Close) || 0,
      Volume: parseInt(item.Volume) || 0
    };
  }
}

// JSON data processor
class JsonDataProcessor extends BaseDataProcessor {
  constructor() {
    super();
  }

  async processData(rawData) {
    try {
      this.symbol = rawData.symbol;
      this.metrics = rawData.metrics || null;

      if (!rawData.data || !Array.isArray(rawData.data)) {
        console.log("No valid data array found in JSON");
        this.data = [];
        return this.getProcessedData();
      }

      console.log(`Processing JSON data with ${rawData.data.length} items`);
      this.data = this.processDataArray(rawData.data);
      return this.getProcessedData();
    } catch (error) {
      console.error('Error processing JSON data:', error);
      throw error;
    }
  }

  processDataArray(dataArray) {
    const processedData = [];
    const chunkSize = 100;
    let processedCount = 0;

    for (let i = 0; i < dataArray.length; i += chunkSize) {
      const chunk = dataArray.slice(i, i + chunkSize);
      const processedChunk = chunk
        .filter(item => this.validateDataItem(item))
        .map(item => {
          processedCount++;
          return this.cleanDataItem(item);
        });
      processedData.push(...processedChunk);
    }

    console.log(`Processed ${processedCount} valid items from JSON`);
    return processedData;
  }
}

// CSV data processor
class CsvDataProcessor extends BaseDataProcessor {
  constructor() {
    super();
  }

  async processData(csvContent) {
    try {
      console.log('Starting CSV data processing');
      
      // Verify that csvContent is a string
      if (typeof csvContent !== 'string') {
        console.error(`Error: Expected csvContent to be a string, got ${typeof csvContent}`);
        this.data = [];
        return this.getProcessedData();
      }
      
      // Basic validation of CSV content
      if (!csvContent || csvContent.trim() === '') {
        console.error('Error: Empty CSV content');
        this.data = [];
        return this.getProcessedData();
      }
      
      // Parse CSV content using csv-parse sync for simplicity
      let records;
      try {
        console.log('Using synchronous CSV parsing');
        // parse from csv-parse/sync is synchronous
        records = parse(csvContent, {
          columns: true, // Use first row as headers
          skip_empty_lines: true,
          trim: true
        });
        console.log(`Successfully parsed ${records.length} CSV records synchronously`);
      } catch (parseError) {
        console.error('CSV Parse error:', parseError);
        // Attempt fallback to async parse if sync fails
        try {
          console.log('Falling back to async parsing');
          records = await new Promise((resolve, reject) => {
            csvParseAsync(csvContent, {
              columns: true,
              skip_empty_lines: true,
              trim: true
            }, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
          console.log(`Successfully parsed ${records.length} CSV records asynchronously`);
        } catch (asyncError) {
          console.error('Async CSV Parse error:', asyncError);
          throw parseError; // Throw the original error
        }
      }

      if (!records || records.length === 0) {
        console.log("No valid data found in CSV");
        this.data = [];
        return this.getProcessedData();
      }

      console.log(`Processing CSV data with ${records.length} records`);
      this.data = this.processCsvRecords(records);
      return this.getProcessedData();
    } catch (error) {
      console.error('Error processing CSV data:', error);
      throw error;
    }
  }

  processCsvRecords(records) {
    const processedData = [];
    const chunkSize = 100;
    let processedCount = 0;

    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const processedChunk = chunk
        .filter(record => this.validateDataItem(record))
        .map(record => {
          processedCount++;
          return this.cleanDataItem(record);
        });
      processedData.push(...processedChunk);
    }

    console.log(`Processed ${processedCount} valid items from CSV`);
    return processedData;
  }

  // Override the base class validation method for CSV format
  validateDataItem(item) {
    return item && 
           item.Date && 
           item.Close !== undefined;
  }

  // Override the base class cleaning method for CSV format
  cleanDataItem(item) {
    return {
      Date: item.Date,
      Close: parseFloat(item.Close) || 0,
      'Adj Close': parseFloat(item.Close) || 0, // Use Close as Adj Close since we don't have it
      Volume: parseInt(item.Volume) || 0,
      Open: parseFloat(item.Open) || 0,
      High: parseFloat(item.High) || 0,
      Low: parseFloat(item.Low) || 0
    };
  }
}

// Factory function to create appropriate processor
function createDataProcessor(type) {
  switch (type.toLowerCase()) {
    case 'json':
      return new JsonDataProcessor();
    case 'csv':
      return new CsvDataProcessor();
    default:
      throw new Error(`Unsupported data type: ${type}`);
  }
}

module.exports = {
  createDataProcessor,
  JsonDataProcessor,
  CsvDataProcessor
}; 