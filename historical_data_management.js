/**
 * Historical Data Management
 * 
 * This module provides UI functionality for managing historical stock data
 * and calculating volatility metrics.
 */

// DOM Elements
const dataStatusTableBody = document.getElementById('dataStatusTableBody');
const newStockSymbol = document.getElementById('newStockSymbol');
const dataYears = document.getElementById('dataYears');
const fetchDataButton = document.getElementById('fetchDataButton');
const calculateVolatilityButton = document.getElementById('calculateVolatilityButton');
const calculateSpecificVolatilityButton = document.getElementById('calculateSpecificVolatilityButton');
const volatilitySpinner = document.getElementById('volatilitySpinner');
const specificVolatilitySpinner = document.getElementById('specificVolatilitySpinner');
const volatilityResult = document.getElementById('volatilityResult');
const messageArea = document.getElementById('messageArea');
const onDemandSymbol = document.getElementById('onDemandSymbol');
const dataAvailabilitySymbol = document.getElementById('dataAvailabilitySymbol');
const checkDataAvailabilityButton = document.getElementById('checkDataAvailabilityButton');
const dataAvailabilitySpinner = document.getElementById('dataAvailabilitySpinner');
const dataAvailabilityResult = document.getElementById('dataAvailabilityResult');
const saveToSettingsButton = document.getElementById('saveToSettingsButton');

// Store the latest calculation results
let latestCalculationResults = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM content loaded"); // Debug log
  
  // Do an immediate population of dropdowns with any stocks we can find
  const stockOptions = [];
  document.querySelectorAll('#dataStatusTableBody tr').forEach(row => {
    const symbol = row.cells?.[0]?.textContent;
    if (symbol && symbol !== 'No historical data available. Add stocks to get started.') {
      stockOptions.push(symbol);
    }
  });
  
  if (stockOptions.length > 0) {
    console.log("Found initial stocks:", stockOptions);
    populateStockDropdownsWithOptions(stockOptions);
  }
  
  // Set up event listeners - with verification
  console.log("Setting up event listeners");
  console.log("fetchDataButton:", fetchDataButton);
  console.log("calculateVolatilityButton:", calculateVolatilityButton);
  console.log("calculateSpecificVolatilityButton:", calculateSpecificVolatilityButton);
  console.log("checkDataAvailabilityButton:", checkDataAvailabilityButton);
  console.log("saveToSettingsButton:", saveToSettingsButton);
  
  if (fetchDataButton) {
    fetchDataButton.addEventListener('click', fetchNewStockData);
  }
  
  if (calculateVolatilityButton) {
    calculateVolatilityButton.addEventListener('click', calculateVolatility);
  }
  
  if (calculateSpecificVolatilityButton) {
    console.log("Adding event listener to calculateSpecificVolatilityButton");
    calculateSpecificVolatilityButton.addEventListener('click', calculateSpecificVolatility);
  }
  
  if (checkDataAvailabilityButton) {
    console.log("Adding event listener to checkDataAvailabilityButton");
    checkDataAvailabilityButton.addEventListener('click', checkDataAvailability);
  }
  
  if (saveToSettingsButton) {
    console.log("Adding event listener to saveToSettingsButton");
    saveToSettingsButton.addEventListener('click', saveCalculationsToSettings);
  }
  
  // Load current data status
  loadDataStatus()
    .then(() => {
      console.log("Data status loaded, populating dropdowns");
      // Populate stock select dropdowns after loading status
      populateStockDropdowns();
    });
});

/**
 * Saves the latest volatility and expected return calculations to the settings file
 */
