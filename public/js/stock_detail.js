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
let volumeChart = null;
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
  // Get the stock symbol from the URL
  const pathParts = window.location.pathname.split('/');
  const symbol = pathParts[pathParts.length - 1];
  
  // Update the stock symbol in the page title
  document.getElementById('stockSymbol').textContent = symbol;
  
  // Load stock data
  loadStockData(symbol);
});

/**
 * Loads stock data from the server
 */
async function loadStockData(symbol) {
  try {
    // Load stock settings
    const settingsResponse = await fetch('/api/stocks');
    const settings = await settingsResponse.json();
    const stockData = settings.stocks[symbol];
    
    if (!stockData) {
      throw new Error('Stock not found');
    }
    
    // Update basic information
    document.getElementById('symbol').textContent = symbol;
    document.getElementById('companyName').textContent = stockData.companyName || 'N/A';
    document.getElementById('expectedReturn').textContent = `${stockData.expectedReturn}%`;
    document.getElementById('volatility').textContent = `${stockData.volatility}%`;
    document.getElementById('shares').textContent = stockData.shares || 'N/A';
    
    // Calculate and display Kelly fractions
    const riskFreeRate = settings.riskFreeRate || 4.0; // Default to 4% if not specified
    const expectedReturn = stockData.expectedReturn / 100; // Convert to decimal
    const volatility = stockData.volatility / 100; // Convert to decimal
    
    const fullKelly = calculateKellyFraction(expectedReturn, volatility, riskFreeRate);
    const halfKelly = fullKelly * 0.5;
    const quarterKelly = fullKelly * 0.25;
    
    document.getElementById('fullKelly').textContent = `${(fullKelly * 100).toFixed(2)}%`;
    document.getElementById('halfKelly').textContent = `${(halfKelly * 100).toFixed(2)}%`;
    document.getElementById('quarterKelly').textContent = `${(quarterKelly * 100).toFixed(2)}%`;
    
    // Load historical data
    const dataResponse = await fetch(`/data-availability?symbol=${symbol}`);
    const historicalData = await dataResponse.json();
    
    if (historicalData.data) {
      displayHistoricalData(historicalData.data);
    }
  } catch (error) {
    console.error('Error loading stock data:', error);
    alert('Failed to load stock data. Please try again later.');
  }
}

function calculateKellyFraction(expectedReturn, volatility, riskFreeRate) {
  // Convert risk-free rate to decimal
  const r = riskFreeRate / 100;
  
  // Kelly formula: f* = (μ - r) / σ²
  const kellyFraction = (expectedReturn - r) / (volatility * volatility);
  
  // Ensure the fraction is between 0 and 1
  return Math.max(0, Math.min(1, kellyFraction));
}

function displayHistoricalData(data) {
  const tbody = document.getElementById('historicalData');
  tbody.innerHTML = ''; // Clear existing data
  
  // Sort data by date in descending order (most recent first)
  const sortedData = data.sort((a, b) => new Date(b.Date) - new Date(a.Date));
  
  // Display the most recent 100 data points
  sortedData.slice(0, 100).forEach(record => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(record.Date)}</td>
      <td>${formatNumber(record.Open)}</td>
      <td>${formatNumber(record.High)}</td>
      <td>${formatNumber(record.Low)}</td>
      <td>${formatNumber(record.Close)}</td>
      <td>${formatNumber(record.Volume)}</td>
    `;
    tbody.appendChild(row);
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function formatNumber(number) {
  if (typeof number !== 'number') return 'N/A';
  return number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Updates the stock information display
 */
function updateStockInfo(data) {
  // Basic info
  infoSymbolElement.textContent = data.symbol || stockSymbol;
  infoDataPointsElement.textContent = data.dataPoints || 0;
  
  // Date range - sort dates to show oldest to latest
  if (data.startDate && data.endDate) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (startDate > endDate) {
      // Swap dates if they're in reverse order
      [data.startDate, data.endDate] = [data.endDate, data.startDate];
    }
    infoDateRangeElement.textContent = `${formatDate(data.startDate)} to ${formatDate(data.endDate)}`;
  } else {
    infoDateRangeElement.textContent = 'No data available';
  }
  
  // Days covered - ensure positive number
  const daysCovered = Math.abs(data.daysCovered || 0);
  infoDaysCoveredElement.textContent = daysCovered ? `${daysCovered} days` : 'N/A';
  
  // Data status
  if (data.dataPoints > 0) {
    const statusClass = daysCovered >= 1200 ? 'status-complete' : 
                        (daysCovered >= 500 ? 'status-partial' : 'status-incomplete');
    
    infoStatusElement.innerHTML = `<span class="${statusClass}">
      ${daysCovered >= 1200 ? 'Complete' : 
        (daysCovered >= 500 ? 'Partial' : 'Minimal')}
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
  const ctx = document.getElementById('priceChart');
  if (!ctx) {
    console.error("Could not find chart canvas element");
    return;
  }

  // Check if we have data to display
  if (!Array.isArray(data) || data.length === 0) {
    return;
  }
  
  try {
    // Parse dates and prices from data
    const dates = [];
    const prices = [];
    
    // Process data points with a limit to prevent stack issues
    const maxPoints = Math.min(data.length, 1000); // Limit to 1000 points
    
    // Create a copy of the data array and reverse it to get oldest first
    const sortedData = data.slice(0, maxPoints).sort((a, b) => {
      const dateA = new Date(a.Date);
      const dateB = new Date(b.Date);
      return dateA - dateB;
    });
    
    // Process the sorted data
    for (const item of sortedData) {
      if (!item || typeof item !== 'object') continue;
      
      const date = item.Date;
      const price = item['Adj Close'] || item.Close;
      
      if (date && price !== undefined && !isNaN(price)) {
        dates.push(date);
        prices.push(Number(price));
      }
    }
    
    // If no data processed, return
    if (dates.length === 0 || prices.length === 0) {
      return;
    }
    
    // Format dates for display
    const formattedDates = dates.map(date => formatDate(date));
    
    // Destroy existing chart if any
    if (priceChart) {
      priceChart.destroy();
      priceChart = null;
    }
    
    // Create new chart
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
            intersect: false,
            callbacks: {
              label: function(context) {
                return `Price: $${context.raw.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 10,
              autoSkip: true
            }
          },
          y: {
            beginAtZero: false,
            ticks: {
              callback: function(value) {
                return '$' + value.toFixed(2);
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error creating price chart:', error);
  }
}

/**
 * Creates the volume history chart
 */
function createVolumeChart(data) {
  const ctx = document.getElementById('volumeChart').getContext('2d');
  
  // Sort data by date
  const sortedData = [...data].sort((a, b) => new Date(a.Date) - new Date(b.Date));
  
  // Limit to 1000 data points to prevent performance issues
  const limitedData = sortedData.slice(-1000);
  
  volumeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: limitedData.map(item => new Date(item.Date)),
      datasets: [{
        label: 'Volume',
        data: limitedData.map(item => item.Volume),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
            displayFormats: {
              day: 'MMM d, yyyy'
            }
          },
          title: {
            display: true,
            text: 'Date'
          },
          ticks: {
            maxTicksLimit: 10,
            autoSkip: true
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Volume'
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Volume: ${context.raw.toLocaleString()}`;
            }
          }
        }
      }
    }
  });
}

