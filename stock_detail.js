/**
 * Stock Detail Page 
 * 
 * This script handles the stock detail page functionality, including:
 * - Loading historical data
 * - Displaying price charts
 * - Calculating and updating Kelly parameters
 * - Managing stock data
 */

// Global variables
let stockSymbol = '';
let stockData = null;
let priceChart = null;
let returnsChart = null;

// DOM Elements
const stockSymbolElement = document.getElementById('stockSymbol');
const stockDescriptionElement = document.getElementById('stockDescription');
const infoSymbolElement = document.getElementById('infoSymbol');
const infoDataPointsElement = document.getElementById('infoDataPoints');
const infoDateRangeElement = document.getElementById('infoDateRange');
const infoDaysCoveredElement = document.getElementById('infoDaysCovered');
const infoStatusElement = document.getElementById('infoStatus');
const infoLastUpdatedElement = document.getElementById('infoLastUpdated');
const expectedReturnInput = document.getElementById('expectedReturn');
const volatilityInput = document.getElementById('volatility');
const useHistoricalCheckbox = document.getElementById('useHistorical');
const calculateButton = document.getElementById('calculateButton');
const saveButton = document.getElementById('saveButton');
const paramSpinner = document.getElementById('paramSpinner');
const paramResultElement = document.getElementById('paramResult');
const dataYearsSelect = document.getElementById('dataYears');
const refreshDataButton = document.getElementById('refreshDataButton');
const refreshSpinner = document.getElementById('refreshSpinner');
const deleteDataButton = document.getElementById('deleteDataButton');
const dataResultElement = document.getElementById('dataResult');
const messageArea = document.getElementById('messageArea');
const deleteSymbolElement = document.getElementById('deleteSymbol');
const confirmDeleteButton = document.getElementById('confirmDeleteButton');

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  // Get stock symbol from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  stockSymbol = urlParams.get('symbol');
  
  if (!stockSymbol) {
    showMessage('No stock symbol provided. Please go back and select a stock.', 'danger');
    return;
  }
  
  // Update page title and description
  stockSymbolElement.textContent = stockSymbol;
  stockDescriptionElement.textContent = `Detailed information and management for ${stockSymbol}`;
  document.title = `${stockSymbol} Detail | Kelly Criterion`;
  
  // Set up event listeners
  calculateButton.addEventListener('click', calculateParameters);
  saveButton.addEventListener('click', saveParameters);
  refreshDataButton.addEventListener('click', refreshData);
  deleteDataButton.addEventListener('click', confirmDeleteData);
  confirmDeleteButton.addEventListener('click', deleteData);
  useHistoricalCheckbox.addEventListener('change', toggleHistoricalCalculation);
  
  // Load initial data
  loadStockData();
});

/**
 * Loads stock data from the server
 */
async function loadStockData() {
  try {
    showMessage('Loading stock data...', 'info');
    
    // Request data availability for this symbol
    const response = await fetch(`/data-availability?symbol=${stockSymbol}`);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      showMessage(`Error: ${data.error}`, 'danger');
      return;
    }
    
    // Log the structure of the data for debugging
    console.log(`Data structure for ${stockSymbol}:`, {
      hasData: !!data.data,
      dataType: data.data ? typeof data.data : 'undefined',
      isArray: data.data ? Array.isArray(data.data) : false,
      length: data.data && Array.isArray(data.data) ? data.data.length : 'N/A',
      dataPoints: data.dataPoints,
      firstItem: data.data && Array.isArray(data.data) && data.data.length > 0 ? 
        Object.keys(data.data[0]) : 'N/A'
    });
    
    // Normalize the data structure to prevent issues
    const normalizedData = { ...data };
    
    // Clean up data.data to ensure it's valid and safe to use
    if (normalizedData.data) {
      if (Array.isArray(normalizedData.data)) {
        // Verify array items have needed properties
        normalizedData.data = normalizedData.data
          .filter(item => {
            // Keep only items with Date and either Close or Adj Close
            return item && 
                   item.Date && 
                   (item.Close !== undefined || item['Adj Close'] !== undefined);
          })
          .map(item => {
            // Create clean copies of each item with only needed fields
            return {
              Date: item.Date,
              Close: parseFloat(item.Close) || 0,
              'Adj Close': parseFloat(item['Adj Close']) || parseFloat(item.Close) || 0,
              Volume: parseInt(item.Volume) || 0
            };
          });
      } else {
        // If data.data exists but isn't an array, create an empty array
        console.log("Data is not an array, creating empty data array");
        normalizedData.data = [];
      }
    } else {
      // If data.data is missing, create an empty array
      console.log("No data found, creating empty data array");
      normalizedData.data = [];
    }
    
    // Store normalized data
    stockData = normalizedData;
    
    // Update the UI with stock data
    updateStockInfo(normalizedData);
    
    // Update parameter inputs
    updateParameterInputs(normalizedData);
    
    if (normalizedData.data && normalizedData.data.length > 0) {
      // Create price chart
      createPriceChart(normalizedData);
      
      // Create returns chart if returns data available
      if (normalizedData.data.length > 1) {
        createReturnsChart(normalizedData);
      } else {
        console.log("Not enough data points for returns chart");
      }
      
      showMessage(`Successfully loaded data for ${stockSymbol}`, 'success');
    } else {
      showMessage(`Loaded metadata for ${stockSymbol}, but no price data is available`, 'warning');
    }
  } catch (error) {
    console.error('Error loading stock data:', error);
    showMessage(`Failed to load stock data: ${error.message}`, 'danger');
  }
}

