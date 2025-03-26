/**
 * Web Visualization for Kelly Criterion Portfolio Allocation
 * 
 * This script connects the Kelly Criterion implementation to the browser interface
 * and creates interactive visualizations.
 */

// Import the advanced Kelly criterion module
// Note: In a web environment, we'd normally use import/require, but for browser compatibility
// we'll assume the module is loaded as a script tag in index.html
const advancedKelly = window.advancedKelly || {};

// Default stock data (will be overridden if saved settings exist)
let stocks = ['TSLA', 'NVDA', 'CPNG', 'SHOP', 'MELI'];

// Expected annual returns (these are examples and not actual predictions)
let expectedReturns = {
  'TSLA': 0.15, // 15% expected annual return
  'NVDA': 0.25, // 25% expected annual return
  'CPNG': 0.12, // 12% expected annual return
  'SHOP': 0.18, // 18% expected annual return
  'MELI': 0.20  // 20% expected annual return
};

// Volatility (standard deviation of returns)
let volatility = {
  'TSLA': 0.55, // 55% annual volatility
  'NVDA': 0.45, // 45% annual volatility
  'CPNG': 0.40, // 40% annual volatility
  'SHOP': 0.50, // 50% annual volatility
  'MELI': 0.45  // 45% annual volatility
};

// Correlation matrix (this will need to be dynamically rebuilt if stocks change)
let correlationMatrix = [
  [1.0, 0.6, 0.3, 0.5, 0.4], // TSLA
  [0.6, 1.0, 0.4, 0.5, 0.5], // NVDA
  [0.3, 0.4, 1.0, 0.6, 0.7], // CPNG
  [0.5, 0.5, 0.6, 1.0, 0.7], // SHOP
  [0.4, 0.5, 0.7, 0.7, 1.0]  // MELI
];

// Charts
let allocationChart;
let riskReturnChart;
let correlationChart;
let simulationChart;

// DOM Elements
const portfolioSizeInput = document.getElementById('portfolioSize');
const kellyFractionSelect = document.getElementById('kellyFraction');
const riskFreeRateInput = document.getElementById('riskFreeRate');
const calculateButton = document.getElementById('calculateButton');
const allocationTable = document.getElementById('allocationTable');
const simulationYearsInput = document.getElementById('simulationYears');
const runSimulationButton = document.getElementById('runSimulationButton');
const resetSimulationButton = document.getElementById('resetSimulationButton');
const saveSimulationButton = document.getElementById('saveSimulationButton');
const loadSimulationButton = document.getElementById('loadSimulationButton');
const confirmSaveButton = document.getElementById('confirmSaveButton');
const simulationPrefixInput = document.getElementById('simulationPrefix');
const stockAdjustmentContainer = document.getElementById('stockAdjustmentContainer');
const simulationSummary = document.getElementById('simulationSummary');
const savedSimulationsTable = document.getElementById('savedSimulationsTable');
const noSimulationsMessage = document.getElementById('noSimulationsMessage');

// Store original values for reset functionality
let originalExpectedReturns = {};
let originalVolatility = {};

// Store current simulation results
let currentSimulationResults = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  // Set up event listeners
  calculateButton.addEventListener('click', calculateAndVisualizeAllocation);
  runSimulationButton.addEventListener('click', runSimulation);
  resetSimulationButton.addEventListener('click', resetSimulationValues);
  saveSimulationButton.addEventListener('click', showSaveSimulationModal);
  loadSimulationButton.addEventListener('click', showLoadSimulationModal);
  confirmSaveButton.addEventListener('click', saveSimulation);
  
  // Try to load saved settings first
  loadSettings()
    .then(() => {
      // Store original values for reset functionality
      saveOriginalValues();
      
      // Initialize with loaded or default values
      calculateAndVisualizeAllocation();
      
      // Setup simulation sliders
      setupStockAdjustmentSliders();
    });
});

/**
 * Saves the original values of stocks for reset functionality
 */
function saveOriginalValues() {
  originalExpectedReturns = JSON.parse(JSON.stringify(expectedReturns));
  originalVolatility = JSON.parse(JSON.stringify(volatility));
}

/**
 * Resets simulation parameters to original values
 */
function resetSimulationValues() {
  // Restore original values
  expectedReturns = JSON.parse(JSON.stringify(originalExpectedReturns));
  volatility = JSON.parse(JSON.stringify(originalVolatility));
  
  // Update sliders
  setupStockAdjustmentSliders();
  
  // Run simulation with original values
  runSimulation();
}

/**
 * Sets up interactive sliders for each stock
 */
