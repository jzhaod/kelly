/**
 * Unit tests for the utils.js module
 */

const utils = require('./utils');

// Mocks for testing
const mockReturns = [0.01, -0.005, 0.02, -0.01, 0.015, -0.02, 0.01];
const mockPrices = [100, 101, 100.5, 102.5, 101.5, 103, 101];

describe('calculateVolatility', () => {
  test('should correctly calculate volatility from returns', () => {
    const volatility = utils.calculateVolatility(mockReturns);
    expect(volatility).toBeGreaterThan(0);
    expect(Number.isFinite(volatility)).toBe(true);
  });
  
  test('should throw error for invalid inputs', () => {
    expect(() => utils.calculateVolatility([])).toThrow();
    expect(() => utils.calculateVolatility([0.01])).toThrow();
    expect(() => utils.calculateVolatility(null)).toThrow();
  });
  
  test('should handle filtering extreme values', () => {
    const returnsWithOutlier = [...mockReturns, 0.5]; // 50% return is an outlier
    const volatility1 = utils.calculateVolatility(mockReturns);
    const volatility2 = utils.calculateVolatility(returnsWithOutlier);
    
    // Volatility should not be massively impacted by the outlier due to filtering
    expect(Math.abs(volatility1 - volatility2)).toBeLessThan(0.1);
  });
});

describe('calculateExpectedReturnCAPM', () => {
  test('should correctly calculate expected return using CAPM', () => {
    const beta = 1.2;
    const riskFreeRate = 0.04;
    const marketReturn = 0.10;
    
    const expectedReturn = utils.calculateExpectedReturnCAPM(beta, riskFreeRate, marketReturn);
    
    // Expected return = Rf + β(Rm - Rf) = 0.04 + 1.2 * (0.10 - 0.04) = 0.04 + 0.072 = 0.112
    expect(expectedReturn).toBeCloseTo(0.112, 3);
  });
  
  test('should apply upper and lower bounds', () => {
    // Lower bound test (0%)
    const lowReturn = utils.calculateExpectedReturnCAPM(-2, 0.04, 0.06);
    expect(lowReturn).toBeCloseTo(0, 10);
    
    // Upper bound test (60%)
    const highReturn = utils.calculateExpectedReturnCAPM(10, 0.04, 0.10);
    expect(highReturn).toBe(0.6);
  });
  
  test('should throw error for invalid inputs', () => {
    expect(() => utils.calculateExpectedReturnCAPM(NaN, 0.04, 0.10)).toThrow();
    expect(() => utils.calculateExpectedReturnCAPM(1.2, NaN, 0.10)).toThrow();
    expect(() => utils.calculateExpectedReturnCAPM(1.2, 0.04, NaN)).toThrow();
  });
});

describe('calculateBeta', () => {
  test('should correctly calculate beta', () => {
    const stockVolatility = 0.30;
    const marketVolatility = 0.20;
    
    const beta = utils.calculateBeta(stockVolatility, marketVolatility);
    
    // Beta = Stock Volatility / Market Volatility = 0.30 / 0.20 = 1.5
    expect(beta).toBeCloseTo(1.5, 10);
  });
  
  test('should throw error for invalid inputs', () => {
    expect(() => utils.calculateBeta(-0.1, 0.2)).toThrow();
    expect(() => utils.calculateBeta(0.3, -0.1)).toThrow();
    expect(() => utils.calculateBeta(0, 0.2)).toThrow();
    expect(() => utils.calculateBeta(0.3, 0)).toThrow();
    expect(() => utils.calculateBeta(NaN, 0.2)).toThrow();
  });
});

describe('calculateDailyReturns', () => {
  test('should correctly calculate daily returns from prices', () => {
    const returns = utils.calculateDailyReturns(mockPrices);
    
    expect(returns.length).toBe(mockPrices.length - 1);
    
    // Calculate expected returns manually for verification
    const expectedReturns = [];
    for (let i = 1; i < mockPrices.length; i++) {
      expectedReturns.push((mockPrices[i] - mockPrices[i-1]) / mockPrices[i-1]);
    }
    
    // Compare calculated returns with expected values
    for (let i = 0; i < returns.length; i++) {
      expect(returns[i]).toBeCloseTo(expectedReturns[i], 10);
    }
  });
  
  test('should throw error for invalid inputs', () => {
    expect(() => utils.calculateDailyReturns([])).toThrow();
    expect(() => utils.calculateDailyReturns([100])).toThrow();
    expect(() => utils.calculateDailyReturns(null)).toThrow();
  });
});