/**
 * Updates the stock information display
 */
function updateStockInfo(data) {
  // Basic info
  infoSymbolElement.textContent = data.symbol || stockSymbol;
  infoDataPointsElement.textContent = data.dataPoints || 0;
  
  // Date range
  if (data.startDate && data.endDate) {
    infoDateRangeElement.textContent = `${formatDate(data.startDate)} to ${formatDate(data.endDate)}`;
  } else {
    infoDateRangeElement.textContent = 'No data available';
  }
  
  // Days covered
  infoDaysCoveredElement.textContent = data.daysCovered ? `${data.daysCovered} days` : 'N/A';
  
  // Data status
  if (data.dataPoints > 0) {
    const statusClass = data.daysCovered >= 1200 ? 'status-complete' : 
                        (data.daysCovered >= 500 ? 'status-partial' : 'status-incomplete');
    
    infoStatusElement.innerHTML = `<span class="${statusClass}">
      ${data.daysCovered >= 1200 ? 'Complete' : 
        (data.daysCovered >= 500 ? 'Partial' : 'Minimal')}
    </span>`;
  } else {
    infoStatusElement.innerHTML = '<span class="status-incomplete">No Data</span>';
  }
  
  // Last updated
  if (data.metrics && data.metrics.lastCalculatedDate) {
    infoLastUpdatedElement.textContent = formatDate(data.metrics.lastCalculatedDate);
  } else {
    infoLastUpdatedElement.textContent = 'Never';
  }
}

/**
 * Updates parameter input fields with current values
 */
function updateParameterInputs(data) {
  let expectedReturn = 15; // Default value
  let volatility = 40; // Default value
  
  // If metrics exist, use those values
  if (data.metrics) {
    expectedReturn = Math.round(data.metrics.expectedReturn * 100);
    volatility = Math.round(data.metrics.volatility * 100);
  } 
  // Otherwise try to load from stock settings
  else {
    // We'll load from stock_settings.json later
    loadStockSettings();
  }
  
  // Update input fields
  expectedReturnInput.value = expectedReturn;
  volatilityInput.value = volatility;
  
  // Enable/disable inputs based on historical calculation checkbox
  toggleHistoricalCalculation();
}

/**
 * Toggles whether to use historical calculation for parameters
 */
function toggleHistoricalCalculation() {
  const useHistorical = useHistoricalCheckbox.checked;
  
  // Disable inputs when using historical calculation
  expectedReturnInput.disabled = useHistorical;
  volatilityInput.disabled = useHistorical;
}

/**
 * Creates the price chart
 */