function setupStockAdjustmentSliders() {
  // Clear existing controls
  stockAdjustmentContainer.innerHTML = '';
  
  // Create sliders for each stock
  for (const symbol of stocks) {
    const currentReturn = expectedReturns[symbol] * 100; // Convert to percentage
    const currentVolatility = volatility[symbol] * 100; // Convert to percentage
    
    const stockCol = document.createElement('div');
    stockCol.className = 'col-md-6 col-lg-4 mb-3';
    
    const stockDiv = document.createElement('div');
    stockDiv.className = 'stock-slider-container';
    
    // Stock name header
    stockDiv.innerHTML = `
      <h6>${symbol}</h6>
      
      <!-- Expected Return Slider -->
      <div class="slider-group">
        <div class="param-label">
          <span>Expected Return:</span>
          <span class="value-display" id="${symbol}-return-value">${currentReturn.toFixed(1)}%</span>
        </div>
        <div class="slider-labels">
          <small>0%</small>
          <small>50%</small>
          <small>100%</small>
        </div>
        <input type="range" class="form-range return-slider" 
               id="${symbol}-return-slider" 
               min="0" max="100" step="0.5" 
               value="${currentReturn}" 
               data-symbol="${symbol}">
      </div>
      
      <!-- Volatility Slider -->
      <div class="slider-group">
        <div class="param-label">
          <span>Volatility:</span>
          <span class="value-display" id="${symbol}-volatility-value">${currentVolatility.toFixed(1)}%</span>
        </div>
        <div class="slider-labels">
          <small>0%</small>
          <small>50%</small>
          <small>100%</small>
        </div>
        <input type="range" class="form-range volatility-slider" 
               id="${symbol}-volatility-slider" 
               min="1" max="100" step="0.5" 
               value="${currentVolatility}" 
               data-symbol="${symbol}">
      </div>
    `;
    
    stockCol.appendChild(stockDiv);
    stockAdjustmentContainer.appendChild(stockCol);
  }
  
  // Add event listeners to sliders
  document.querySelectorAll('.return-slider').forEach(slider => {
    slider.addEventListener('input', updateReturnValue);
    slider.addEventListener('change', runSimulationOnChange);
  });
  
  document.querySelectorAll('.volatility-slider').forEach(slider => {
    slider.addEventListener('input', updateVolatilityValue);
    slider.addEventListener('change', runSimulationOnChange);
  });
}

/**
 * Updates the displayed return value when slider moves
 */
function updateReturnValue(event) {
  const symbol = event.target.dataset.symbol;
  const value = parseFloat(event.target.value);
  
  // Update display
  document.getElementById(`${symbol}-return-value`).textContent = `${value.toFixed(1)}%`;
  
  // Update data
  expectedReturns[symbol] = value / 100;
}

/**
 * Updates the displayed volatility value when slider moves
 */
function updateVolatilityValue(event) {
  const symbol = event.target.dataset.symbol;
  const value = parseFloat(event.target.value);
  
  // Update display
  document.getElementById(`${symbol}-volatility-value`).textContent = `${value.toFixed(1)}%`;
  
  // Update data
  volatility[symbol] = value / 100;
}

/**
 * Runs simulation when sliders are changed
 */
function runSimulationOnChange() {
  // Small delay to allow other sliders to finish changing if multiple are changed at once
  setTimeout(runSimulation, 100);
}

/**
 * Generates a default correlation matrix for the current stocks
 * @returns {Array} - Correlation matrix
 */
