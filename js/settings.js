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
const calculateCorrelationButton = document.getElementById('calculateCorrelationButton');
const correlationSpinner = document.getElementById('correlationSpinner');
const correlationMatrixContainer = document.getElementById('correlationMatrixContainer');
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
  calculateCorrelationButton.addEventListener('click', calculateAllPortfolioValues);
  
  // Initialize with default values
  loadDefaultSettings();
  
  // Try to load saved settings if they exist
  loadSavedSettings(false);
});

/**
 * Updates stock parameters based on historical price data and calculates correlation matrix
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
  
  // First, calculate volatility and expected returns
  fetch('/calculate-volatility', {
    method: 'POST'
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to calculate volatility metrics');
  })
  .then(volatilityData => {
    // Now calculate correlation matrix
    return fetch('/calculate-correlation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ symbols })
    }).then(response => {
      if (response.ok) {
        return response.json().then(correlationData => {
          return { volatilityData, correlationData };
        });
      }
      throw new Error('Failed to calculate correlation matrix');
    });
  })
  .then(({ volatilityData, correlationData }) => {
    // Hide spinner
    historicalDataSpinner.classList.add('d-none');
    updateHistoricalDataButton.disabled = false;
    
    // Show success message
    historicalDataResult.innerHTML = '<div class="alert alert-success">Successfully updated stock parameters based on historical data!</div>';
    
    // Create table with results
    if (volatilityData.metrics) {
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
            ${Object.keys(volatilityData.metrics).map(symbol => `
              <tr>
                <td>${symbol}</td>
                <td>${(volatilityData.metrics[symbol].expectedReturn * 100).toFixed(2)}</td>
                <td>${(volatilityData.metrics[symbol].volatility * 100).toFixed(2)}</td>
                <td>${volatilityData.metrics[symbol].synthetic ? 
                  '<span class="badge bg-warning text-dark">Estimated</span>' : 
                  '<span class="badge bg-success">Historical</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      historicalDataResult.innerHTML += tableHTML;
    }
    
    // Save correlation matrix to settings
    if (correlationData.success && correlationData.correlationMatrix) {
      // Load existing settings
      fetch('/load-settings')
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          return { stocks: {}, riskFreeRate: 4.5 };
        })
        .then(settings => {
          // Add correlation matrix and other calculated values to settings
          settings.correlationMatrix = correlationData.correlationMatrix;
          settings.symbols = correlationData.symbols;
          
          // Add expected returns and volatility if not already in settings
          if (correlationData.expectedReturns && correlationData.volatility) {
            Object.keys(correlationData.expectedReturns).forEach(symbol => {
              if (!settings.stocks[symbol]) {
                settings.stocks[symbol] = {};
              }
              settings.stocks[symbol].expectedReturn = Math.round(correlationData.expectedReturns[symbol] * 100);
              settings.stocks[symbol].volatility = Math.round(correlationData.volatility[symbol] * 100);
            });
          }
          
          // Save updated settings
          return fetch('/save-settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
          });
        })
        .then(response => {
          if (response.ok) {
            // Reload settings to show updated values
            loadSavedSettings();
            
            // Show correlation matrix success message
            historicalDataResult.innerHTML += '<div class="alert alert-success mt-3">Successfully saved correlation matrix to settings!</div>';
          } else {
            throw new Error('Failed to save settings with correlation matrix');
          }
        })
        .catch(error => {
          console.error('Error saving correlation matrix to settings:', error);
          historicalDataResult.innerHTML += `<div class="alert alert-warning mt-3">Warning: Successfully updated volatility and returns, but failed to save correlation matrix: ${error.message}</div>`;
        });
    }
    
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
      
      // Display correlation matrix if available
      if (data.correlationMatrix && data.symbols) {
        displayCorrelationMatrix(data.correlationMatrix, data.symbols);
      }
      
      showMessage('Loaded saved settings', 'success');
    })
    .catch(error => {
      console.error('Error:', error);
      if (showErrorMessage) {
        showMessage('Error loading settings: ' + error.message, 'error');
      }
    });
}

/**
 * Calculates and saves all portfolio parameters needed for Kelly optimization
 */
