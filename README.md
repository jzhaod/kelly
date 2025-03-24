# Kelly Criterion Portfolio Allocation

This repository contains tools for applying the Kelly Criterion to stock portfolio allocation. The Kelly Criterion is a formula that determines the optimal position sizing to maximize the logarithm of wealth over the long term.

## Overview

The Kelly Criterion for investments can be expressed as:

```
f* = (p - q) / odds = (edge / odds)
```

Which for stocks translates to:

```
f* = (expected_return - risk_free_rate) / volatility²
```

For a multi-asset portfolio with correlations, the formula becomes more complex and involves matrix operations.

## Features

- **Basic Kelly Allocation**: Calculate optimal allocation percentages for multiple stocks
- **Fractional Kelly**: Implement Half Kelly and Quarter Kelly approaches for reduced volatility
- **Advanced Kelly**: Account for correlations between assets (requires matrix operations)
- **Visualization Tools**: Visualize allocations, risk-return relationships, and correlations
- **Portfolio Simulation**: Run Monte Carlo simulations to project potential portfolio performance

## Files in this Repository

- `kelly_criterion.js`: Simple implementation of Kelly Criterion for multiple assets
- `advanced_kelly.js`: Advanced implementation considering correlations between assets
- `visualization.js`: Tools for visualizing allocations and portfolio metrics
- `index.js`: Examples showing how to use the various modules
- `README.md`: This documentation file

## Usage Example

```javascript
// Import the module
const { calculateKellyAllocation, printAllocations } = require('./kelly_criterion');

// Define your investment universe
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

// Risk-free rate and portfolio size
const riskFreeRate = 0.045; // 4.5%
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
```

## Output Example

```
Full Kelly Allocation (Optimal Growth):
------------------------------------
NVDA: 32.31% ($323.06)
MELI: 24.43% ($244.26)
SHOP: 17.23% ($172.32)
CPNG: 14.96% ($149.59)
TSLA: 11.08% ($110.77)
Total: 100.00%

Half Kelly Allocation (Recommended for More Stability):
------------------------------------
NVDA: 16.15% ($161.53) + Cash: 10.00% ($100.00)
MELI: 12.21% ($122.13) + Cash: 10.00% ($100.00)
SHOP: 8.62% ($86.16) + Cash: 10.00% ($100.00)
CPNG: 7.48% ($74.79) + Cash: 10.00% ($100.00)
TSLA: 5.54% ($55.38) + Cash: 10.00% ($100.00)
Total: 100.00%
```

## Important Notes

1. The Kelly Criterion is highly sensitive to input parameters, especially expected returns.
2. Full Kelly can lead to significant drawdowns. Many practitioners use Half Kelly or Quarter Kelly.
3. The advanced implementation requires matrix operations, which is why `mathjs` is recommended.
4. These are theoretical allocations and should be combined with your own risk management strategy.
5. The visualization functions require a browser environment and a library like Chart.js.

## Dependencies (for full functionality)

- mathjs: For matrix operations in the advanced implementation
- chart.js: For visualization in a browser environment

## Installation

1. Clone this repository
2. For full functionality, install dependencies:
```
npm install mathjs chart.js
```

## Running the Demo

```
node index.js
```

## Extending the Code

- Add functionality to fetch real historical data from financial APIs
- Implement more sophisticated return estimation methods
- Create a web interface for interactive portfolio allocation
- Add support for additional asset classes beyond stocks