function generateDefaultCorrelationMatrix() {
  const matrix = [];
  for (let i = 0; i < stocks.length; i++) {
    const row = [];
    for (let j = 0; j < stocks.length; j++) {
      if (i === j) {
        row.push(1.0); // Self-correlation is always 1
      } else {
        row.push(0.5); // Default correlation between stocks
      }
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Load settings from server if available
 * @returns {Promise} - Resolves when settings are loaded
 */
function loadSettings() {
  return fetch('/load-settings')
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('No saved settings found');
    })
    .then(data => {
      // Update our variables with the loaded settings
      const stockSettings = data.stocks;
      stocks = Object.keys(stockSettings);
      
      // Update expected returns and volatility
      expectedReturns = {};
      volatility = {};
      
      for (const symbol of stocks) {
        expectedReturns[symbol] = stockSettings[symbol].expectedReturn / 100; // Convert from % to decimal
        volatility[symbol] = stockSettings[symbol].volatility / 100; // Convert from % to decimal
      }
      
      // Update risk-free rate
      const riskFreeRate = data.riskFreeRate / 100; // Convert from % to decimal
      
      // Update the UI
      if (riskFreeRateInput) {
        riskFreeRateInput.value = data.riskFreeRate;
      }
      
      // Rebuild correlation matrix if stock list changed
      correlationMatrix = generateDefaultCorrelationMatrix();
      
      console.log('Loaded custom settings successfully');
      console.log('Stocks:', stocks);
      console.log('Returns:', expectedReturns);
      console.log('Volatility:', volatility);
      
      return true;
    })
    .catch(error => {
      console.log('Using default settings:', error.message);
      return false;
    });
}

// Bootstrap handles tab functionality automatically with data attributes

/**
 * Calculates Kelly allocation and updates visualizations
 */
async function calculateAndVisualizeAllocation() {
  const portfolioSize = parseFloat(portfolioSizeInput.value);
  const kellyFraction = parseFloat(kellyFractionSelect.value);
  const riskFreeRate = parseFloat(riskFreeRateInput.value) / 100;
  
  // Show loading indicator 
  document.body.style.cursor = 'wait';
  calculateButton.disabled = true;
  calculateButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Calculating...';
  
  // Create or update status message area if it doesn't exist
  let statusDiv = document.getElementById('calculationStatus');
  if (!statusDiv) {
    statusDiv = document.createElement('div');
    statusDiv.id = 'calculationStatus';
    statusDiv.className = 'alert mt-3';
    statusDiv.style.display = 'none';
    
    // Insert after the calculate button
    calculateButton.parentNode.appendChild(statusDiv);
  }
  
  try {
    // Calculate Kelly allocations using actual historical data
    const allocations = await calculateKellyAllocation(
      expectedReturns,
      volatility,
      riskFreeRate,
      portfolioSize,
      kellyFraction
    );
    
    // Update visualizations
    visualizeAllocations(allocations, kellyFraction);
    visualizeRiskReturn();
    visualizeCorrelation();
    
    // Show success message
    statusDiv.className = 'alert alert-success mt-3';
    statusDiv.textContent = 'Calculation successful using actual historical data.';
    statusDiv.style.display = 'block';
    
    // Hide the message after 5 seconds
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
    
  } catch (error) {
    console.error('Error calculating allocations:', error);
    
    // Show error message
    statusDiv.className = 'alert alert-danger mt-3';
    statusDiv.innerHTML = `
      <strong>Error calculating allocations:</strong> ${error.message}<br>
      <small>Please ensure you have historical data files for all stocks in the data directory. 
      You can manage historical data from the <a href="historical_data_management.html">Historical Data Management</a> page.</small>
    `;
    statusDiv.style.display = 'block';
  } finally {
    // Hide loading indicator
    document.body.style.cursor = 'default';
    calculateButton.disabled = false;
    calculateButton.innerHTML = 'Calculate Allocation';
  }
}

/**
 * Calculates Kelly criterion allocations for a set of investments using server-side calculation
 */
async function calculateKellyAllocation(expectedReturns, volatility, riskFreeRate, portfolioSize, kellyFraction = 1.0) {
  console.log('Requesting server-side Kelly calculation...');
  
  try {
    // Call the server-side endpoint
    const response = await fetch('/calculate-kelly', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbols: stocks,
        portfolioSize,
        riskFreeRate,
        returnAdjustments: {},
        useHistoricalData: true, // Use historical data from files
        customExpectedReturns: expectedReturns, // Fallback if no historical data
        customVolatility: volatility // Fallback if no historical data
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to calculate Kelly allocations');
    }
    
    const result = await response.json();
    console.log('Server calculation result:', result);
    
    if (!result.success) {
      throw new Error(result.message || 'Server calculation failed');
    }
    
    // Convert the result to our expected format
    const kellyAllocations = result.kellyAllocations;
    const allocations = {};
    
    const cashPortion = 1 - kellyFraction;
    const cashPerAsset = cashPortion / stocks.length;
    
    for (const symbol of stocks) {
      if (kellyAllocations[symbol] !== undefined) {
        const normalizedFraction = kellyAllocations[symbol] * kellyFraction;
        const dollarAmount = normalizedFraction * portfolioSize;
        const cashDollar = cashPerAsset * portfolioSize;
        
        allocations[symbol] = {
          percentage: normalizedFraction * 100,
          dollars: dollarAmount,
          cashPercentage: cashPerAsset * 100,
          cashDollars: cashDollar,
          kellyFraction: normalizedFraction / kellyFraction,
          // Add the volatility and expected return from the results for display
          volatility: result.volatility[symbol],
          expectedReturn: result.expectedReturns[symbol]
        };
      }
    }
    
    // Store the correlation matrix for visualization
    if (result.correlationMatrix) {
      correlationMatrix = result.correlationMatrix;
    }
    
    return allocations;
  } catch (error) {
    console.error('Server-side Kelly calculation failed:', error);
    throw error;
  }
}

/**
 * Visualizes portfolio allocations
 */
function visualizeAllocations(allocations, kellyFraction) {
  // Update allocation table
  // Clear existing rows except header
  while (allocationTable.rows.length > 1) {
    allocationTable.deleteRow(1);
  }
  
  // Add rows for each stock
  for (const symbol of stocks) {
    const alloc = allocations[symbol];
    if (!alloc) continue; // Skip if allocation is missing
    
    const row = allocationTable.insertRow();
    
    const cellSymbol = row.insertCell(0);
    const cellReturn = row.insertCell(1);
    const cellVol = row.insertCell(2);
    const cellKelly = row.insertCell(3);
    const cellAlloc = row.insertCell(4);
    const cellCash = row.insertCell(5);
    
    cellSymbol.textContent = symbol;
    
    // Use calculated values from historical data if available
    if (alloc.expectedReturn !== undefined) {
      cellReturn.textContent = `${(alloc.expectedReturn * 100).toFixed(2)}%`;
      // Update the global expected returns for other calculations
      expectedReturns[symbol] = alloc.expectedReturn;
    } else {
      cellReturn.textContent = `${(expectedReturns[symbol] * 100).toFixed(2)}%`;
    }
    
    if (alloc.volatility !== undefined) {
      cellVol.textContent = `${(alloc.volatility * 100).toFixed(2)}%`;
      // Update the global volatility for other calculations
      volatility[symbol] = alloc.volatility;
    } else {
      cellVol.textContent = `${(volatility[symbol] * 100).toFixed(2)}%`;
    }
    
    cellKelly.textContent = `${(alloc.percentage).toFixed(2)}%`;
    cellAlloc.textContent = `$${alloc.dollars.toFixed(2)}`;
    
    if (kellyFraction < 1) {
      cellCash.textContent = `$${alloc.cashDollars.toFixed(2)}`;
    } else {
      cellCash.textContent = "$0.00";
    }
  }
  
  // Create allocation chart
  const ctx = document.getElementById('allocationChart').getContext('2d');
  
  // Prepare data for chart - handle potential missing allocations
  const validSymbols = stocks.filter(symbol => allocations[symbol] !== undefined);
  const labels = validSymbols;
  const allocData = validSymbols.map(symbol => allocations[symbol].percentage);
  const cashData = kellyFraction < 1 ? validSymbols.map(symbol => allocations[symbol].cashPercentage) : null;
  
  // Destroy existing chart if it exists
  if (allocationChart) {
    allocationChart.destroy();
  }
  
  // Create new chart
  const datasets = [
    {
      label: 'Stock Allocation',
      data: allocData,
      backgroundColor: [
        'rgba(255, 99, 132, 0.5)',
        'rgba(54, 162, 235, 0.5)',
        'rgba(255, 206, 86, 0.5)',
        'rgba(75, 192, 192, 0.5)',
        'rgba(153, 102, 255, 0.5)'
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)'
      ],
      borderWidth: 1
    }
  ];
  
  if (cashData) {
    datasets.push({
      label: 'Cash Allocation',
      data: cashData,
      backgroundColor: 'rgba(200, 200, 200, 0.5)',
      borderColor: 'rgba(200, 200, 200, 1)',
      borderWidth: 1
    });
  }
  
  allocationChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Kelly Criterion Allocation'
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Allocation (%)'
          }
        }
      }
    }
  });
}

