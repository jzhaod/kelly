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