function calculateAllPortfolioValues() {
  // Get symbols from current stocks
  const symbols = Object.keys(currentStocks);
  
  if (symbols.length === 0) {
    showMessage('No stocks to analyze. Please add some stocks first.', 'error');
    return;
  }
  
  // Show spinner and disable button
  correlationSpinner.classList.remove('d-none');
  calculateCorrelationButton.disabled = true;
  
  // Clear container and show loading message
  correlationMatrixContainer.innerHTML = '<div class="alert alert-info">Calculating portfolio values from historical data. This may take a minute...</div>';
  
  // Add initial debug message
  const initialDebug = document.createElement('div');
  initialDebug.className = 'alert alert-info mt-2';
  initialDebug.innerHTML = '<strong>Process Started:</strong> Beginning portfolio calculation process. This may take 1-2 minutes to complete.';
  correlationMatrixContainer.appendChild(initialDebug);
  
  // Show timeout info for very long operations
  const timeoutMsg = document.createElement('div');
  timeoutMsg.className = 'alert alert-warning mt-2';
  timeoutMsg.innerHTML = '<strong>Note:</strong> If the calculation takes more than 2 minutes, there might be a server issue. You can try refreshing the page and trying again.';
  correlationMatrixContainer.appendChild(timeoutMsg);
  
  // Start overall timer
  const processStartTime = new Date().getTime();
  
  // Make a single API call to calculate all portfolio values on the server
  fetch('/calculate-all-portfolio-values', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      symbols,
      riskFreeRate: currentRiskFreeRate
    })
  })
  .then(response => {
    const endTime = new Date().getTime();
    const duration = (endTime - processStartTime) / 1000;
    
    const statusMsg = document.createElement('div');
    statusMsg.className = 'alert alert-secondary mt-2';
    statusMsg.innerHTML = `<strong>Server Response:</strong> Received after ${duration.toFixed(1)} seconds. Status: ${response.status}`;
    correlationMatrixContainer.appendChild(statusMsg);
    
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  })
  .then(calculationResult => {
    console.log('Portfolio calculation result:', calculationResult);
    
    // Calculate total process time
    const processEndTime = new Date().getTime();
    const totalProcessTime = (processEndTime - processStartTime) / 1000;
    
    // Update our local data with the returned settings
    if (calculationResult.settingsData) {
      // Get the updated settings from the server
      const updatedSettings = calculationResult.settingsData;
      
      // Update current stocks and risk-free rate
      if (updatedSettings.stocks) {
        currentStocks = updatedSettings.stocks;
      }
      
      if (updatedSettings.riskFreeRate) {
        currentRiskFreeRate = updatedSettings.riskFreeRate;
        riskFreeRateInput.value = currentRiskFreeRate;
      }
      
      // Update UI
      updateStockTable();
      
      // Hide spinner and enable button
      correlationSpinner.classList.add('d-none');
      calculateCorrelationButton.disabled = false;
      
      // Normal flow - clear container and show success
      correlationMatrixContainer.innerHTML = '';
      
      // Add completion time message
      const timeMsg = document.createElement('div');
      timeMsg.className = 'alert alert-info';
      timeMsg.innerHTML = `<strong>Calculation Complete:</strong> Total process time: ${totalProcessTime.toFixed(1)} seconds.`;
      correlationMatrixContainer.appendChild(timeMsg);
      
      // Add success message
      const successAlert = document.createElement('div');
      successAlert.className = 'alert alert-success';
      successAlert.textContent = calculationResult.message || 'Successfully calculated and saved all portfolio values for Kelly optimization!';
      correlationMatrixContainer.appendChild(successAlert);
      
      // Add calculation summary
      const summaryDiv = document.createElement('div');
      summaryDiv.innerHTML = createCalculationSummary(updatedSettings);
      correlationMatrixContainer.appendChild(summaryDiv);
      
      // Add correlation matrix
      if (updatedSettings.correlationMatrix && updatedSettings.symbols) {
        const matrixDiv = document.createElement('div');
        displayCorrelationMatrix(updatedSettings.correlationMatrix, updatedSettings.symbols, matrixDiv);
        correlationMatrixContainer.appendChild(matrixDiv);
      }
      
      showMessage('Portfolio values calculated and saved successfully', 'success');
    } else {
      // No settings data returned, show warning
      const warningAlert = document.createElement('div');
      warningAlert.className = 'alert alert-warning';
      warningAlert.textContent = 'Calculation completed but no settings data returned. Some features may not work correctly.';
      correlationMatrixContainer.appendChild(warningAlert);
      
      // Hide spinner and enable button
      correlationSpinner.classList.add('d-none');
      calculateCorrelationButton.disabled = false;
    }
  })
  .catch(error => {
    console.error('Error calculating portfolio values:', error);
    
    // Calculate elapsed time even on error
    const processEndTime = new Date().getTime();
    const totalProcessTime = (processEndTime - processStartTime) / 1000;
    
    // Hide spinner and enable button
    correlationSpinner.classList.add('d-none');
    calculateCorrelationButton.disabled = false;
    
    // Add a div for the error instead of replacing all content
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger';
    errorDiv.innerHTML = `<strong>Error:</strong> Failed to calculate portfolio values: ${error.message}`;
    correlationMatrixContainer.appendChild(errorDiv);
    
    // Add time info
    const timeErrorMsg = document.createElement('div');
    timeErrorMsg.className = 'alert alert-secondary';
    timeErrorMsg.innerHTML = `<strong>Debug:</strong> Process failed after ${totalProcessTime.toFixed(1)} seconds.`;
    correlationMatrixContainer.appendChild(timeErrorMsg);
    
    // Add recovery suggestion
    const recoveryMsg = document.createElement('div');
    recoveryMsg.className = 'alert alert-info';
    recoveryMsg.innerHTML = '<strong>Suggestion:</strong> Try refreshing the page and attempting the calculation again with fewer stocks.';
    correlationMatrixContainer.appendChild(recoveryMsg);
    
    showMessage('Error calculating portfolio values: ' + error.message, 'error');
  });
}