describe('calculateCorrelationMatrix', () => {
  test('should correctly calculate correlation matrix', () => {
    const returns = {
      'A': [0.01, -0.01, 0.02, -0.005],
      'B': [0.005, -0.01, 0.015, -0.01]
    };
    
    const result = utils.calculateCorrelationMatrix(returns);
    
    expect(result).toHaveProperty('correlationMatrix');
    expect(result).toHaveProperty('symbols');
    expect(result.symbols).toEqual(['A', 'B']);
    expect(result.correlationMatrix.length).toBe(2);
    expect(result.correlationMatrix[0].length).toBe(2);
    
    // Diagonal elements should be 1 (self-correlation)
    expect(result.correlationMatrix[0][0]).toBe(1);
    expect(result.correlationMatrix[1][1]).toBe(1);
    
    // Correlation between A and B should be a value between -1 and 1
    expect(result.correlationMatrix[0][1]).toBeGreaterThan(-1.001);
    expect(result.correlationMatrix[0][1]).toBeLessThan(1.001);
    
    // Matrix should be symmetric
    expect(result.correlationMatrix[0][1]).toBe(result.correlationMatrix[1][0]);
  });
  
  test('should handle missing or invalid return data', () => {
    const returns = {
      'A': [0.01, -0.01, 0.02, -0.005],
      'B': [] // Empty returns
    };
    
    const result = utils.calculateCorrelationMatrix(returns);
    
    // Should expect null for missing data in our improved implementation
    expect(result.correlationMatrix[0][1]).toBe(null); // Missing data is marked as null
  });
  
  test('should throw error for invalid inputs', () => {
    expect(() => utils.calculateCorrelationMatrix(null)).toThrow();
    expect(() => utils.calculateCorrelationMatrix({})).toThrow();
  });
});

describe('calculateRiskReturnRatio', () => {
  test('should correctly calculate risk/return ratio', () => {
    const expectedReturn = 0.15;
    const volatility = 0.30;
    
    const ratio = utils.calculateRiskReturnRatio(expectedReturn, volatility);
    
    // Risk/Return Ratio = Expected Return / Volatility = 0.15 / 0.30 = 0.5
    expect(ratio).toBe(0.5);
  });
  
  test('should throw error for invalid inputs', () => {
    expect(() => utils.calculateRiskReturnRatio(NaN, 0.3)).toThrow();
    expect(() => utils.calculateRiskReturnRatio(0.15, NaN)).toThrow();
    expect(() => utils.calculateRiskReturnRatio(0.15, 0)).toThrow();
    expect(() => utils.calculateRiskReturnRatio(0.15, -0.1)).toThrow();
  });
});

describe('calculateSharpeRatio', () => {
  test('should correctly calculate Sharpe ratio', () => {
    const expectedReturn = 0.15;
    const volatility = 0.30;
    const riskFreeRate = 0.04;
    
    const sharpe = utils.calculateSharpeRatio(expectedReturn, volatility, riskFreeRate);
    
    // Sharpe Ratio = (Expected Return - Risk-Free Rate) / Volatility = (0.15 - 0.04) / 0.30 = 0.11 / 0.30 = 0.3667
    expect(sharpe).toBeCloseTo(0.3667, 4);
  });
  
  test('should throw error for invalid inputs', () => {
    expect(() => utils.calculateSharpeRatio(NaN, 0.3, 0.04)).toThrow();
    expect(() => utils.calculateSharpeRatio(0.15, NaN, 0.04)).toThrow();
    expect(() => utils.calculateSharpeRatio(0.15, 0.3, NaN)).toThrow();
    expect(() => utils.calculateSharpeRatio(0.15, 0, 0.04)).toThrow();
  });
});

describe('analyzePortfolio', () => {
  test('should correctly analyze a portfolio of stocks', () => {
    const historicalData = {
      'A': { prices: [100, 102, 101, 104, 105] },
      'B': { prices: [50, 51, 49, 52, 53] }
    };
    
    const analysis = utils.analyzePortfolio(historicalData);
    
    expect(analysis).toHaveProperty('symbols');
    expect(analysis).toHaveProperty('volatility');
    expect(analysis).toHaveProperty('expectedReturns');
    expect(analysis).toHaveProperty('beta');
    expect(analysis).toHaveProperty('correlationMatrix');
    expect(analysis).toHaveProperty('riskReturnMetrics');
    
    expect(analysis.symbols).toContain('A');
    expect(analysis.symbols).toContain('B');
    expect(Object.keys(analysis.volatility)).toContain('A');
    expect(Object.keys(analysis.expectedReturns)).toContain('A');
  });
  
  test('should handle missing or invalid data', () => {
    const historicalData = {
      'A': { prices: [100, 102, 101, 104, 105] },
      'B': { prices: [] } // Empty prices
    };
    
    const analysis = utils.analyzePortfolio(historicalData);
    
    // Should still analyze the valid stock
    expect(analysis.symbols).toContain('A');
    expect(analysis.symbols).not.toContain('B');
  });
  
  test('should throw error for invalid inputs', () => {
    expect(() => utils.analyzePortfolio(null)).toThrow();
    expect(() => utils.analyzePortfolio({})).toThrow();
  });
});