function saveCalculationsToSettings() {
  if (!latestCalculationResults) {
    showMessage('No calculation results available to save', 'error');
    return;
  }
  
  // Show loading state
  saveToSettingsButton.disabled = true;
  saveToSettingsButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
  
  // First load current settings
  fetch('/load-settings')
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      // If no settings file, create a new one
      return { riskFreeRate: 4.5, stocks: {} };
    })
    .then(settings => {
      // Update or create stock entry
      if (!settings.stocks) {
        settings.stocks = {};
      }
      
      // Check if we have all stocks or just one
      if (latestCalculationResults.metrics) {
        // Multiple stocks
        for (const symbol in latestCalculationResults.metrics) {
          const metrics = latestCalculationResults.metrics[symbol];
          
          // Create entry if it doesn't exist
          if (!settings.stocks[symbol]) {
            settings.stocks[symbol] = {};
          }
          
          // Update values
          settings.stocks[symbol].volatility = Math.round(metrics.volatility * 100);
          settings.stocks[symbol].expectedReturn = Math.round(metrics.expectedReturn * 100);
        }
      } else {
        // Single stock
        const symbol = latestCalculationResults.symbol;
        
        // Create entry if it doesn't exist
        if (!settings.stocks[symbol]) {
          settings.stocks[symbol] = {};
        }
        
        // Update values
        settings.stocks[symbol].volatility = Math.round(latestCalculationResults.volatility * 100);
        settings.stocks[symbol].expectedReturn = Math.round(latestCalculationResults.expectedReturn * 100);
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
        return response.json();
      }
      throw new Error('Failed to save settings');
    })
    .then(result => {
      // Reset button
      saveToSettingsButton.disabled = false;
      saveToSettingsButton.innerHTML = '<i class="bi bi-save"></i> Save to Settings File';
      
      if (result.success) {
        showMessage('Successfully saved calculations to settings file', 'success');
      } else {
        showMessage(result.error || 'Error saving settings', 'error');
      }
    })
    .catch(error => {
      // Reset button
      saveToSettingsButton.disabled = false;
      saveToSettingsButton.innerHTML = '<i class="bi bi-save"></i> Save to Settings File';
      
      console.error('Error saving calculations:', error);
      showMessage('Error saving calculations: ' + error.message, 'error');
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
 * Loads and displays the status of historical data
 * @returns {Promise} - Promise that resolves when data is loaded
 */
function loadDataStatus() {
  return new Promise((resolve, reject) => {
    fetch('/data-status')
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to load data status');
      })
      .then(data => {
        updateDataStatusTable(data);
        resolve(data);
      })
      .catch(error => {
        console.error('Error:', error);
        showMessage('Error loading data status: ' + error.message, 'error');
        reject(error);
      });
  });
}

/**
 * Updates the data status table with current information
 * @param {Object} data - Data status information
 */
