/**
 * Stock Settings Manager for Kelly Criterion Portfolio Allocation
 * 
 * This script provides functionality to manage stock parameters (expected returns and volatility)
 * and save/load these settings from a file.
 */

// Default stock data
const defaultStocks = {
  'TSLA': { expectedReturn: 15, volatility: 55 },
  'NVDA': { expectedReturn: 25, volatility: 45 },
  'CPNG': { expectedReturn: 12, volatility: 40 },
  'SHOP': { expectedReturn: 18, volatility: 50 },
  'MELI': { expectedReturn: 20, volatility: 45 }
};

// Default risk-free rate
const defaultRiskFreeRate = 4.5;

// Current stock data (will be populated on page load)
let currentStocks = {};
let currentRiskFreeRate = defaultRiskFreeRate;

// DOM Elements
const stockTableBody = document.getElementById('stockTableBody');
const riskFreeRateInput = document.getElementById('riskFreeRate');
const loadDefaultsButton = document.getElementById('loadDefaultsButton');
const loadSavedButton = document.getElementById('loadSavedButton');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const addStockButton = document.getElementById('addStockButton');
const newStockSymbol = document.getElementById('newStockSymbol');
const newStockReturn = document.getElementById('newStockReturn');
const newStockVolatility = document.getElementById('newStockVolatility');
const messageArea = document.getElementById('messageArea');
const updateHistoricalDataButton = document.getElementById('updateHistoricalDataButton');
const historicalDataSpinner = document.getElementById('historicalDataSpinner');
const historicalDataResult = document.getElementById('historicalDataResult');

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  // Set up event listeners
  loadDefaultsButton.addEventListener('click', loadDefaultSettings);
  loadSavedButton.addEventListener('click', loadSavedSettings);
  saveSettingsButton.addEventListener('click', saveCurrentSettings);
  addStockButton.addEventListener('click', addNewStock);
  riskFreeRateInput.addEventListener('change', updateRiskFreeRate);
  updateHistoricalDataButton.addEventListener('click', updateFromHistoricalData);
  
  // Initialize with default values
  loadDefaultSettings();
  
  // Try to load saved settings if they exist
  loadSavedSettings(false);
});

/**
 * Updates stock parameters based on historical price data
 */
function updateFromHistoricalData() {
  // Get symbols from current stocks
  const symbols = Object.keys(currentStocks);
  
  if (symbols.length === 0) {
    showMessage('No stocks to update. Please add some stocks first.', 'error');
    return;
  }
  
  // Show spinner
  historicalDataSpinner.classList.remove('d-none');
  updateHistoricalDataButton.disabled = true;
  historicalDataResult.innerHTML = '<div class="alert alert-info">Fetching and analyzing historical price data. This may take a minute...</div>';
  
  // Send request to update historical data
  fetch('/update-historical-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ symbols })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to update historical data');
  })
  .then(data => {
    // Hide spinner
    historicalDataSpinner.classList.add('d-none');
    updateHistoricalDataButton.disabled = false;
    
    // Show success message
    historicalDataResult.innerHTML = '<div class="alert alert-success">Successfully updated stock parameters based on historical data!</div>';
    
    // Create table with results
    if (data.summary) {
      const tableHTML = `
        <table class="table table-striped table-sm">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Historical Expected Return (%)</th>
              <th>Historical Volatility (%)</th>
              <th>Data Source</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(data.summary).map(symbol => `
              <tr>
                <td>${symbol}</td>
                <td>${data.summary[symbol].expectedReturn}</td>
                <td>${data.summary[symbol].volatility}</td>
                <td>${data.summary[symbol].synthetic ? 
                  '<span class="badge bg-warning text-dark">Estimated</span>' : 
                  '<span class="badge bg-success">Historical</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      historicalDataResult.innerHTML += tableHTML;
    }
    
    // Reload settings to show updated values
    loadSavedSettings();
    
    showMessage('Updated stock parameters with historical data', 'success');
  })
  .catch(error => {
    // Hide spinner
    historicalDataSpinner.classList.add('d-none');
    updateHistoricalDataButton.disabled = false;
    
    // Show error message
    historicalDataResult.innerHTML = `<div class="alert alert-danger">Error updating historical data: ${error.message}</div>`;
    console.error('Error:', error);
    showMessage('Error updating historical data: ' + error.message, 'error');
  });
}

/**
 * Shows a message to the user
 * @param {string} message - The message to display
 * @param {string} type - 'success' or 'error'
 */
function showMessage(message, type) {
  messageArea.textContent = message;
  messageArea.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
  messageArea.classList.remove('d-none');
  
  // Hide the message after 3 seconds
  setTimeout(() => {
    messageArea.classList.add('d-none');
  }, 3000);
}

/**
 * Updates the stock table with current data
 */
function updateStockTable() {
  // Clear existing rows
  stockTableBody.innerHTML = '';
  
  // Add a row for each stock
  for (const symbol in currentStocks) {
    const stockData = currentStocks[symbol];
    const newRow = document.createElement('tr');
    newRow.className = 'stock-row';
    newRow.innerHTML = `
      <td>${symbol}</td>
      <td>
        <input type="number" class="form-control return-input" data-symbol="${symbol}" 
               value="${stockData.expectedReturn}" step="0.1" min="0" max="100"
               style="min-width: 100px; max-width: 150px;">
      </td>
      <td>
        <input type="number" class="form-control volatility-input" data-symbol="${symbol}" 
               value="${stockData.volatility}" step="0.1" min="0" max="100"
               style="min-width: 100px; max-width: 150px;">
      </td>
      <td>
        <button class="btn btn-danger btn-sm remove-stock" data-symbol="${symbol}">
          <i class="bi bi-trash"></i> Remove
        </button>
      </td>
    `;
    stockTableBody.appendChild(newRow);
  }
  
  // Add event listeners to the new inputs and buttons
  document.querySelectorAll('.return-input').forEach(input => {
    input.addEventListener('change', updateStockReturn);
  });
  
  document.querySelectorAll('.volatility-input').forEach(input => {
    input.addEventListener('change', updateStockVolatility);
  });
  
  document.querySelectorAll('.remove-stock').forEach(button => {
    button.addEventListener('click', removeStock);
  });
}

