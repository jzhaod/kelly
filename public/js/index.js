/**
 * Kelly Criterion Portfolio Allocation Demo
 * 
 * This script demonstrates how to use the Kelly Criterion modules
 * to allocate capital across multiple assets.
 */

// Define your investment universe
const stocks = ['TSLA', 'NVDA', 'CPNG', 'SHOP', 'MELI'];

// Initialize the page when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Load stock data and initialize charts
  loadStockData();
  
  // Set up event listeners
  setupEventListeners();
});

/**
 * Loads stock data and initializes the page
 */
async function loadStockData() {
  try {
    const response = await fetch('/data-status');
    if (!response.ok) {
      throw new Error(`Failed to load stock data: ${response.status}`);
    }
    
    const data = await response.json();
    updateStockList(data.stocks);
  } catch (error) {
    console.error('Error loading stock data:', error);
    showError('Failed to load stock data. Please try again later.');
  }
}

/**
 * Updates the stock list with current data
 */
function updateStockList(stocks) {
  const stockList = document.getElementById('stockList');
  if (!stockList) return;
  
  stockList.innerHTML = '';
  
  Object.entries(stocks).forEach(([symbol, data]) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${symbol}</td>
      <td>${data.dataPoints || 0}</td>
      <td>${formatDate(data.startDate)} to ${formatDate(data.endDate)}</td>
      <td>${data.daysCovered || 0} days</td>
      <td>
        <span class="status-${getStatusClass(data)}">
          ${getStatusText(data)}
        </span>
      </td>
      <td>
        <a href="stock_detail.html?symbol=${symbol}" class="btn btn-sm btn-primary">
          View Details
        </a>
      </td>
    `;
    stockList.appendChild(row);
  });
}

/**
 * Sets up event listeners for the page
 */
function setupEventListeners() {
  // Add any event listeners here
}

/**
 * Shows an error message to the user
 */
function showError(message) {
  const messageArea = document.getElementById('messageArea');
  if (messageArea) {
    messageArea.className = 'alert alert-danger';
    messageArea.textContent = message;
    messageArea.style.display = 'block';
  }
}

/**
 * Formats a date string for display
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Gets the status class for a stock's data
 */
function getStatusClass(data) {
  if (!data.daysCovered) return 'incomplete';
  if (data.daysCovered >= 1200) return 'complete';
  if (data.daysCovered >= 500) return 'partial';
  return 'incomplete';
}

/**
 * Gets the status text for a stock's data
 */
function getStatusText(data) {
  if (!data.daysCovered) return 'No Data';
  if (data.daysCovered >= 1200) return 'Complete';
  if (data.daysCovered >= 500) return 'Partial';
  return 'Minimal';
}

// Kelly Criterion calculation functions
function calculateKelly(expectedReturn, volatility, riskFreeRate = 0.04) {
    // Convert percentages to decimals
    const mu = expectedReturn / 100;
    const sigma = volatility / 100;
    const r = riskFreeRate;
    
    // Kelly formula: f* = (μ - r) / σ²
    const kelly = (mu - r) / (sigma * sigma);
    
    // Convert to percentage and ensure it's between 0 and 100
    return Math.max(0, Math.min(100, kelly * 100));
}

function formatPercentage(value) {
    return value.toFixed(2) + '%';
}

// Function to update the Kelly table
async function updateKellyTable() {
    try {
        const response = await fetch('/api/stocks');
        const stocks = await response.json();
        
        const tableBody = document.getElementById('kelly-table-body');
        tableBody.innerHTML = '';
        
        // Sort stocks by Kelly fraction (highest first)
        stocks.sort((a, b) => {
            const kellyA = calculateKelly(a.expectedReturn, a.volatility);
            const kellyB = calculateKelly(b.expectedReturn, b.volatility);
            return kellyB - kellyA;
        });
        
        stocks.forEach(stock => {
            const fullKelly = calculateKelly(stock.expectedReturn, stock.volatility);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${stock.symbol}</td>
                <td>${formatPercentage(stock.expectedReturn)}</td>
                <td>${formatPercentage(stock.volatility)}</td>
                <td>${formatPercentage(fullKelly)}</td>
                <td>${formatPercentage(fullKelly * 0.75)}</td>
                <td>${formatPercentage(fullKelly * 0.5)}</td>
                <td>${formatPercentage(fullKelly * 0.25)}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error updating Kelly table:', error);
    }
}

// Simulation functions
function generateSimulatedReturns(expectedReturn, volatility, years) {
    const dailyReturns = [];
    const tradingDaysPerYear = 252;
    const totalDays = years * tradingDaysPerYear;
    
    // Convert percentages to decimals
    const mu = expectedReturn / 100;
    const sigma = volatility / 100;
    
    for (let i = 0; i < totalDays; i++) {
        // Generate random return using normal distribution
        const z = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
        const dailyReturn = (mu / tradingDaysPerYear) + (sigma / Math.sqrt(tradingDaysPerYear)) * z;
        dailyReturns.push(dailyReturn);
    }
    
    return dailyReturns;
}

function calculatePortfolioValue(initialCapital, returns) {
    let value = initialCapital;
    const portfolioValues = [value];
    
    returns.forEach(dailyReturn => {
        value *= (1 + dailyReturn);
        portfolioValues.push(value);
    });
    
    return portfolioValues;
}

function calculatePerformanceMetrics(values) {
    const finalValue = values[values.length - 1];
    const totalReturn = ((finalValue - values[0]) / values[0]) * 100;
    const years = (values.length - 1) / 252;
    const annualReturn = (Math.pow(finalValue / values[0], 1 / years) - 1) * 100;
    
    // Calculate maximum drawdown
    let maxDrawdown = 0;
    let peak = values[0];
    
    values.forEach(value => {
        if (value > peak) {
            peak = value;
        }
        const drawdown = (peak - value) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
    });
    
    return {
        finalValue,
        totalReturn,
        annualReturn,
        maxDrawdown: maxDrawdown * 100
    };
}

// Function to run the simulation
async function runSimulation() {
    try {
        const years = parseInt(document.getElementById('simulationYears').value);
        const initialCapital = parseFloat(document.getElementById('initialCapital').value);
        
        const response = await fetch('/api/stocks');
        const stocks = await response.json();
        
        // Generate returns for each stock
        const stockReturns = stocks.map(stock => ({
            symbol: stock.symbol,
            returns: generateSimulatedReturns(stock.expectedReturn, stock.volatility, years)
        }));
        
        // Calculate portfolio returns (equal weight)
        const portfolioReturns = [];
        const numStocks = stockReturns.length;
        
        for (let i = 0; i < stockReturns[0].returns.length; i++) {
            let dailyReturn = 0;
            stockReturns.forEach(stock => {
                dailyReturn += stock.returns[i];
            });
            portfolioReturns.push(dailyReturn / numStocks);
        }
        
        // Calculate portfolio values
        const portfolioValues = calculatePortfolioValue(initialCapital, portfolioReturns);
        
        // Calculate performance metrics
        const metrics = calculatePerformanceMetrics(portfolioValues);
        
        // Update the UI
        document.getElementById('simulation-results').style.display = 'block';
        document.getElementById('finalValue').textContent = `$${metrics.finalValue.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
        document.getElementById('totalReturn').textContent = formatPercentage(metrics.totalReturn);
        document.getElementById('annualReturn').textContent = formatPercentage(metrics.annualReturn);
        document.getElementById('maxDrawdown').textContent = formatPercentage(metrics.maxDrawdown);
        
        // Update the chart
        updatePortfolioChart(portfolioValues, years);
    } catch (error) {
        console.error('Error running simulation:', error);
    }
}

// Function to update the portfolio value chart
function updatePortfolioChart(values, years) {
    const ctx = document.getElementById('portfolioValueChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.portfolioChart) {
        window.portfolioChart.destroy();
    }
    
    // Create data points for the x-axis (years)
    const labels = [];
    const tradingDaysPerYear = 252;
    for (let i = 0; i <= years; i++) {
        labels.push(`Year ${i}`);
    }
    
    // Create the chart
    window.portfolioChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Portfolio Value',
                data: values.filter((_, index) => index % tradingDaysPerYear === 0),
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Update Kelly table when the page loads
    updateKellyTable();
    
    // Add event listener for the simulation button
    document.getElementById('runSimulation').addEventListener('click', runSimulation);
}); 