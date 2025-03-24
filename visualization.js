/**
 * Visualization utilities for Kelly Criterion allocation
 * 
 * This module provides functions to visualize Kelly Criterion allocations
 * and related portfolio metrics.
 * 
 * Note: In a real environment, you would need to install chart.js or another
 * visualization library: npm install chart.js
 */

/**
 * Creates a bar chart visualizing portfolio allocations
 * @param {Object} allocations - Allocation percentages by symbol
 * @param {String} elementId - DOM element ID to render the chart
 * @param {String} title - Chart title
 */
function createAllocationChart(allocations, elementId, title) {
  // This is a placeholder function that would use chart.js in a browser environment
  
  console.log(`Creating ${title} chart for element ID: ${elementId}`);
  console.log('Allocations:');
  
  const symbols = Object.keys(allocations);
  const percentages = symbols.map(symbol => allocations[symbol] * 100);
  
  // Print the data that would be visualized
  for (let i = 0; i < symbols.length; i++) {
    console.log(`${symbols[i]}: ${percentages[i].toFixed(2)}%`);
  }
  
  // In a browser environment with chart.js, you would use code like this:
  /*
  const ctx = document.getElementById(elementId).getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: symbols,
      datasets: [{
        label: 'Allocation (%)',
        data: percentages,
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(75, 192, 192, 0.5)',
          'rgba(153, 102, 255, 0.5)',
          'rgba(255, 159, 64, 0.5)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Allocation (%)'
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: title
        }
      }
    }
  });
  */
}

/**
 * Creates a scatter plot to visualize risk vs. return
 * @param {Array} symbols - Array of asset symbols
 * @param {Object} expectedReturns - Expected returns by symbol
 * @param {Object} volatility - Volatility by symbol
 * @param {String} elementId - DOM element ID to render the chart
 */
function createRiskReturnChart(symbols, expectedReturns, volatility, elementId) {
  // This is a placeholder function that would use chart.js in a browser environment
  
  console.log('Risk-Return Analysis:');
  console.log('Symbol\tReturn\tRisk');
  
  // Print the data that would be visualized
  for (const symbol of symbols) {
    console.log(`${symbol}\t${(expectedReturns[symbol] * 100).toFixed(2)}%\t${(volatility[symbol] * 100).toFixed(2)}%`);
  }
  
  // In a browser environment with chart.js, you would use code like this:
  /*
  const ctx = document.getElementById(elementId).getContext('2d');
  const data = symbols.map(symbol => ({
    x: volatility[symbol] * 100,
    y: expectedReturns[symbol] * 100,
    label: symbol
  }));
  
  new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Risk vs. Return',
        data: data,
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        pointRadius: 8,
        pointHoverRadius: 10
      }]
    },
    options: {
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
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const point = context.raw;
              return `${point.label}: Return ${point.y.toFixed(2)}%, Risk ${point.x.toFixed(2)}%`;
            }
          }
        },
        title: {
          display: true,
          text: 'Risk-Return Analysis'
        }
      }
    }
  });
  */
}

/**
 * Creates a heatmap visualization of the correlation matrix
 * @param {Array} symbols - Array of asset symbols
 * @param {Array} correlationMatrix - Correlation matrix
 * @param {String} elementId - DOM element ID to render the chart
 */
function createCorrelationHeatmap(symbols, correlationMatrix, elementId) {
  // This is a placeholder function that would use chart.js in a browser environment
  
  console.log('Correlation Matrix:');
  console.log(`\t${symbols.join('\t')}`);
  
  // Print the correlation matrix
  for (let i = 0; i < symbols.length; i++) {
    let row = `${symbols[i]}\t`;
    for (let j = 0; j < symbols.length; j++) {
      row += `${correlationMatrix[i][j].toFixed(2)}\t`;
    }
    console.log(row);
  }
  
  // In a browser environment with chart.js, you would use code like this:
  /*
  const ctx = document.getElementById(elementId).getContext('2d');
  
  // Prepare data for heatmap
  const data = [];
  for (let i = 0; i < symbols.length; i++) {
    for (let j = 0; j < symbols.length; j++) {
      data.push({
        x: symbols[j],
        y: symbols[i],
        v: correlationMatrix[i][j]
      });
    }
  }
  
  new Chart(ctx, {
    type: 'matrix',
    data: {
      datasets: [{
        label: 'Correlation Matrix',
        data: data,
        backgroundColor: function(context) {
          const value = context.dataset.data[context.dataIndex].v;
          const alpha = 0.8;
          
          if (value > 0) {
            // Positive correlation - blue shades
            return `rgba(54, 162, 235, ${Math.abs(value) * alpha})`;
          } else {
            // Negative correlation - red shades
            return `rgba(255, 99, 132, ${Math.abs(value) * alpha})`;
          }
        },
        borderColor: 'white',
        borderWidth: 1,
        width: 30,
        height: 30
      }]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            title: function() {
              return 'Correlation';
            },
            label: function(context) {
              const v = context.dataset.data[context.dataIndex];
              return `${v.y} vs ${v.x}: ${v.v.toFixed(2)}`;
            }
          }
        },
        title: {
          display: true,
          text: 'Asset Correlation Heatmap'
        },
        legend: {
          display: false
        }
      }
    }
  });
  */
}