/**
 * Updates the expected return for a stock
 * @param {Event} event - The change event
 */
function updateStockReturn(event) {
  const symbol = event.target.dataset.symbol;
  const newValue = parseFloat(event.target.value);
  
  if (isNaN(newValue) || newValue < 0 || newValue > 100) {
    showMessage('Expected return must be between 0 and 100%', 'error');
    event.target.value = currentStocks[symbol].expectedReturn;
    return;
  }
  
  currentStocks[symbol].expectedReturn = newValue;
}

/**
 * Updates the volatility for a stock
 * @param {Event} event - The change event
 */
function updateStockVolatility(event) {
  const symbol = event.target.dataset.symbol;
  const newValue = parseFloat(event.target.value);
  
  if (isNaN(newValue) || newValue < 0 || newValue > 100) {
    showMessage('Volatility must be between 0 and 100%', 'error');
    event.target.value = currentStocks[symbol].volatility;
    return;
  }
  
  currentStocks[symbol].volatility = newValue;
}

/**
 * Updates the risk-free rate
 * @param {Event} event - The change event
 */
function updateRiskFreeRate(event) {
  const newValue = parseFloat(event.target.value);
  
  if (isNaN(newValue) || newValue < 0 || newValue > 20) {
    showMessage('Risk-free rate must be between 0 and 20%', 'error');
    event.target.value = currentRiskFreeRate;
    return;
  }
  
  currentRiskFreeRate = newValue;
}

/**
 * Removes a stock from the current settings
 * @param {Event} event - The click event
 */
function removeStock(event) {
  const symbol = event.target.dataset.symbol;
  
  // Remove the stock from the current stocks object
  delete currentStocks[symbol];
  
  // Update the table
  updateStockTable();
  
  showMessage(`Removed ${symbol} from settings`, 'success');
}

/**
 * Adds a new stock to the current settings
 */
function addNewStock() {
  const symbol = newStockSymbol.value.trim().toUpperCase();
  const expectedReturn = parseFloat(newStockReturn.value);
  const volatility = parseFloat(newStockVolatility.value);
  
  // Validate input
  if (!symbol) {
    showMessage('Please enter a stock symbol', 'error');
    return;
  }
  
  if (isNaN(expectedReturn) || expectedReturn < 0 || expectedReturn > 100) {
    showMessage('Expected return must be between 0 and 100%', 'error');
    return;
  }
  
  if (isNaN(volatility) || volatility < 0 || volatility > 100) {
    showMessage('Volatility must be between 0 and 100%', 'error');
    return;
  }
  
  // Check if the stock already exists
  if (currentStocks[symbol]) {
    showMessage(`${symbol} already exists in your settings`, 'error');
    return;
  }
  
  // Add the new stock
  currentStocks[symbol] = {
    expectedReturn: expectedReturn,
    volatility: volatility
  };
  
  // Update the table
  updateStockTable();
  
  // Clear the input fields
  newStockSymbol.value = '';
  newStockReturn.value = '';
  newStockVolatility.value = '';
  
  showMessage(`Added ${symbol} to settings`, 'success');
}

/**
 * Loads default stock settings
 */
function loadDefaultSettings() {
  // Deep copy the default stocks to avoid reference issues
  currentStocks = JSON.parse(JSON.stringify(defaultStocks));
  currentRiskFreeRate = defaultRiskFreeRate;
  
  // Update the UI
  riskFreeRateInput.value = currentRiskFreeRate;
  updateStockTable();
  
  showMessage('Loaded default settings', 'success');
}

/**
 * Saves current settings to the server
 */
function saveCurrentSettings() {
  // Prepare the data to save
  const settingsData = {
    stocks: currentStocks,
    riskFreeRate: currentRiskFreeRate
  };
  
  // Convert to JSON string
  const jsonData = JSON.stringify(settingsData, null, 2);
  
  // Send to server to save as a file
  fetch('/save-settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: jsonData
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to save settings');
  })
  .then(data => {
    showMessage('Settings saved successfully', 'success');
  })
  .catch(error => {
    console.error('Error:', error);
    showMessage('Error saving settings: ' + error.message, 'error');
  });
}

/**
 * Loads saved settings from the server
 * @param {boolean} showErrorMessage - Whether to show an error message if no saved settings exist
 */
function loadSavedSettings(showErrorMessage = true) {
  fetch('/load-settings')
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('No saved settings found');
    })
    .then(data => {
      // Update current stocks with loaded data
      currentStocks = data.stocks;
      currentRiskFreeRate = data.riskFreeRate;
      
      // Update the UI
      riskFreeRateInput.value = currentRiskFreeRate;
      updateStockTable();
      
      showMessage('Loaded saved settings', 'success');
    })
    .catch(error => {
      console.error('Error:', error);
      if (showErrorMessage) {
        showMessage('Error loading settings: ' + error.message, 'error');
      }
    });
}