/**
 * Visualizes risk-return relationship
 */
function visualizeRiskReturn() {
  const ctx = document.getElementById('riskReturnChart').getContext('2d');
  
  // Prepare data for chart
  const data = stocks.filter(symbol => 
    volatility[symbol] !== undefined && 
    expectedReturns[symbol] !== undefined
  ).map(symbol => ({
    x: volatility[symbol] * 100, // Convert to percentage
    y: expectedReturns[symbol] * 100, // Convert to percentage
    r: 10, // Size of the bubble
    label: symbol
  }));
  
  // Destroy existing chart if it exists
  if (riskReturnChart) {
    riskReturnChart.destroy();
  }
  
  // Create new chart
  riskReturnChart = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: [{
        label: 'Risk vs. Return',
        data: data,
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(75, 192, 192, 0.5)',
          'rgba(153, 102, 255, 0.5)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)'
        ],
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Risk-Return Analysis'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const point = context.raw;
              return `${point.label}: Return ${point.y.toFixed(2)}%, Risk ${point.x.toFixed(2)}%`;
            }
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Risk (Volatility %)'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Expected Return (%)'
          }
        }
      }
    }
  });
}

/**
 * Visualizes correlation matrix as a heatmap
 */
function visualizeCorrelation() {
  const ctx = document.getElementById('correlationChart').getContext('2d');
  
  // Make sure we have a valid correlation matrix
  if (!correlationMatrix || correlationMatrix.length === 0 || 
      !Array.isArray(correlationMatrix[0]) || correlationMatrix.length !== stocks.length) {
    console.warn('Invalid correlation matrix, generating default');
    correlationMatrix = generateDefaultCorrelationMatrix();
  }
  
  // Prepare data for visualization
  const data = [];
  const colors = [];
  
  // Create a dataset for heatmap
  for (let i = 0; i < stocks.length; i++) {
    for (let j = 0; j < stocks.length; j++) {
      // Ensure the value exists and is valid
      const value = correlationMatrix[i] && correlationMatrix[i][j] !== undefined ? 
                    correlationMatrix[i][j] : (i === j ? 1.0 : 0.5);
                    
      data.push({
        x: stocks[j],
        y: stocks[i],
        v: value
      });
      
      // Color based on correlation value
      let color;
      
      if (value === 1) {
        // Diagonal (self-correlation) is white
        color = 'rgba(255, 255, 255, 1)';
      } else if (value > 0) {
        // Positive correlation - blue gradient
        const intensity = Math.round(value * 200);
        color = `rgba(0, 0, ${intensity + 55}, ${value})`;
      } else {
        // Negative correlation - red gradient
        const intensity = Math.round(Math.abs(value) * 200);
        color = `rgba(${intensity + 55}, 0, 0, ${Math.abs(value)})`;
      }
      
      colors.push(color);
    }
  }
  
  // Destroy existing chart if it exists
  if (correlationChart) {
    correlationChart.destroy();
  }
  
  // Create a custom chart for correlation matrix
  correlationChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Correlation',
        data: data,
        backgroundColor: colors,
        pointRadius: 15,
        pointHoverRadius: 18
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Asset Correlation Matrix'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const point = context.raw;
              return `${point.y} vs ${point.x}: ${point.v.toFixed(2)}`;
            }
          }
        },
        legend: {
          display: false
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'category',
          position: 'bottom',
          title: {
            display: true,
            text: 'Assets'
          }
        },
        y: {
          type: 'category',
          position: 'left',
          reverse: true,
          title: {
            display: true,
            text: 'Assets'
          }
        }
      }
    }
  });
}

