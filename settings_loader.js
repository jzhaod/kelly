/**
 * Settings Loader
 * 
 * Provides a consistent way to access settings from stock_settings.json
 * to ensure a single source of truth for financial parameters.
 */

const fs = require('fs');
const path = require('path');

// Path to settings file
const SETTINGS_FILE = path.join(__dirname, 'stock_settings.json');

// Default values for required parameters (used for repair only)
const DEFAULT_PARAMETERS = {
  marketReturn: 10,
  marketVolatility: 20,
  annualizationFactor: 252,
  volatilityPeriod: 150
};

/**
 * Load all settings from the stock_settings.json file
 * @returns {Object} The complete settings object
 */
function loadSettings() {
  try {
    const settingsData = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(settingsData);
  } catch (error) {
    console.error(`Error loading settings from ${SETTINGS_FILE}:`, error.message);
    throw new Error(`Failed to load required settings: ${error.message}`);
  }
}

/**
 * Get financial calculation parameters needed for various calculations
 * @returns {Object} Object containing financial parameters
 */
function getFinancialParameters() {
  const settings = loadSettings();
  
  // Check for required parameters and throw errors if missing
  if (typeof settings.riskFreeRate !== 'number') {
    throw new Error('Missing required parameter: riskFreeRate in stock_settings.json');
  }
  
  if (typeof settings.marketReturn !== 'number') {
    throw new Error('Missing required parameter: marketReturn in stock_settings.json');
  }
  
  if (typeof settings.marketVolatility !== 'number') {
    throw new Error('Missing required parameter: marketVolatility in stock_settings.json');
  }
  
  if (typeof settings.annualizationFactor !== 'number') {
    throw new Error('Missing required parameter: annualizationFactor in stock_settings.json');
  }
  
  if (typeof settings.volatilityPeriod !== 'number') {
    throw new Error('Missing required parameter: volatilityPeriod in stock_settings.json');
  }
  
  // Convert percentage values to decimals
  return {
    riskFreeRate: settings.riskFreeRate / 100,
    marketReturn: settings.marketReturn / 100,
    marketVolatility: settings.marketVolatility / 100,
    annualizationFactor: settings.annualizationFactor,
    volatilityPeriod: settings.volatilityPeriod
  };
}

/**
 * Ensures that all required parameters exist in the settings file
 * If they don't, it adds them with default values and saves the file
 * This is a safeguard against parameter loss when editing settings
 * @returns {Promise<boolean>} True if repair was successful
 */
async function ensureRequiredParameters() {
  try {
    // Read current settings
    let settings;
    try {
      const settingsData = fs.readFileSync(SETTINGS_FILE, 'utf8');
      settings = JSON.parse(settingsData);
    } catch (error) {
      console.error(`Error reading settings file for repair: ${error.message}`);
      return false;
    }
    
    // Check if any parameters are missing
    let needsRepair = false;
    
    // Check each required parameter
    for (const param of ['marketReturn', 'marketVolatility', 'annualizationFactor', 'volatilityPeriod']) {
      if (settings[param] === undefined) {
        console.warn(`Missing required parameter: ${param}, adding default value ${DEFAULT_PARAMETERS[param]}`);
        settings[param] = DEFAULT_PARAMETERS[param];
        needsRepair = true;
      }
    }
    
    // If repairs were needed, save the file
    if (needsRepair) {
      const backupPath = `${SETTINGS_FILE}.backup`;
      
      // Create backup
      try {
        fs.writeFileSync(backupPath, fs.readFileSync(SETTINGS_FILE));
        console.log(`Created backup at ${backupPath}`);
      } catch (backupError) {
        console.warn(`Failed to create settings backup: ${backupError.message}`);
      }
      
      // Write repaired settings
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
      console.log('Repaired settings file with missing parameters');
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to repair settings file: ${error.message}`);
    return false;
  }
}

module.exports = {
  loadSettings,
  getFinancialParameters,
  ensureRequiredParameters
};