/**
 * Simulates portfolio performance based on allocations
 * @param {Object} allocations - Asset allocations
 * @param {Object} expectedReturns - Expected returns by symbol
 * @param {Object} volatility - Volatility by symbol
 * @param {Array} correlationMatrix - Correlation matrix
 * @param {Number} initialValue - Starting portfolio value
 * @param {Number} years - Number of years to simulate
 * @param {Number} simulations - Number of Monte Carlo simulations
 * @returns {Array} - Simulation results
 */
function simulatePortfolio(allocations, expectedReturns, volatility, correlationMatrix, initialValue = 1000, years = 10, simulations = 1000) {
  // This is a simplified Monte Carlo simulation to project portfolio performance
  
  const symbols = Object.keys(allocations);
  const n = symbols.length;
  const timeSteps = years * 12; // Monthly simulation
  
  // Prepare results array
  const results = {
    timePoints: Array(timeSteps + 1).fill(0).map((_, i) => i / 12), // Time in years
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
  
  for (const symbol of symbols) {
    // Monthly return: (1 + r_annual)^(1/12) - 1
    monthlyReturns[symbol] = Math.pow(1 + expectedReturns[symbol], 1/12) - 1;
    
    // Monthly volatility: annual_vol / sqrt(12)
    monthlyVolatility[symbol] = volatility[symbol] / Math.sqrt(12);
  }
  
  // Track simulation paths
  const allPaths = Array(simulations).fill(0).map(() => Array(timeSteps + 1).fill(initialValue));
  
  // Run simulations
  for (let sim = 0; sim < simulations; sim++) {
    let currentValue = initialValue;
    allPaths[sim][0] = currentValue;
    
    for (let t = 1; t <= timeSteps; t++) {
      // Calculate portfolio return for this time step
      let portfolioReturn = 0;
      
      // Simplified approach: independently sample returns for each asset
      for (const symbol of symbols) {
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
 * Generates a random sample from a standard normal distribution
 * using the Box-Muller transform
 * @returns {Number} - Random normal value
 */
function randomNormal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Convert [0,1) to (0,1)
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Creates a line chart to visualize portfolio simulation
 * @param {Object} simulationResults - Results from simulatePortfolio
 * @param {String} elementId - DOM element ID to render the chart
 */
function createSimulationChart(simulationResults, elementId) {
  // This is a placeholder function that would use chart.js in a browser environment
  
  console.log('Portfolio Simulation Results:');
  console.log('Year\tAvg Value\tMedian\t5th %ile\t95th %ile');
  
  // Print simulation results
  const { timePoints, portfolioValues, percentiles } = simulationResults;
  for (let i = 0; i < timePoints.length; i += 12) { // Annual data points
    console.log(
      `${timePoints[i].toFixed(1)}\t` +
      `$${portfolioValues[i].toFixed(2)}\t` +
      `$${percentiles.p50[i].toFixed(2)}\t` +
      `$${percentiles.p5[i].toFixed(2)}\t` +
      `$${percentiles.p95[i].toFixed(2)}`
    );
  }
  
  // In a browser environment with chart.js, you would use code like this:
  /*
  const ctx = document.getElementById(elementId).getContext('2d');
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: timePoints,
      datasets: [
        {
          label: 'Average Portfolio Value',
          data: portfolioValues,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderWidth: 2,
          fill: false
        },
        {
          label: '5th-95th Percentile Range',
          data: timePoints.map((_, i) => ({
            x: timePoints[i],
            y: percentiles.p5[i],
            y1: percentiles.p95[i]
          })),
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderWidth: 0,
          fill: true
        },
        {
          label: '25th-75th Percentile Range',
          data: timePoints.map((_, i) => ({
            x: timePoints[i],
            y: percentiles.p25[i],
            y1: percentiles.p75[i]
          })),
          backgroundColor: 'rgba(54, 162, 235, 0.4)',
          borderWidth: 0,
          fill: true
        },
        {
          label: 'Median (50th Percentile)',
          data: percentiles.p50,
          borderColor: 'rgba(255, 159, 64, 1)',
          backgroundColor: 'rgba(255, 159, 64, 0.2)',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false
        }
      ]
    },
    options: {
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
      },
      plugins: {
        title: {
          display: true,
          text: 'Portfolio Performance Simulation'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      }
    }
  });
  */
}

module.exports = {
  createAllocationChart,
  createRiskReturnChart,
  createCorrelationHeatmap,
  simulatePortfolio,
  createSimulationChart,
  randomNormal
};