function createPriceChart(data) {
  // Debug data structure
  console.log("Creating price chart with data:", {
    hasData: !!data.data,
    isArray: Array.isArray(data.data),
    length: Array.isArray(data.data) ? data.data.length : 0
  });
  
  // Check if we have data to display
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    console.log('No price data available to display chart');
    return;
  }
  
  try {
    // Parse dates and prices from data
    const dates = [];
    const prices = [];
    let volumes = [];
    
    // Create a very simple copy to avoid any circular references
    const simplifiedData = [];
    for (let i = 0; i < data.data.length; i++) {
      if (i > 5000) break; // Hard limit for safety
      
      const item = data.data[i];
      if (!item || typeof item !== 'object') continue;
      
      try {
        const dateCopy = item.Date ? String(item.Date) : null;
        const closeCopy = item.Close !== undefined ? Number(item.Close) : null;
        const adjCloseCopy = item['Adj Close'] !== undefined ? Number(item['Adj Close']) : null;
        const volumeCopy = item.Volume !== undefined ? Number(item.Volume) : null;
        
        if (dateCopy) {
          simplifiedData.push({
            Date: dateCopy,
            Close: closeCopy,
            'Adj Close': adjCloseCopy,
            Volume: volumeCopy
          });
        }
      } catch (e) {
        console.error("Error copying data item:", e);
      }
    }
    
    console.log(`Simplified data created with ${simplifiedData.length} items`);
    
    // Sort data manually without using Array.sort to avoid stack issues
    const sortedData = [];
    for (let i = 0; i < simplifiedData.length; i++) {
      let inserted = false;
      for (let j = 0; j < sortedData.length; j++) {
        if (String(simplifiedData[i].Date) < String(sortedData[j].Date)) {
          sortedData.splice(j, 0, simplifiedData[i]);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        sortedData.push(simplifiedData[i]);
      }
      
      // Safety check - if we've spent too much time sorting, just add the rest
      if (i > 200 && sortedData.length > 200) {
        // We have enough data, just add the rest unsorted
        console.log("Safety limit reached in sorting, stopping early");
        break;
      }
    }
    
    // Limit data points to prevent potential issues
    const maxDataPoints = 200; // Very conservative limit
    const step = sortedData.length > maxDataPoints ? 
                Math.max(1, Math.floor(sortedData.length / maxDataPoints)) : 1;
    
    console.log(`Using step size ${step} for ${sortedData.length} data points`);
    
    for (let i = 0; i < sortedData.length; i += step) {
      const item = sortedData[i];
      if (!item || !item.Date) continue;
      
      dates.push(item.Date);
      
      // Use Adj Close if available, otherwise use Close
      let price = null;
      if (item['Adj Close'] !== undefined && item['Adj Close'] !== null && !isNaN(item['Adj Close'])) {
        price = Number(item['Adj Close']);
      } else if (item.Close !== undefined && item.Close !== null && !isNaN(item.Close)) {
        price = Number(item.Close);
      } else {
        price = 0;
      }
      
      if (!isFinite(price)) price = 0;
      prices.push(price);
      
      // Process volume if available
      if (item.Volume !== undefined && item.Volume !== null) {
        const volume = Number(item.Volume);
        volumes.push(isFinite(volume) ? volume : 0);
      }
    }
    
    console.log(`Processed ${prices.length} price points for chart`);
    
    // If no data processed, return
    if (dates.length === 0 || prices.length === 0) {
      console.log('No valid price data available after processing');
      return;
    }
    
    // Format dates for display (limit to 100 points for display)
    const formattedDates = [];
    const displayStep = dates.length > 100 ? Math.floor(dates.length / 100) : 1;
    
    for (let i = 0; i < dates.length; i += displayStep) {
      try {
        formattedDates.push(formatDate(dates[i]));
      } catch (e) {
        formattedDates.push("");
      }
    }
    
    // Destroy existing chart if any
    if (priceChart) {
      priceChart.destroy();
      priceChart = null;
    }
    
    // Create new chart
    const ctx = document.getElementById('priceChart');
    if (!ctx) {
      console.error("Could not find chart canvas element");
      return;
    }
    
    // Calculate min/max prices safely
    let minPrice = 0;
    let maxPrice = 100;
    let sumPrice = 0;
    let countPrice = 0;
    
    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      if (price > 0 && isFinite(price)) {
        if (countPrice === 0 || price < minPrice) minPrice = price;
        if (countPrice === 0 || price > maxPrice) maxPrice = price;
        sumPrice += price;
        countPrice++;
      }
    }
    
    // If no valid prices, use defaults
    if (countPrice === 0) {
      minPrice = 0;
      maxPrice = 100;
    }
    
    const avgPrice = countPrice > 0 ? sumPrice / countPrice : 50;
    const range = Math.max(1, maxPrice - minPrice);
    
    // Use simplified step size calculation
    const stepSize = range > 100 ? 25 : range > 50 ? 10 : range > 10 ? 5 : 1;
    
    try {
      // Create chart with simplified data
      priceChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: formattedDates,
          datasets: [{
            label: `${stockSymbol} Price`,
            data: prices,
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            fill: true,
            pointRadius: 0,
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: `${stockSymbol} Historical Price`
            },
            tooltip: {
              mode: 'index',
              intersect: false
            }
          },
          scales: {
            x: {
              ticks: {
                maxTicksLimit: 10
              }
            },
            y: {
              min: Math.max(0, minPrice - (range * 0.1)),
              max: maxPrice + (range * 0.1),
              ticks: {
                stepSize: stepSize
              }
            }
          }
        }
      });
    } catch (chartError) {
      console.error("Error creating chart:", chartError);
    }
  } catch (error) {
    console.error('Error creating price chart:', error);
  }
}