// These functions have been replaced by a single server call to /calculate-all-portfolio-values
// The implementation is now directly in the calculateAllPortfolioValues function

/**
 * Saves settings to the server
 * @param {Object} settings - The settings to save
 * @returns {Promise} - Promise with save result
 */
function saveSettings(settings) {
  // Add visual debug message
  const debugMsg = document.createElement('div');
  debugMsg.className = 'alert alert-secondary mt-2';
  debugMsg.innerHTML = '<strong>Debug:</strong> Saving portfolio settings to server...';
  correlationMatrixContainer.appendChild(debugMsg);
  
  // Add a manual continue button in case it gets stuck
  const continueButton = document.createElement('button');
  continueButton.className = 'btn btn-warning mt-2';
  continueButton.textContent = 'Continue Without Saving';
  continueButton.style.display = 'none';
  
  let saveTimeoutId;
  let resolvePromise;
  
  // Create a promise that can be resolved manually
  const manualPromise = new Promise((resolve) => {
    resolvePromise = resolve;
    
    // Show the continue button after a delay of 10 seconds
    saveTimeoutId = setTimeout(() => {
      continueButton.style.display = 'block';
      debugMsg.className = 'alert alert-warning mt-2';
      debugMsg.innerHTML = '<strong>Warning:</strong> The save operation is taking longer than expected. You can continue without saving if needed.';
    }, 10000);
    
    // Set up event handler for the continue button
    continueButton.addEventListener('click', () => {
      debugMsg.className = 'alert alert-danger mt-2';
      debugMsg.innerHTML = '<strong>Notice:</strong> Continuing without saving. Your changes may not be persisted.';
      // Return a fake successful response
      resolve({ success: true, message: 'Continued without saving', manual: true });
    });
  });
  
  // Add the continue button after the debug message
  correlationMatrixContainer.appendChild(continueButton);
  
  // Start timer for performance debugging
  const startTime = new Date().getTime();
  
  // Create a normal fetch promise
  const fetchPromise = fetch('/save-settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  })
  .then(response => {
    // Clear the timeout since we got a response
    clearTimeout(saveTimeoutId);
    // Hide the continue button
    continueButton.style.display = 'none';
    
    const endTime = new Date().getTime();
    const duration = (endTime - startTime) / 1000;
    
    debugMsg.innerHTML = `<strong>Debug:</strong> Settings saved after ${duration.toFixed(1)} seconds. Status: ${response.status}`;
    
    if (!response.ok) {
      debugMsg.className = 'alert alert-warning mt-2';
      throw new Error(`Failed to save settings. Server returned status: ${response.status}`);
    }
    
    // Show that we got to this point
    debugMsg.className = 'alert alert-success mt-2';
    
    // Resolve the manual promise too
    resolvePromise(response.json());
    
    return response.json();
  })
  .catch(error => {
    // Clear the timeout
    clearTimeout(saveTimeoutId);
    
    debugMsg.className = 'alert alert-danger mt-2';
    debugMsg.innerHTML = `<strong>Debug Error:</strong> ${error.message}`;
    
    throw error;
  });
  
  // Return a promise that resolves when either the fetch completes or manual continuation happens
  return Promise.race([fetchPromise, manualPromise]);
}

/**
 * Creates a summary of the calculated portfolio values
 * @param {Object} settings - The updated settings object
 * @returns {string} - HTML summary table
 */
function createCalculationSummary(settings) {
  if (!settings || !settings.stocks || Object.keys(settings.stocks).length === 0) {
    return '';
  }
  
  const symbols = settings.symbols || Object.keys(settings.stocks);
  
  let tableHTML = `
    <h5 class="mt-4 mb-2">Portfolio Parameters Summary</h5>
    <table class="table table-striped table-hover table-sm">
      <thead class="table-light">
        <tr>
          <th>Stock</th>
          <th>Expected Return (%)</th>
          <th>Volatility (%)</th>
          <th>Risk/Return Ratio</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  for (const symbol of symbols) {
    if (settings.stocks[symbol]) {
      const expectedReturn = settings.stocks[symbol].expectedReturn;
      const volatility = settings.stocks[symbol].volatility;
      
      // Calculate risk/return ratio (reward per unit of risk)
      const riskReturnRatio = volatility > 0 ? (expectedReturn / volatility).toFixed(2) : 'N/A';
      
      tableHTML += `
        <tr>
          <td>${symbol}</td>
          <td>${expectedReturn ? expectedReturn.toFixed(1) : 'N/A'}</td>
          <td>${volatility ? volatility.toFixed(1) : 'N/A'}</td>
          <td>${riskReturnRatio}</td>
        </tr>
      `;
    }
  }
  
  tableHTML += `
      </tbody>
    </table>
    <div class="mt-2 mb-4">
      <small class="text-muted">Risk/Return Ratio = Expected Return / Volatility (higher is better)</small>
    </div>
  `;
  
  return tableHTML;
}

/**
 * Displays a correlation matrix
 * @param {Array} matrix - The correlation matrix
 * @param {Array} symbols - The stock symbols
 * @param {HTMLElement} container - Optional container element to display the matrix in
 */
function displayCorrelationMatrix(matrix, symbols, container = null) {
  if (!matrix || !symbols || matrix.length === 0 || symbols.length === 0) {
    return;
  }
  
  // Use provided container or default to correlationMatrixContainer
  const targetContainer = container || correlationMatrixContainer;
  
  // Create HTML table
  let tableHTML = `
    <h5 class="mt-3 mb-2">Correlation Matrix</h5>
    <table class="table table-sm table-bordered">
      <thead>
        <tr>
          <th></th>
          ${symbols.map(symbol => `<th>${symbol}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;
  
  // Add rows for each symbol
  for (let i = 0; i < symbols.length; i++) {
    tableHTML += `<tr><th>${symbols[i]}</th>`;
    
    // Add cells for each correlation value
    for (let j = 0; j < symbols.length; j++) {
      const value = matrix[i][j];
      
      // Color coding for correlation values
      let cellClass = '';
      let displayValue = 'N/A';
      
      if (value === null || value === undefined) {
        cellClass = 'table-secondary'; // Missing data
      } else if (i === j) {
        cellClass = 'table-light'; // Diagonal (self correlation = 1)
        displayValue = value.toFixed(2);
      } else if (value >= 0.7) {
        cellClass = 'table-danger'; // High correlation
        displayValue = value.toFixed(2);
      } else if (value >= 0.4) {
        cellClass = 'table-warning'; // Medium correlation
        displayValue = value.toFixed(2);
      } else if (typeof value === 'number') {
        cellClass = 'table-success'; // Low correlation
        displayValue = value.toFixed(2);
      }
      
      tableHTML += `<td class="${cellClass}">${displayValue}</td>`;
    }
    
    tableHTML += '</tr>';
  }
  
  tableHTML += '</tbody></table>';
  
  // Add explanatory legend
  tableHTML += `
    <div class="mt-2 small">
      <span class="badge bg-success">< 0.4: Low correlation</span>
      <span class="badge bg-warning text-dark">0.4 - 0.7: Medium correlation</span>
      <span class="badge bg-danger">≥ 0.7: High correlation</span>
      <span class="badge bg-secondary">N/A: Missing data</span>
    </div>
    <div class="mt-2">
      <small class="text-muted">Note: If any values are missing, try updating historical data for those stocks.</small>
    </div>
  `;
  
  // Add to target container
  targetContainer.innerHTML = tableHTML;
}