/**
 * Creates the returns distribution chart
 */
function createReturnsChart(data) {
  const ctx = document.getElementById('returnsChart').getContext('2d');
  
  // Calculate daily returns
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    const currPrice = data[i]['Adj Close'] || data[i].Close;
    const prevPrice = data[i-1]['Adj Close'] || data[i-1].Close;
    if (currPrice && prevPrice) {
      const dailyReturn = ((currPrice - prevPrice) / prevPrice) * 100;
      returns.push(dailyReturn);
    }
  }
  
  // Calculate histogram data
  const binCount = 50;
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const binWidth = (max - min) / binCount;
  
  const bins = new Array(binCount).fill(0);
  returns.forEach(return_ => {
    const binIndex = Math.min(Math.floor((return_ - min) / binWidth), binCount - 1);
    bins[binIndex]++;
  });
  
  // Create labels for the bins
  const labels = bins.map((_, i) => {
    const start = min + (i * binWidth);
    const end = start + binWidth;
    return `${start.toFixed(1)}% to ${end.toFixed(1)}%`;
  });
  
  returnsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
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
      scales: {
        x: {
          title: {
            display: true,
            text: 'Daily Return (%)'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Frequency'
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Count: ${context.raw}`;
            }
          }
        }
      }
    }
  });
}

/**
 * Creates the Kelly Criterion chart
 * @param {Object} data - The stock data
 * @param {Object} metrics - The stock metrics
 */
function createKellyChart(data, metrics) {
  if (!data || !metrics) {
    console.error('Missing data or metrics for Kelly chart');
    return;
  }

  const ctx = document.getElementById('kellyChart').getContext('2d');
  
  // Calculate Kelly fractions
  const kellyFractions = calculateKellyFractions(metrics);
  
  // Create chart data
  const chartData = {
    labels: ['Full Kelly', 'Half Kelly', 'Quarter Kelly'],
    datasets: [{
      label: 'Portfolio Allocation',
      data: [
        kellyFractions.fullKelly * 100,
        kellyFractions.halfKelly * 100,
        kellyFractions.quarterKelly * 100
      ],
      backgroundColor: [
        'rgba(54, 162, 235, 0.5)',
        'rgba(75, 192, 192, 0.5)',
        'rgba(153, 102, 255, 0.5)'
      ],
      borderColor: [
        'rgba(54, 162, 235, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)'
      ],
      borderWidth: 1
    }]
  };

  // Create chart
  new Chart(ctx, {
    type: 'bar',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Portfolio Allocation (%)'
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Kelly Criterion Portfolio Allocation'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.parsed.y.toFixed(1)}%`;
            }
          }
        }
      }
    }
  });
}

/**
 * Calculates Kelly fractions for different risk levels
 * @param {Object} metrics - The stock metrics
 * @returns {Object} - Kelly fractions for different risk levels
 */
function calculateKellyFractions(metrics) {
  if (!metrics || !metrics.volatility || !metrics.expectedReturn) {
    console.error('Missing required metrics for Kelly calculation');
    return {
      fullKelly: 0,
      halfKelly: 0,
      quarterKelly: 0
    };
  }

  const riskFreeRate = 0.045; // 4.5% risk-free rate
  const fullKelly = (metrics.expectedReturn - riskFreeRate) / (metrics.volatility * metrics.volatility);
  
  return {
    fullKelly: Math.max(0, Math.min(1, fullKelly)),
    halfKelly: Math.max(0, Math.min(1, fullKelly * 0.5)),
    quarterKelly: Math.max(0, Math.min(1, fullKelly * 0.25))
  };
}

/**
 * Updates all charts with new data
 */
function updateCharts(data) {
  if (priceChart) {
    priceChart.destroy();
  }
  if (volumeChart) {
    volumeChart.destroy();
  }
  if (returnsChart) {
    returnsChart.destroy();
  }
  
  createPriceChart(data);
  createVolumeChart(data);
  createReturnsChart(data);
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