function updateDataStatusTable(data) {
  dataStatusTableBody.innerHTML = '';
  
  if (!data.stocks || Object.keys(data.stocks).length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="7" class="text-center">No historical data available. Add stocks to get started.</td>
    `;
    dataStatusTableBody.appendChild(row);
    return;
  }
  
  for (const symbol in data.stocks) {
    const stockInfo = data.stocks[symbol];
    const row = document.createElement('tr');
    
    // Determine data status
    let statusText = '';
    let statusClass = '';
    if (stockInfo.dataComplete) {
      statusText = '<i class="bi bi-check-circle-fill"></i> Complete';
      statusClass = 'status-complete';
    } else if (stockInfo.dataPoints === 0) {
      statusText = '<i class="bi bi-x-circle-fill"></i> No Data';
      statusClass = 'status-incomplete';
    } else {
      statusText = '<i class="bi bi-exclamation-triangle-fill"></i> Partial';
      statusClass = 'status-partial';
    }
    
    // Format date range
    const dateRange = stockInfo.startDate && stockInfo.endDate 
      ? `${stockInfo.startDate} to ${stockInfo.endDate}`
      : 'N/A';
      
    // Format days covered
    const daysCovered = stockInfo.dataPoints ? 
      `~${Math.round(stockInfo.dataPoints * 7 / 5)} days` : // Approximate calendar days from trading days
      'N/A';
      
    // Format gaps
    let gapsInfo = '';
    if (stockInfo.gaps && stockInfo.gaps.length > 0) {
      gapsInfo = `<span class="badge bg-warning text-dark">${stockInfo.gaps.length} gaps</span>`;
    }
    
    // Format last updated time
    const lastUpdated = stockInfo.lastUpdated 
      ? new Date(stockInfo.lastUpdated).toLocaleString()
      : 'Never';
    
    row.innerHTML = `
      <td><a href="stock_detail.html?symbol=${symbol}" class="text-decoration-none">${symbol}</a></td>
      <td class="${statusClass}">${statusText} ${gapsInfo}</td>
      <td>${stockInfo.dataPoints || 0} points</td>
      <td>${daysCovered}</td>
      <td>${dateRange}</td>
      <td>${lastUpdated}</td>
      <td>
        <button class="btn btn-sm btn-primary refresh-data-btn" data-symbol="${symbol}" title="Refresh Data">
          <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button class="btn btn-sm btn-info view-gaps-btn ${!stockInfo.gaps || stockInfo.gaps.length === 0 ? 'd-none' : ''}" 
                data-symbol="${symbol}" data-bs-toggle="modal" data-bs-target="#gapsModal" title="View Data Gaps">
          <i class="bi bi-calendar-x"></i>
        </button>
        <button class="btn btn-sm btn-danger delete-data-btn" data-symbol="${symbol}" title="Delete Data">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    
    dataStatusTableBody.appendChild(row);
  }
  
  // Add event listeners to buttons
  document.querySelectorAll('.refresh-data-btn').forEach(button => {
    button.addEventListener('click', refreshStockData);
  });
  
  document.querySelectorAll('.view-gaps-btn').forEach(button => {
    button.addEventListener('click', viewGaps);
  });
  
  document.querySelectorAll('.delete-data-btn').forEach(button => {
    button.addEventListener('click', deleteStockData);
  });
}

/**
 * Fetches historical data for a new stock
 */
function fetchNewStockData() {
  const symbol = newStockSymbol.value.trim().toUpperCase();
  const years = parseInt(dataYears.value);
  
  if (!symbol) {
    showMessage('Please enter a stock symbol', 'error');
    return;
  }
  
  // Show loading state
  fetchDataButton.disabled = true;
  fetchDataButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Fetching...';
  
  // Send request to fetch data
  fetch('/fetch-historical-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ symbol, years })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to fetch historical data');
  })
  .then(data => {
    // Reset button
    fetchDataButton.disabled = false;
    fetchDataButton.innerHTML = 'Fetch Historical Data';
    
    if (data.success) {
      showMessage(`Successfully fetched historical data for ${symbol}`, 'success');
      newStockSymbol.value = '';
      
      // Reload data status
      loadDataStatus()
        .then(() => {
          populateStockDropdowns(); // Refresh dropdowns after data operation
        });
    } else {
      showMessage(data.error || 'Error fetching data', 'error');
    }
  })
  .catch(error => {
    // Reset button
    fetchDataButton.disabled = false;
    fetchDataButton.innerHTML = 'Fetch Historical Data';
    
    console.error('Error:', error);
    showMessage('Error fetching data: ' + error.message, 'error');
  });
}

/**
 * Refreshes historical data for a stock
 * @param {Event} event - Click event
 */
function refreshStockData(event) {
  const symbol = event.currentTarget.dataset.symbol;
  const years = 5; // Default to 5 years
  
  // Show loading state
  event.currentTarget.disabled = true;
  const originalHTML = event.currentTarget.innerHTML;
  event.currentTarget.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
  
  // Send request to fetch data
  fetch('/fetch-historical-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ symbol, years })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to refresh historical data');
  })
  .then(data => {
    // Reset button
    event.currentTarget.disabled = false;
    event.currentTarget.innerHTML = originalHTML;
    
    if (data.success) {
      showMessage(`Successfully refreshed historical data for ${symbol}`, 'success');
      
      // Reload data status
      loadDataStatus();
    } else {
      showMessage(data.error || 'Error refreshing data', 'error');
    }
  })
  .catch(error => {
    // Reset button
    event.currentTarget.disabled = false;
    event.currentTarget.innerHTML = originalHTML;
    
    console.error('Error:', error);
    showMessage('Error refreshing data: ' + error.message, 'error');
  });
}