/**
 * Creates the returns distribution chart
 */
function createReturnsChart(data) {
  try {
    console.log("Creating returns chart with data:", {
      hasData: !!data.data,
      isArray: Array.isArray(data.data),
      length: Array.isArray(data.data) ? data.data.length : 0,
      dataPoints: data.dataPoints
    });
    
    // Check if we have data to display
    if (!data.data || !Array.isArray(data.data) || data.data.length < 2) {
      console.log('Not enough data for returns chart');
      return;
    }
    
    // Calculate daily returns using a more direct approach
    const returns = [];
    
    // Create a simplified copy of the data to avoid any circular references
    const priceData = [];
    const maxItems = Math.min(data.data.length, 500); // Limit data points for safety
    
    for (let i = 0; i < maxItems; i++) {
      const item = data.data[i];
      if (!item || typeof item !== 'object' || !item.Date) continue;
      
      // Safely extract price
      let price = null;
      if (item['Adj Close'] !== undefined && !isNaN(Number(item['Adj Close']))) {
        price = Number(item['Adj Close']);
      } else if (item.Close !== undefined && !isNaN(Number(item.Close))) {
        price = Number(item.Close);
      }
      
      if (price !== null && isFinite(price) && price > 0) {
        priceData.push({
          date: String(item.Date),
          price: price
        });
      }
    }
    
    console.log(`Extracted ${priceData.length} price points for returns calculation`);
    
    // Sort the price data manually by date
    priceData.sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate returns - limit to 200 points max
    const maxReturns = Math.min(priceData.length - 1, 200);
    for (let i = 1; i < maxReturns; i++) {
      const currPrice = priceData[i].price;
      const prevPrice = priceData[i-1].price;
      
      if (currPrice > 0 && prevPrice > 0) {
        const dailyReturn = ((currPrice / prevPrice) - 1) * 100; // Convert to percentage
        // Add a safety check for reasonable values
        if (isFinite(dailyReturn) && Math.abs(dailyReturn) < 25) {
          returns.push(dailyReturn);
        }
      }
    }
    
    console.log(`Calculated ${returns.length} valid returns`);
    
    // If no returns calculated, return
    if (returns.length < 5) { // Need at least a few points
      console.log('Not enough return data available for chart');
      return;
    }
    
    // Find min/max safely without using Math.min/max (to avoid stack issues with large arrays)
    let minReturn = returns[0];
    let maxReturn = returns[0];
    
    for (let i = 1; i < returns.length; i++) {
      if (returns[i] < minReturn) minReturn = returns[i];
      if (returns[i] > maxReturn) maxReturn = returns[i];
    }
    
    // Apply safety limits
    minReturn = Math.max(-15, minReturn);
    maxReturn = Math.min(15, maxReturn);
    
    // Use a smaller number of bins
    const binCount = 10;
    const binWidth = (maxReturn - minReturn) / binCount;
    
    console.log(`Using bin range from ${minReturn.toFixed(2)}% to ${maxReturn.toFixed(2)}%`);
    
    // Create bins
    const bins = Array(binCount).fill(0);
    const binLabels = [];
    
    // Create labels for each bin
    for (let i = 0; i < binCount; i++) {
      const binStart = minReturn + (i * binWidth);
      const binEnd = binStart + binWidth;
      binLabels.push(`${binStart.toFixed(1)}% to ${binEnd.toFixed(1)}%`);
    }
    
    // Count returns in each bin with safety checks
    for (let i = 0; i < returns.length; i++) {
      const returnValue = returns[i];
      
      // Skip any NaN or infinite values
      if (!isFinite(returnValue)) continue;
      
      // Check if value is within our chart range
      if (returnValue < minReturn || returnValue > maxReturn) continue;
      
      // Calculate bin index with bounds checking
      const rawBinIndex = Math.floor((returnValue - minReturn) / binWidth);
      const binIndex = Math.max(0, Math.min(binCount - 1, rawBinIndex));
      
      if (binIndex >= 0 && binIndex < binCount) {
        bins[binIndex]++;
      }
    }
    
    // Destroy existing chart if any
    if (returnsChart) {
      returnsChart.destroy();
      returnsChart = null;
    }
    
    // Create new chart
    const ctx = document.getElementById('returnsChart');
    if (!ctx) {
      console.error("Could not find returns chart canvas element");
      return;
    }
    
    console.log("Creating returns chart with bins:", bins);
    
    try {
      returnsChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: binLabels,
          datasets: [{
            label: 'Frequency',
            data: bins,
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: `${stockSymbol} Daily Returns Distribution`
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.dataset.label}: ${context.raw} days`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: {
                maxTicksLimit: 10
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Frequency (days)'
              }
            }
          }
        }
      });
    } catch (chartError) {
      console.error("Error creating returns chart:", chartError);
    }
    
    // Calculate simple statistics without using reduce
    let sum = 0;
    let count = 0;
    
    // Limit to 200 values for statistics
    const statsLimit = Math.min(returns.length, 200);
    for (let i = 0; i < statsLimit; i++) {
      if (isFinite(returns[i])) {
        sum += returns[i];
        count++;
      }
    }
    
    if (count > 0) {
      const mean = sum / count;
      
      let sumSquareDiff = 0;
      for (let i = 0; i < statsLimit; i++) {
        if (isFinite(returns[i])) {
          sumSquareDiff += (returns[i] - mean) * (returns[i] - mean);
        }
      }
      
      const variance = count > 1 ? sumSquareDiff / count : 0;
      const stdDev = Math.sqrt(variance);
      
      console.log(`Returns Statistics: Mean=${mean.toFixed(2)}%, StdDev=${stdDev.toFixed(2)}%`);
    }
  } catch (error) {
    console.error('Error creating returns chart:', error);
  }
}

/**
 * Calculates Kelly parameters based on historical data
 */
async function calculateParameters() {
  try {
    // Show loading indicator
    paramSpinner.classList.remove('d-none');
    paramResultElement.innerHTML = 'Calculating parameters...';
    
    // If using historical calculation, request server calculation
    if (useHistoricalCheckbox.checked) {
      // Make API request to calculate volatility
      const response = await fetch('/calculate-volatility-on-demand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ symbol: stockSymbol })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Update input fields with calculated values
      expectedReturnInput.value = Math.round(data.metrics.expectedReturn * 100);
      volatilityInput.value = Math.round(data.metrics.volatility * 100);
      
      // Show success message
      paramResultElement.innerHTML = `
        <div class="alert alert-success">
          Successfully calculated parameters from historical data:
          <ul class="mb-0">
            <li>Expected Return: ${Math.round(data.metrics.expectedReturn * 100)}%</li>
            <li>Volatility: ${Math.round(data.metrics.volatility * 100)}%</li>
          </ul>
        </div>
      `;
    } else {
      // Just display the current parameters
      paramResultElement.innerHTML = `
        <div class="alert alert-info">
          Current parameters:
          <ul class="mb-0">
            <li>Expected Return: ${expectedReturnInput.value}%</li>
            <li>Volatility: ${volatilityInput.value}%</li>
          </ul>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error calculating parameters:', error);
    paramResultElement.innerHTML = `
      <div class="alert alert-danger">
        Error calculating parameters: ${error.message}
      </div>
    `;
  } finally {
    // Hide loading indicator
    paramSpinner.classList.add('d-none');
  }
}

/**
 * Saves Kelly parameters to stock settings
 */
async function saveParameters() {
  try {
    // Show loading indicator
    paramSpinner.classList.remove('d-none');
    paramResultElement.innerHTML = 'Saving parameters...';
    
    // Get current values
    const expectedReturn = parseInt(expectedReturnInput.value);
    const volatility = parseInt(volatilityInput.value);
    
    // Validate inputs
    if (isNaN(expectedReturn) || isNaN(volatility) || volatility <= 0) {
      throw new Error('Invalid parameter values');
    }
    
    // Load current settings
    const response = await fetch('/load-settings');
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const settings = await response.json();
    
    // Add or update stock entry
    if (!settings.stocks[stockSymbol]) {
      settings.stocks[stockSymbol] = {};
    }
    
    settings.stocks[stockSymbol].expectedReturn = expectedReturn;
    settings.stocks[stockSymbol].volatility = volatility;
    
    // Save updated settings
    const saveResponse = await fetch('/save-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });
    
    if (!saveResponse.ok) {
      throw new Error(`Server returned ${saveResponse.status}: ${saveResponse.statusText}`);
    }
    
    const saveResult = await saveResponse.json();
    
    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to save settings');
    }
    
    // Show success message
    paramResultElement.innerHTML = `
      <div class="alert alert-success">
        Successfully saved parameters for ${stockSymbol}:
        <ul class="mb-0">
          <li>Expected Return: ${expectedReturn}%</li>
          <li>Volatility: ${volatility}%</li>
        </ul>
      </div>
    `;
  } catch (error) {
    console.error('Error saving parameters:', error);
    paramResultElement.innerHTML = `
      <div class="alert alert-danger">
        Error saving parameters: ${error.message}
      </div>
    `;
  } finally {
    // Hide loading indicator
    paramSpinner.classList.add('d-none');
  }
}

/**
 * Refreshes historical data
 */
async function refreshData() {
  try {
    // Show loading indicator
    refreshSpinner.classList.remove('d-none');
    dataResultElement.innerHTML = 'Fetching historical data...';
    
    // Get selected time period
    const years = parseInt(dataYearsSelect.value);
    
    // Make API request to fetch historical data
    const response = await fetch('/fetch-historical-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: stockSymbol,
        years,
        forceRefresh: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch historical data');
    }
    
    // Show success message
    dataResultElement.innerHTML = `
      <div class="alert alert-success">
        ${result.message}
      </div>
    `;
  } catch (error) {
    console.error('Error refreshing data:', error);
    dataResultElement.innerHTML = `
      <div class="alert alert-danger">
        Error refreshing data: ${error.message}
      </div>
    `;
  } finally {
    // Hide loading indicator
    refreshSpinner.classList.add('d-none');
  }
}

/**
 * Confirms delete operation
 */
function confirmDeleteData() {
  // Set symbol in confirmation modal
  deleteSymbolElement.textContent = stockSymbol;
  
  // Show the confirmation modal using Bootstrap's Modal API
  const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
  deleteModal.show();
}

/**
 * Deletes historical data
 */
async function deleteData() {
  try {
    // Hide the modal
    document.getElementById('deleteConfirmModal').querySelector('.btn-close').click();
    
    // Show loading indicator
    dataResultElement.innerHTML = 'Deleting historical data...';
    
    // Make API request to delete historical data
    const response = await fetch('/delete-historical-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ symbol: stockSymbol })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete historical data');
    }
    
    // Show success message
    dataResultElement.innerHTML = `
      <div class="alert alert-success">
        ${result.message}
      </div>
    `;
    
    // Reload stock data
    setTimeout(loadStockData, 1000);
  } catch (error) {
    console.error('Error deleting data:', error);
    dataResultElement.innerHTML = `
      <div class="alert alert-danger">
        Error deleting data: ${error.message}
      </div>
    `;
  }
}

/**
 * Loads stock settings from server
 */
async function loadStockSettings() {
  try {
    const response = await fetch('/load-settings');
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const settings = await response.json();
    
    // Check if this stock exists in settings
    if (settings.stocks && settings.stocks[stockSymbol]) {
      const stockSettings = settings.stocks[stockSymbol];
      
      // Update input fields if values exist
      if (stockSettings.expectedReturn !== undefined) {
        expectedReturnInput.value = stockSettings.expectedReturn;
      }
      
      if (stockSettings.volatility !== undefined) {
        volatilityInput.value = stockSettings.volatility;
      }
    }
  } catch (error) {
    console.error('Error loading stock settings:', error);
  }
}

/**
 * Calculates an appropriate step size for chart y-axis
 */
function calculateStepSize(range) {
  const magnitudeOrder = Math.floor(Math.log10(range));
  const magnitude = Math.pow(10, magnitudeOrder);
  
  if (range / magnitude < 2) {
    return magnitude / 5;
  } else if (range / magnitude < 5) {
    return magnitude / 2;
  } else {
    return magnitude;
  }
}

/**
 * Formats a date string for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  
  if (isNaN(date.getTime())) {
    return dateStr; // Return as is if invalid
  }
  
  return date.toLocaleDateString();
}

/**
 * Shows a message in the message area
 */
function showMessage(message, type = 'info') {
  messageArea.className = `alert alert-${type} mb-4`;
  messageArea.innerHTML = message;
  messageArea.classList.remove('d-none');
  
  // Hide after 5 seconds for success/info messages
  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      messageArea.classList.add('d-none');
    }, 5000);
  }
}