/**
 * Simulates portfolio performance using Monte Carlo method
 */
async function runSimulation() {
  const portfolioSize = parseFloat(portfolioSizeInput.value);
  const kellyFraction = parseFloat(kellyFractionSelect.value);
  const riskFreeRate = parseFloat(riskFreeRateInput.value) / 100;
  const years = parseInt(simulationYearsInput.value);
  
  try {
    // Calculate allocations
    const allocations = await calculateKellyAllocation(
      expectedReturns,
      volatility,
      riskFreeRate,
      portfolioSize,
      kellyFraction
    );
  
    // Convert to format needed for simulation - filter out any symbols with missing allocations
    const validSymbols = stocks.filter(symbol => allocations[symbol] !== undefined);
    const allocation = {};
    for (const symbol of validSymbols) {
      allocation[symbol] = allocations[symbol].percentage / 100;
    }
    
    // Run simulation
    const simulationResults = simulatePortfolio(
      allocation,
      expectedReturns,
      volatility,
      correlationMatrix,
      portfolioSize,
      years,
      1000 // Number of simulations
    );
  
    // Calculate summary statistics
    const finalValues = simulationResults.finalValues;
    finalValues.sort((a, b) => a - b);
    
    const initialValue = portfolioSize;
    const medianFinalValue = finalValues[Math.floor(finalValues.length * 0.5)];
    const worstCase = finalValues[Math.floor(finalValues.length * 0.05)];
    const bestCase = finalValues[Math.floor(finalValues.length * 0.95)];
    
    const medianCAGR = (Math.pow(medianFinalValue / initialValue, 1 / years) - 1) * 100;
    const worstCAGR = (Math.pow(worstCase / initialValue, 1 / years) - 1) * 100;
    const bestCAGR = (Math.pow(bestCase / initialValue, 1 / years) - 1) * 100;
    
    // Store current simulation for saving
    currentSimulationResults = {
      // Input parameters
      portfolioSize,
      kellyFraction,
      riskFreeRate: parseFloat(riskFreeRateInput.value),
      years,
      symbols: stocks,
      expectedReturns,
      volatility,
      correlationMatrix,
      
      // Stock allocations
      allocations: JSON.parse(JSON.stringify(allocations)),
      
      // Results
      simulationResults: simulationResults, 
      statistics: {
        initialValue,
        medianFinalValue,
        worstCase,
        bestCase,
        medianCAGR,
        worstCAGR,
        bestCAGR
      },
      
      // Metadata
      date: new Date().toISOString(),
      version: '1.0'
    };
    
    // Update summary info
    simulationSummary.innerHTML = `
      <div class="row text-center">
        <div class="col-md-4">
          <div class="card bg-light">
            <div class="card-body">
              <h6 class="card-title">Initial Investment</h6>
              <p class="card-text fs-4">$${initialValue.toFixed(0)}</p>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card bg-light">
            <div class="card-body">
              <h6 class="card-title">Median Final Value</h6>
              <p class="card-text fs-4">$${medianFinalValue.toFixed(0)}</p>
              <p class="card-text text-muted">${medianCAGR.toFixed(1)}% CAGR</p>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card bg-light">
            <div class="card-body">
              <h6 class="card-title">Range (90% Confidence)</h6>
              <p class="card-text">
                <span class="text-danger">$${worstCase.toFixed(0)}</span> to 
                <span class="text-success">$${bestCase.toFixed(0)}</span>
              </p>
              <p class="card-text text-muted">
                <span class="text-danger">${worstCAGR.toFixed(1)}%</span> to 
                <span class="text-success">${bestCAGR.toFixed(1)}%</span> CAGR
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Visualize results
    visualizeSimulation(simulationResults);
    
    // Enable save button now that we have simulation results
    saveSimulationButton.disabled = false;
  } catch (error) {
    console.error('Error running simulation:', error);
    
    // Show error message
    simulationSummary.innerHTML = `
      <div class="alert alert-danger">
        <strong>Error running simulation:</strong> ${error.message}<br>
        <small>Please ensure you have historical data files for all stocks in the data directory. 
        You can manage historical data from the <a href="historical_data_management.html">Historical Data Management</a> page.</small>
      </div>
    `;
    
    // Disable save button if simulation failed
    saveSimulationButton.disabled = true;
    currentSimulationResults = null;
  }
}

/**
 * Simulates portfolio performance based on allocations
 */
function simulatePortfolio(allocations, expectedReturns, volatility, correlationMatrix, initialValue, years, simulations) {
  // Convert annual periods to monthly
  const timeSteps = years * 12;
  
  // Prepare results array
  const results = {
    timePoints: Array(timeSteps + 1).fill().map((_, i) => i / 12), // Time in years
    portfolioValues: Array(timeSteps + 1).fill(0),
    percentiles: {
      p5: Array(timeSteps + 1).fill(0),
      p25: Array(timeSteps + 1).fill(0),
      p50: Array(timeSteps + 1).fill(0), // Median
      p75: Array(timeSteps + 1).fill(0),
      p95: Array(timeSteps + 1).fill(0)
    },
    finalValues: []
  };
  
  // Initialize first time point
  results.portfolioValues[0] = initialValue;
  results.percentiles.p5[0] = initialValue;
  results.percentiles.p25[0] = initialValue;
  results.percentiles.p50[0] = initialValue;
  results.percentiles.p75[0] = initialValue;
  results.percentiles.p95[0] = initialValue;
  
  // Convert annual returns and volatility to monthly
  const monthlyReturns = {};
  const monthlyVolatility = {};
  
  for (const symbol of stocks) {
    // Monthly return: (1 + r_annual)^(1/12) - 1
    monthlyReturns[symbol] = Math.pow(1 + expectedReturns[symbol], 1/12) - 1;
    
    // Monthly volatility: annual_vol / sqrt(12)
    monthlyVolatility[symbol] = volatility[symbol] / Math.sqrt(12);
  }
  
  // Track simulation paths
  const allPaths = Array(simulations).fill().map(() => Array(timeSteps + 1).fill(initialValue));
  
  // Run simulations
  for (let sim = 0; sim < simulations; sim++) {
    let currentValue = initialValue;
    allPaths[sim][0] = currentValue;
    
    for (let t = 1; t <= timeSteps; t++) {
      // Calculate portfolio return for this time step
      let portfolioReturn = 0;
      
      // Simplified approach: independently sample returns for each asset
      for (const symbol of stocks) {
        // Generate random return from normal distribution
        const randomReturn = monthlyReturns[symbol] + 
                            monthlyVolatility[symbol] * randomNormal();
        
        // Add to portfolio return based on allocation
        portfolioReturn += allocations[symbol] * randomReturn;
      }
      
      // Update portfolio value
      currentValue = currentValue * (1 + portfolioReturn);
      allPaths[sim][t] = currentValue;
    }
    
    // Store final value
    results.finalValues.push(allPaths[sim][timeSteps]);
  }
  
  // Calculate statistics across simulations for each time point
  for (let t = 1; t <= timeSteps; t++) {
    const valuesAtTimeT = allPaths.map(path => path[t]);
    valuesAtTimeT.sort((a, b) => a - b);
    
    // Calculate average
    const sum = valuesAtTimeT.reduce((acc, val) => acc + val, 0);
    results.portfolioValues[t] = sum / simulations;
    
    // Calculate percentiles
    const p5Index = Math.floor(simulations * 0.05);
    const p25Index = Math.floor(simulations * 0.25);
    const p50Index = Math.floor(simulations * 0.5);
    const p75Index = Math.floor(simulations * 0.75);
    const p95Index = Math.floor(simulations * 0.95);
    
    results.percentiles.p5[t] = valuesAtTimeT[p5Index];
    results.percentiles.p25[t] = valuesAtTimeT[p25Index];
    results.percentiles.p50[t] = valuesAtTimeT[p50Index];
    results.percentiles.p75[t] = valuesAtTimeT[p75Index];
    results.percentiles.p95[t] = valuesAtTimeT[p95Index];
  }
  
  return results;
}

/**
 * Visualizes portfolio simulation results
 */
function visualizeSimulation(simulationResults) {
  const ctx = document.getElementById('simulationChart').getContext('2d');
  
  // Prepare data for chart
  const labels = simulationResults.timePoints;
  
  // Destroy existing chart if it exists
  if (simulationChart) {
    simulationChart.destroy();
  }
  
  // Create new chart
  simulationChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.filter((_, i) => i % 12 === 0), // Show yearly labels
      datasets: [
        {
          label: 'Expected Portfolio Value',
          data: simulationResults.portfolioValues.filter((_, i) => i % 12 === 0),
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          fill: false
        },
        {
          label: 'Median (50th Percentile)',
          data: simulationResults.percentiles.p50.filter((_, i) => i % 12 === 0),
          borderColor: 'rgba(255, 159, 64, 1)',
          backgroundColor: 'rgba(255, 159, 64, 0.2)',
          borderDash: [5, 5],
          tension: 0.1,
          fill: false
        },
        {
          label: '25th Percentile',
          data: simulationResults.percentiles.p25.filter((_, i) => i % 12 === 0),
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'transparent',
          borderDash: [3, 3],
          tension: 0.1,
          fill: false
        },
        {
          label: '5th Percentile',
          data: simulationResults.percentiles.p5.filter((_, i) => i % 12 === 0),
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'transparent',
          borderDash: [3, 3],
          tension: 0.1,
          fill: false
        },
        {
          label: '95th Percentile',
          data: simulationResults.percentiles.p95.filter((_, i) => i % 12 === 0),
          borderColor: 'rgba(153, 102, 255, 1)',
          backgroundColor: 'transparent',
          borderDash: [3, 3],
          tension: 0.1,
          fill: false
        }
      ]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Portfolio Performance Simulation'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Years'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Portfolio Value ($)'
          }
        }
      }
    }
  });
}

/**
 * Generates a random sample from a standard normal distribution
 * using the Box-Muller transform
 */
function randomNormal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Convert [0,1) to (0,1)
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Shows the save simulation modal
 */
function showSaveSimulationModal() {
  if (!currentSimulationResults) {
    alert('Please run a simulation first before trying to save it.');
    return;
  }
  
  // Set default prefix to 'kelly'
  simulationPrefixInput.value = 'kelly';
  
  // Show the modal
  const savePrefixModal = new bootstrap.Modal(document.getElementById('savePrefixModal'));
  savePrefixModal.show();
}

/**
 * Saves the current simulation to a file
 */
async function saveSimulation() {
  if (!currentSimulationResults) {
    alert('No simulation results to save.');
    return;
  }
  
  const prefix = simulationPrefixInput.value.trim() || 'kelly';
  
  try {
    // Prepare the data to save
    const simulationData = {
      ...currentSimulationResults,
      prefix
    };
    
    // Send data to server
    const response = await fetch('/save-simulation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(simulationData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to save simulation');
    }
    
    const result = await response.json();
    
    // Hide the modal
    bootstrap.Modal.getInstance(document.getElementById('savePrefixModal')).hide();
    
    // Show success message
    alert(`Simulation saved successfully as ${result.filename}`);
  } catch (error) {
    console.error('Error saving simulation:', error);
    alert(`Error saving simulation: ${error.message}`);
  }
}

/**
 * Shows the load simulation modal and populates it with saved simulations
 */
async function showLoadSimulationModal() {
  try {
    // Clear any existing rows
    const tbody = savedSimulationsTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    // Show loading indicator
    noSimulationsMessage.textContent = 'Loading simulations...';
    noSimulationsMessage.classList.remove('d-none');
    
    // Fetch the list of saved simulations
    const response = await fetch('/list-simulations');
    
    if (!response.ok) {
      throw new Error('Failed to fetch saved simulations');
    }
    
    const { simulations } = await response.json();
    
    if (!simulations || simulations.length === 0) {
      noSimulationsMessage.textContent = 'No saved simulations found.';
      noSimulationsMessage.classList.remove('d-none');
      savedSimulationsTable.classList.add('d-none');
    } else {
      // Hide the no simulations message
      noSimulationsMessage.classList.add('d-none');
      savedSimulationsTable.classList.remove('d-none');
      
      // Add each simulation to the table
      for (const simulation of simulations) {
        const row = document.createElement('tr');
        
        // Format date
        const date = new Date(simulation.created);
        const formattedDate = date.toLocaleString();
        
        row.innerHTML = `
          <td>${simulation.filename}</td>
          <td>${formattedDate}</td>
          <td>
            <button class="btn btn-sm btn-primary load-simulation-btn" data-filename="${simulation.filename}">
              Load
            </button>
            <button class="btn btn-sm btn-danger delete-simulation-btn" data-filename="${simulation.filename}">
              Delete
            </button>
          </td>
        `;
        
        tbody.appendChild(row);
      }
      
      // Add event listeners to the load buttons
      document.querySelectorAll('.load-simulation-btn').forEach(button => {
        button.addEventListener('click', (event) => {
          const filename = event.target.dataset.filename;
          loadSimulation(filename);
          bootstrap.Modal.getInstance(document.getElementById('loadSimulationModal')).hide();
        });
      });
      
      // Add event listeners to the delete buttons
      document.querySelectorAll('.delete-simulation-btn').forEach(button => {
        button.addEventListener('click', (event) => {
          const filename = event.target.dataset.filename;
          if (confirm(`Are you sure you want to delete ${filename}?`)) {
            deleteSimulation(filename);
          }
        });
      });
    }
    
    // Show the modal
    const loadSimulationModal = new bootstrap.Modal(document.getElementById('loadSimulationModal'));
    loadSimulationModal.show();
  } catch (error) {
    console.error('Error showing load simulation modal:', error);
    alert(`Error loading simulations: ${error.message}`);
  }
}

/**
 * Loads a saved simulation
 * @param {string} filename - The filename of the simulation to load
 */
async function loadSimulation(filename) {
  try {
    // Fetch the simulation data
    const response = await fetch(`/load-simulation?filename=${encodeURIComponent(filename)}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to load simulation');
    }
    
    const { simulationData } = await response.json();
    
    // Restore the simulation parameters
    portfolioSizeInput.value = simulationData.portfolioSize;
    kellyFractionSelect.value = simulationData.kellyFraction;
    riskFreeRateInput.value = simulationData.riskFreeRate;
    simulationYearsInput.value = simulationData.years;
    
    // Restore the stock data
    stocks = simulationData.symbols;
    expectedReturns = simulationData.expectedReturns;
    volatility = simulationData.volatility;
    correlationMatrix = simulationData.correlationMatrix;
    
    // Store the simulation results
    currentSimulationResults = simulationData;
    
    // Update the UI
    setupStockAdjustmentSliders();
    visualizeSimulation(simulationData.simulationResults);
    
    // Update the summary statistics
    const { statistics } = simulationData;
    
    simulationSummary.innerHTML = `
      <div class="row text-center">
        <div class="col-md-4">
          <div class="card bg-light">
            <div class="card-body">
              <h6 class="card-title">Initial Investment</h6>
              <p class="card-text fs-4">$${statistics.initialValue.toFixed(0)}</p>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card bg-light">
            <div class="card-body">
              <h6 class="card-title">Median Final Value</h6>
              <p class="card-text fs-4">$${statistics.medianFinalValue.toFixed(0)}</p>
              <p class="card-text text-muted">${statistics.medianCAGR.toFixed(1)}% CAGR</p>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card bg-light">
            <div class="card-body">
              <h6 class="card-title">Range (90% Confidence)</h6>
              <p class="card-text">
                <span class="text-danger">$${statistics.worstCase.toFixed(0)}</span> to 
                <span class="text-success">$${statistics.bestCase.toFixed(0)}</span>
              </p>
              <p class="card-text text-muted">
                <span class="text-danger">${statistics.worstCAGR.toFixed(1)}%</span> to 
                <span class="text-success">${statistics.bestCAGR.toFixed(1)}%</span> CAGR
              </p>
            </div>
          </div>
        </div>
      </div>
      <div class="alert alert-info mt-3">
        <strong>Loaded simulation:</strong> ${filename} (created on ${new Date(simulationData.date).toLocaleString()})
      </div>
    `;
    
    // Enable the save button
    saveSimulationButton.disabled = false;
    
    // Show a success message
    alert(`Simulation ${filename} loaded successfully!`);
  } catch (error) {
    console.error('Error loading simulation:', error);
    alert(`Error loading simulation: ${error.message}`);
  }
}

/**
 * Deletes a saved simulation
 * @param {string} filename - The filename of the simulation to delete
 */
async function deleteSimulation(filename) {
  try {
    // Send delete request to server
    const response = await fetch(`/delete-simulation?filename=${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete simulation');
    }
    
    // Refresh the load simulation modal
    showLoadSimulationModal();
    
    // Show success message
    alert(`Simulation ${filename} deleted successfully!`);
  } catch (error) {
    console.error('Error deleting simulation:', error);
    alert(`Error deleting simulation: ${error.message}`);
  }
}
