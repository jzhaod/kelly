/**
 * Web Visualization for Kelly Criterion Portfolio Allocation
 * 
 * This script connects the Kelly Criterion implementation to the browser interface
 * and creates interactive visualizations.
 */

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
const stockAdjustmentContainer = document.getElementById('stockAdjustmentContainer');
const simulationSummary = document.getElementById('simulationSummary');

// Store original values for reset functionality
let originalExpectedReturns = {};
let originalVolatility = {};

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  // Set up event listeners
  calculateButton.addEventListener('click', calculateAndVisualizeAllocation);
  runSimulationButton.addEventListener('click', runSimulation);
  resetSimulationButton.addEventListener('click', resetSimulationValues);
  
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
function calculateAndVisualizeAllocation() {
  const portfolioSize = parseFloat(portfolioSizeInput.value);
  const kellyFraction = parseFloat(kellyFractionSelect.value);
  const riskFreeRate = parseFloat(riskFreeRateInput.value) / 100;
  
  // Calculate Kelly allocations
  const allocations = calculateKellyAllocation(
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
}

/**
 * Calculates Kelly criterion allocations for a set of investments
 */
function calculateKellyAllocation(expectedReturns, volatility, riskFreeRate, portfolioSize, kellyFraction = 1.0) {
  const kellyFractions = {};
  const allocations = {};
  
  // Calculate Kelly fraction for each asset
  for (const symbol of stocks) {
    const excessReturn = expectedReturns[symbol] - riskFreeRate;
    const kellyF = excessReturn / (volatility[symbol] * volatility[symbol]);
    kellyFractions[symbol] = kellyF;
  }
  
  // Sum of all Kelly fractions (for normalization)
  const totalKelly = stocks.reduce((sum, symbol) => sum + kellyFractions[symbol], 0);
  
  // Calculate normalized allocations
  const cashPortion = 1 - kellyFraction;
  const cashPerAsset = cashPortion / stocks.length;
  
  for (const symbol of stocks) {
    const normalizedFraction = (kellyFractions[symbol] / totalKelly) * kellyFraction;
    const dollarAmount = normalizedFraction * portfolioSize;
    const cashDollar = cashPerAsset * portfolioSize;
    
    allocations[symbol] = {
      percentage: normalizedFraction * 100,
      dollars: dollarAmount,
      cashPercentage: cashPerAsset * 100,
      cashDollars: cashDollar,
      kellyFraction: kellyFractions[symbol]
    };
  }
  
  return allocations;
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
    const row = allocationTable.insertRow();
    
    const cellSymbol = row.insertCell(0);
    const cellReturn = row.insertCell(1);
    const cellVol = row.insertCell(2);
    const cellKelly = row.insertCell(3);
    const cellAlloc = row.insertCell(4);
    const cellCash = row.insertCell(5);
    
    cellSymbol.textContent = symbol;
    cellReturn.textContent = `${(expectedReturns[symbol] * 100).toFixed(2)}%`;
    cellVol.textContent = `${(volatility[symbol] * 100).toFixed(2)}%`;
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
  
  // Prepare data for chart
  const labels = stocks;
  const allocData = stocks.map(symbol => allocations[symbol].percentage);
  const cashData = kellyFraction < 1 ? stocks.map(symbol => allocations[symbol].cashPercentage) : null;
  
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
  const data = stocks.map(symbol => ({
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
  
  // Prepare data for visualization
  const data = [];
  const colors = [];
  
  // Create a dataset for heatmap
  for (let i = 0; i < stocks.length; i++) {
    for (let j = 0; j < stocks.length; j++) {
      data.push({
        x: stocks[j],
        y: stocks[i],
        v: correlationMatrix[i][j]
      });
      
      // Color based on correlation value
      const value = correlationMatrix[i][j];
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
function runSimulation() {
  const portfolioSize = parseFloat(portfolioSizeInput.value);
  const kellyFraction = parseFloat(kellyFractionSelect.value);
  const riskFreeRate = parseFloat(riskFreeRateInput.value) / 100;
  const years = parseInt(simulationYearsInput.value);
  
  // Calculate allocations
  const allocations = calculateKellyAllocation(
    expectedReturns,
    volatility,
    riskFreeRate,
    portfolioSize,
    kellyFraction
  );
  
  // Convert to format needed for simulation
  const allocation = {};
  for (const symbol of stocks) {
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