/**
 * Displays data gaps for a stock
 * @param {Event} event - Click event
 */
function viewGaps(event) {
  const symbol = event.currentTarget.dataset.symbol;
  const modalBody = document.getElementById('gapsModalBody');
  const modalTitle = document.getElementById('gapsModalLabel');
  const fillGapsButton = document.getElementById('fillGapsButton');
  
  // Update modal title
  modalTitle.textContent = `Data Gaps for ${symbol}`;
  
  // Show loading state
  modalBody.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
  
  // Fetch current data status
  fetch('/data-status')
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Failed to load data status');
    })
    .then(data => {
      if (!data.stocks || !data.stocks[symbol] || !data.stocks[symbol].gaps || data.stocks[symbol].gaps.length === 0) {
        modalBody.innerHTML = '<div class="alert alert-success">No data gaps found for this stock!</div>';
        fillGapsButton.style.display = 'none';
        return;
      }
      
      const gaps = data.stocks[symbol].gaps;
      
      // Create gaps table
      let tableHTML = `
        <p>The following gaps were found in the historical data for ${symbol}:</p>
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Select</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Trading Days</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      gaps.forEach((gap, index) => {
        const startDate = new Date(gap.start);
        const endDate = new Date(gap.end);
        
        // Calculate approximate trading days (exclude weekends)
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const weekends = Math.floor(diffDays / 7) * 2;
        const tradingDays = diffDays - weekends;
        
        tableHTML += `
          <tr>
            <td><input type="checkbox" class="gap-checkbox" value="${index}" checked></td>
            <td>${gap.start}</td>
            <td>${gap.end}</td>
            <td>${tradingDays}</td>
          </tr>
        `;
      });
      
      tableHTML += `
          </tbody>
        </table>
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i> Selecting gaps to fill and clicking "Fill Selected Gaps" will 
          attempt to fetch the missing data for these periods.
        </div>
      `;
      
      modalBody.innerHTML = tableHTML;
      fillGapsButton.style.display = 'block';
      
      // Set up the fill gaps button
      fillGapsButton.onclick = () => fillSelectedGaps(symbol, gaps);
    })
    .catch(error => {
      console.error('Error:', error);
      modalBody.innerHTML = `<div class="alert alert-danger">Error loading gap data: ${error.message}</div>`;
      fillGapsButton.style.display = 'none';
    });
}

/**
 * Fills selected gaps for a stock
 * @param {string} symbol - Stock symbol
 * @param {Array} gaps - Array of gap objects
 */
function fillSelectedGaps(symbol, gaps) {
  const selectedGaps = Array.from(document.querySelectorAll('.gap-checkbox:checked'))
    .map(checkbox => parseInt(checkbox.value))
    .map(index => gaps[index]);
  
  if (selectedGaps.length === 0) {
    showMessage('No gaps selected', 'error');
    return;
  }
  
  const modalBody = document.getElementById('gapsModalBody');
  const fillGapsButton = document.getElementById('fillGapsButton');
  
  // Show loading state
  modalBody.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Filling data gaps...</p></div>';
  fillGapsButton.disabled = true;
  
  // Send request to fill gaps
  fetch('/fill-data-gaps', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      symbol,
      gaps: selectedGaps
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to fill data gaps');
  })
  .then(result => {
    if (result.success) {
      modalBody.innerHTML = `
        <div class="alert alert-success">
          <h5><i class="bi bi-check-circle-fill"></i> Gaps filled successfully!</h5>
          <p>${result.message}</p>
        </div>
      `;
      
      showMessage(`Successfully filled gaps for ${symbol}`, 'success');
      
      // Reload data status after a short delay
      setTimeout(() => {
        loadDataStatus()
          .then(() => {
            populateStockDropdowns(); // Refresh dropdowns after data operation
          });
      }, 1500);
    } else {
      modalBody.innerHTML = `
        <div class="alert alert-warning">
          <h5><i class="bi bi-exclamation-triangle-fill"></i> Partial success</h5>
          <p>${result.message}</p>
          <p>Some gaps may remain. Please check the data status for details.</p>
        </div>
      `;
      
      // Reload data status after a short delay
      setTimeout(() => {
        loadDataStatus();
      }, 1500);
    }
  })
  .catch(error => {
    console.error('Error:', error);
    modalBody.innerHTML = `
      <div class="alert alert-danger">
        <h5><i class="bi bi-x-circle-fill"></i> Error</h5>
        <p>Failed to fill data gaps: ${error.message}</p>
      </div>
    `;
    
    fillGapsButton.disabled = false;
  });
}

/**
 * Deletes historical data for a stock
 * @param {Event} event - Click event
 */
function deleteStockData(event) {
  const symbol = event.currentTarget.dataset.symbol;
  
  if (!confirm(`Are you sure you want to delete historical data for ${symbol}?`)) {
    return;
  }
  
  // Send request to delete data
  fetch('/delete-historical-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ symbol })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to delete historical data');
  })
  .then(data => {
    if (data.success) {
      showMessage(`Successfully deleted historical data for ${symbol}`, 'success');
      
      // Reload data status
      loadDataStatus();
    } else {
      showMessage(data.error || 'Error deleting data', 'error');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    showMessage('Error deleting data: ' + error.message, 'error');
  });
}

/**
 * Populates stock select dropdowns with given options
 * @param {Array} stockOptions - Array of stock symbols
 */
function populateStockDropdownsWithOptions(stockOptions) {
  console.log("Populating dropdowns with options:", stockOptions);
  
  // Sort alphabetically
  stockOptions.sort();
  
  // Check if the DOM elements exist before populating
  if (onDemandSymbol) {
    console.log("Populating onDemandSymbol dropdown");
    // Populate on-demand volatility dropdown
    onDemandSymbol.innerHTML = '<option value="">Select stock...</option>';
    stockOptions.forEach(symbol => {
      const option = document.createElement('option');
      option.value = symbol;
      option.textContent = symbol;
      onDemandSymbol.appendChild(option);
    });
  } else {
    console.warn("onDemandSymbol element not found");
  }
  
  if (dataAvailabilitySymbol) {
    console.log("Populating dataAvailabilitySymbol dropdown");
    // Populate data availability dropdown
    dataAvailabilitySymbol.innerHTML = '<option value="">Select stock...</option>';
    stockOptions.forEach(symbol => {
      const option = document.createElement('option');
      option.value = symbol;
      option.textContent = symbol;
      dataAvailabilitySymbol.appendChild(option);
    });
  } else {
    console.warn("dataAvailabilitySymbol element not found");
  }
  
  // Make sure event listeners are attached again if needed
  if (calculateSpecificVolatilityButton && !calculateSpecificVolatilityButton.hasEventListener) {
    console.log("Re-adding calculateSpecificVolatilityButton event listener");
    calculateSpecificVolatilityButton.addEventListener('click', calculateSpecificVolatility);
    calculateSpecificVolatilityButton.hasEventListener = true;
  }
  
  if (checkDataAvailabilityButton && !checkDataAvailabilityButton.hasEventListener) {
    console.log("Re-adding checkDataAvailabilityButton event listener");
    checkDataAvailabilityButton.addEventListener('click', checkDataAvailability);
    checkDataAvailabilityButton.hasEventListener = true;
  }
}

/**
 * Populates stock select dropdowns
 */
function populateStockDropdowns() {
  console.log("Populating stock dropdowns from data table"); // Debug log
  
  // Get all stocks from the data status table
  const stockOptions = [];
  
  document.querySelectorAll('#dataStatusTableBody tr').forEach(row => {
    const symbol = row.cells[0]?.textContent;
    if (symbol && symbol !== 'No historical data available. Add stocks to get started.') {
      stockOptions.push(symbol);
    }
  });
  
  console.log("Found stocks in table:", stockOptions); // Debug log
  
  // If no stocks found, try some defaults
  if (stockOptions.length === 0) {
    // Try to get a list of stocks from the data directory
    console.log("No stocks found in table, fetching from server...");
    fetch('/list-stocks')
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to get stock list');
      })
      .then(data => {
        if (data.stocks && data.stocks.length > 0) {
          console.log("Loaded stocks from server:", data.stocks);
          populateStockDropdownsWithOptions(data.stocks);
        }
      })
      .catch(error => {
        console.error("Error loading stocks:", error);
      });
  } else {
    // Populate with found options
    populateStockDropdownsWithOptions(stockOptions);
  }
}

/**
 * Calculates volatility for a specific stock on demand directly from JSON data
 */
function calculateSpecificVolatility() {
  console.log("Calculate specific volatility clicked"); // Debug log
  const symbol = onDemandSymbol.value;
  
  if (!symbol) {
    showMessage('Please select a stock', 'error');
    return;
  }
  
  // Show loading state
  calculateSpecificVolatilityButton.disabled = true;
  specificVolatilitySpinner.classList.remove('d-none');
  
  // First get the data availability to check if we have data
  fetch(`/data-availability?symbol=${encodeURIComponent(symbol)}`)
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to get data availability');
  })
  .then(data => {
    console.log("Got data for volatility calculation:", data); // Debug log
    
    if (!data.dataPoints || data.dataPoints < 30) {
      throw new Error(`Not enough data points for ${symbol}. Need at least 30, but only have ${data.dataPoints || 0}.`);
    }
    
    // We have enough data, now calculate volatility directly
    // Use the existing data to calculate volatility
    if (data.data && data.data.returns) {
      // We have the returns directly in the data
      return calculateVolatilityFromData(symbol, data);
    } else {
      // We need to send a request to calculate volatility
      return fetch('/calculate-volatility-on-demand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ symbol })
      })
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to calculate volatility');
      });
    }
  })
  .then(result => {
    // Reset button
    calculateSpecificVolatilityButton.disabled = false;
    specificVolatilitySpinner.classList.add('d-none');
    
    if (result.success || result.metrics) {
      showMessage(`Successfully calculated volatility for ${symbol}`, 'success');
      
      const metrics = result.metrics || result;
      
      // Add to results
      const resultHTML = `
        <div class="alert alert-success">
          <h5><i class="bi bi-check-circle"></i> Volatility Calculation Complete</h5>
          <p>Latest metrics for ${symbol}:</p>
          <ul>
            <li>Volatility: ${(metrics.volatility * 100).toFixed(2)}%</li>
            <li>Expected Return: ${(metrics.expectedReturn * 100).toFixed(2)}%</li>
            <li>Based on ${metrics.recentDataPoints || metrics.dataPoints} data points</li>
            <li>Calculation time: ${new Date().toLocaleString()}</li>
          </ul>
        </div>
      `;
      
      volatilityResult.innerHTML = resultHTML;
      
      // Save the metrics
      saveMetrics(symbol, metrics);
      
      // Reload data status to reflect updated metrics
      loadDataStatus()
        .then(() => {
          populateStockDropdowns(); // Refresh dropdowns after data operation
        });
    } else {
      volatilityResult.innerHTML = `<div class="alert alert-danger">${result.error || 'Error'}: ${result.message || 'Failed to calculate volatility'}</div>`;
    }
  })
  .catch(error => {
    // Reset button
    calculateSpecificVolatilityButton.disabled = false;
    specificVolatilitySpinner.classList.add('d-none');
    
    volatilityResult.innerHTML = `<div class="alert alert-danger">Error calculating volatility: ${error.message}</div>`;
    console.error('Error:', error);
  });
}

/**
 * Calculates volatility directly from data
 * @param {string} symbol - Stock symbol
 * @param {Object} data - Stock data
 * @returns {Object} - Calculated metrics
 */
function calculateVolatilityFromData(symbol, data) {
  // Extract returns data
  let returns = [];
  
  if (data.data && data.data.returns) {
    // Direct returns array
    returns = data.data.returns;
  } else if (data.data && data.data.prices) {
    // Calculate returns from prices
    const prices = data.data.prices;
    for (let i = 1; i < prices.length; i++) {
      const returnValue = prices[i] / prices[i-1] - 1;
      returns.push(returnValue);
    }
  }
  
  // Make sure we have enough data
  if (returns.length < 30) {
    throw new Error(`Not enough return data points for ${symbol}. Need at least 30, but only have ${returns.length}.`);
  }
  
  // Use only the most recent year (approximately 252 trading days)
  const recentReturns = returns.length > 252 ? returns.slice(-252) : returns;
  
  // Calculate volatility (standard deviation of returns * sqrt(252))
  let sum = 0;
  for (const ret of recentReturns) {
    sum += ret;
  }
  const mean = sum / recentReturns.length;
  
  let sumSquaredDiffs = 0;
  for (const ret of recentReturns) {
    sumSquaredDiffs += Math.pow(ret - mean, 2);
  }
  
  const variance = sumSquaredDiffs / (recentReturns.length - 1);
  const dailyVolatility = Math.sqrt(variance);
  const annualizedVolatility = dailyVolatility * Math.sqrt(252);
  
  // Calculate expected return
  const compoundReturn = recentReturns.reduce((product, ret) => product * (1 + ret), 1);
  const avgDailyReturn = Math.pow(compoundReturn, 1 / recentReturns.length) - 1;
  const annualizedReturn = Math.pow(1 + avgDailyReturn, 252) - 1;
  
  // Apply reasonable constraints
  let adjustedReturn = annualizedReturn;
  if (adjustedReturn > 0.6) adjustedReturn = 0.6;
  if (adjustedReturn < -0.2) adjustedReturn = -0.2;
  
  return {
    symbol,
    dataPoints: returns.length,
    recentDataPoints: recentReturns.length,
    volatility: annualizedVolatility,
    expectedReturn: adjustedReturn,
    originalExpectedReturn: annualizedReturn,
    lastCalculatedDate: new Date().toISOString(),
    synthetic: false
  };
}

/**
 * Saves metrics to the server
 * @param {string} symbol - Stock symbol
 * @param {Object} metrics - Metrics to save
 */
function saveMetrics(symbol, metrics) {
  // Send request to save metrics
  fetch('/calculate-volatility-on-demand', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      symbol,
      metrics
    })
  })
  .then(response => {
    if (!response.ok) {
      console.error('Failed to save metrics');
    }
  })
  .catch(error => {
    console.error('Error saving metrics:', error);
  });
}

/**
 * Checks data availability for a specific stock
 */
function checkDataAvailability() {
  console.log("Check availability clicked"); // Debug log
  const symbol = dataAvailabilitySymbol.value;
  
  if (!symbol) {
    showMessage('Please select a stock', 'error');
    return;
  }
  
  // Show loading state
  checkDataAvailabilityButton.disabled = true;
  dataAvailabilitySpinner.classList.remove('d-none');
  dataAvailabilityResult.classList.add('d-none');
  
  // Send request to get data availability
  fetch(`/data-availability?symbol=${encodeURIComponent(symbol)}`)
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to get data availability');
  })
  .then(data => {
    console.log("Got data availability:", data); // Debug log
    
    // Reset button
    checkDataAvailabilityButton.disabled = false;
    dataAvailabilitySpinner.classList.add('d-none');
    
    console.log("Data availability result:", data); // Debug log
    
    // Update availability info
    document.querySelector('.data-symbol-title').textContent = `${symbol} Data Summary`;
    
    // Find the data points count
    let dataPoints = data.dataPoints || 0;
    
    // If we have data but no data points count, try to find arrays
    if (data.data && !dataPoints) {
      for (const key in data.data) {
        if (Array.isArray(data.data[key]) && data.data[key].length > 0) {
          dataPoints = data.data[key].length;
          console.log(`Found ${dataPoints} items in ${key} array`);
          break;
        }
      }
    }
    
    document.getElementById('dataPoints').textContent = dataPoints;
    
    // Make sure days covered is displayed properly
    let daysCovered = data.daysCovered || 0;
    
    // If no days covered but we have data points, estimate
    if (!daysCovered && dataPoints) {
      daysCovered = Math.ceil(dataPoints * 7 / 5); // Convert trading days to calendar days
      console.log(`Estimated ${daysCovered} days covered from ${dataPoints} data points`);
    }
    
    document.getElementById('daysCovered').textContent = daysCovered > 0 ? 
                                                       `${daysCovered} days` : 'N/A';
    
    // Format date range
    document.getElementById('dateRange').textContent = data.startDate && data.endDate ? 
                                                     `${data.startDate} to ${data.endDate}` : 
                                                     (daysCovered > 0 ? `~${daysCovered} days of data` : 'N/A');
    
    // Update metrics if available
    if (data.metrics) {
      document.getElementById('volatilityValue').textContent = `${(data.metrics.volatility * 100).toFixed(2)}%`;
      document.getElementById('expectedReturnValue').textContent = `${(data.metrics.expectedReturn * 100).toFixed(2)}%`;
      document.getElementById('lastCalculatedDate').textContent = new Date(data.metrics.lastCalculatedDate).toLocaleString();
    } else {
      document.getElementById('volatilityValue').textContent = 'Not calculated';
      document.getElementById('expectedReturnValue').textContent = 'Not calculated';
      document.getElementById('lastCalculatedDate').textContent = 'N/A';
    }
    
    // Show result
    dataAvailabilityResult.classList.remove('d-none');
  })
  .catch(error => {
    // Reset button
    checkDataAvailabilityButton.disabled = false;
    dataAvailabilitySpinner.classList.add('d-none');
    
    showMessage(`Error getting data availability: ${error.message}`, 'error');
    console.error('Error:', error);
  });
}

/**
 * Calculates volatility from existing historical data
 */
function calculateVolatility() {
  // Show loading state
  calculateVolatilityButton.disabled = true;
  volatilitySpinner.classList.remove('d-none');
  volatilityResult.innerHTML = '<div class="alert alert-info">Calculating volatility metrics from historical data...</div>';
  saveToSettingsButton.classList.add('d-none');
  
  // Send request to calculate volatility
  fetch('/calculate-volatility', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to calculate volatility');
  })
  .then(data => {
    // Reset button
    calculateVolatilityButton.disabled = false;
    volatilitySpinner.classList.add('d-none');
    
    if (data.success) {
      // Store results for later use
      latestCalculationResults = data;
      
      showMessage('Successfully calculated volatility metrics', 'success');
      
      // Create table with results
      const tableHTML = `
        <div class="alert alert-success">Volatility calculations completed successfully!</div>
        <table class="table table-striped table-sm">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Expected Return (%)</th>
              <th>Volatility (%)</th>
              <th>Data Quality</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(data.metrics).map(symbol => `
              <tr>
                <td>${symbol}</td>
                <td>${(data.metrics[symbol].expectedReturn * 100).toFixed(2)}</td>
                <td>${(data.metrics[symbol].volatility * 100).toFixed(2)}</td>
                <td>${data.metrics[symbol].synthetic ? 
                  '<span class="badge bg-warning text-dark">Estimated</span>' : 
                  '<span class="badge bg-success">Historical</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      volatilityResult.innerHTML = tableHTML;
      
      // Show the save button
      saveToSettingsButton.classList.remove('d-none');
    } else {
      volatilityResult.innerHTML = `<div class="alert alert-danger">Error calculating volatility: ${data.error}</div>`;
    }
  })
  .catch(error => {
    // Reset button
    calculateVolatilityButton.disabled = false;
    volatilitySpinner.classList.add('d-none');
    
    volatilityResult.innerHTML = `<div class="alert alert-danger">Error calculating volatility: ${error.message}</div>`;
    console.error('Error:', error);
  });
}
