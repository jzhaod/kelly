/**
 * Kelly Criterion Portfolio Allocation Demo
 * 
 * This script demonstrates how to use the Kelly Criterion modules
 * to allocate capital across multiple assets.
 */

// Import modules
const { calculateKellyAllocation, printAllocations } = require('./kelly_criterion');
const { 
  runAdvancedKellyAllocation,
  calculateAdvancedKelly,
  fetchHistoricalData
} = require('./advanced_kelly');
const {
  createAllocationChart,
  createRiskReturnChart,
  createCorrelationHeatmap,
  simulatePortfolio,
  createSimulationChart
} = require('./visualization');

// Define your investment universe
const stocks = ['TSLA', 'NVDA', 'CPNG', 'SHOP', 'MELI'];

// Example 1: Simple Kelly allocation using predefined estimates
console.log('===== EXAMPLE 1: SIMPLE KELLY ALLOCATION =====');

// Expected annual returns (these are examples and not actual predictions)
const expectedReturns = {
  'TSLA': 0.15, // 15% expected annual return
  'NVDA': 0.25, // 25% expected annual return
  'CPNG': 0.12, // 12% expected annual return
  'SHOP': 0.18, // 18% expected annual return
  'MELI': 0.20  // 20% expected annual return
};

// Volatility (standard deviation of returns)
const volatility = {
  'TSLA': 0.55, // 55% annual volatility
  'NVDA': 0.45, // 45% annual volatility
  'CPNG': 0.40, // 40% annual volatility
  'SHOP': 0.50, // 50% annual volatility
  'MELI': 0.45  // 45% annual volatility
};

// Risk-free rate (approximate current Treasury yield)
const riskFreeRate = 0.045; // 4.5%

// Portfolio size
const portfolioSize = 1000; // $1000 total investment

// Calculate Kelly allocations
const allocations = calculateKellyAllocation(
  expectedReturns,
  volatility,
  riskFreeRate,
  portfolioSize
);

// Print allocation results
printAllocations(allocations);

// Example 2: Advanced Kelly allocation with real data (async operation)
console.log('\n===== EXAMPLE 2: ADVANCED KELLY ALLOCATION =====');
console.log('This would normally fetch real data. Using simulated data for demo purposes...');

// This function would get historical data and calculate allocations
// To execute this in a real environment, you'd use:
/*
async function runAdvancedExample() {
  try {
    // You can adjust expected returns with your own views
    const returnAdjustments = {
      'TSLA': 0.03,  // Adjust Tesla's expected return up by 3%
      'NVDA': 0.05   // Adjust NVIDIA's expected return up by 5%
    };
    
    const results = await runAdvancedKellyAllocation(stocks, portfolioSize, returnAdjustments);
    
    // You could visualize the results here
    console.log('Advanced Kelly allocation complete!');
  } catch (error) {
    console.error('Error in advanced allocation:', error);
  }
}

// Run the advanced example
runAdvancedExample();
*/

// Example 3: Visualizing portfolio allocation and simulating performance
console.log('\n===== EXAMPLE 3: PORTFOLIO VISUALIZATION =====');
console.log('This would create visualizations in a browser environment.');
console.log('Showing text-based output for demonstration:');

// Create simplified allocation chart output
console.log('\nAllocation Chart:');
// Convert allocations to a format compatible with visualization functions
const visualizationAllocations = {};
for (const symbol of stocks) {
  visualizationAllocations[symbol] = allocations.fullKelly[symbol].percentage / 100;
}
createAllocationChart(visualizationAllocations, 'allocationChart', 'Kelly Portfolio Allocation');

// Create risk-return chart output
console.log('\nRisk-Return Analysis:');
createRiskReturnChart(stocks, expectedReturns, volatility, 'riskReturnChart');

// Create a simplified correlation matrix for demonstration
const correlationMatrix = [
  [1.0, 0.6, 0.3, 0.5, 0.4], // TSLA
  [0.6, 1.0, 0.4, 0.5, 0.5], // NVDA
  [0.3, 0.4, 1.0, 0.6, 0.7], // CPNG
  [0.5, 0.5, 0.6, 1.0, 0.7], // SHOP
  [0.4, 0.5, 0.7, 0.7, 1.0]  // MELI
];

// Create correlation heatmap output
console.log('\nCorrelation Matrix:');
createCorrelationHeatmap(stocks, correlationMatrix, 'correlationHeatmap');

// Example 4: Portfolio simulation
console.log('\n===== EXAMPLE 4: PORTFOLIO SIMULATION =====');
console.log('Running a simplified Monte Carlo simulation for portfolio performance...');

// Run simulation with Kelly allocations
const simulationResults = simulatePortfolio(
  visualizationAllocations,
  expectedReturns,
  volatility,
  correlationMatrix,
  portfolioSize,
  10, // 10 years
  100  // 100 simulations (would use more in a real scenario)
);

// Create simulation chart output
console.log('\nPortfolio Simulation Results:');
createSimulationChart(simulationResults, 'simulationChart');

console.log('\n===== ANALYSIS COMPLETE =====');
console.log('Tips for Kelly Criterion implementation:');
console.log('1. The full Kelly allocation maximizes long-term growth but can be highly volatile');
console.log('2. Most practitioners use fractional Kelly (Half or Quarter) to reduce risk');
console.log('3. Regularly update your estimates as market conditions change');
console.log('4. Be careful with expected return estimates - they greatly impact the allocation');
console.log('5. Consider your own risk tolerance when choosing between allocation strategies');
