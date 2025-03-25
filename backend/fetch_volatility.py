"""
Fetch historical price data and calculate volatility for a list of stocks.
"""
import numpy as np
import pandas as pd
import json
import os
import time
from datetime import datetime, timedelta

# Try to import yfinance, install if not available
try:
    import yfinance as yf
except ImportError:
    import subprocess
    print("Installing yfinance...")
    subprocess.check_call(["pip", "install", "yfinance"])
    import yfinance as yf

def fetch_historical_data(symbols, period="1y"):
    """
    Fetch historical data for a list of stock symbols.
    
    Args:
        symbols (list): List of stock symbols
        period (str): Time period to fetch (default: "1y")
    
    Returns:
        pandas.DataFrame: DataFrame with historical data
    """
    print(f"Fetching historical data for {symbols}...")
    try:
        data = yf.download(symbols, period=period, group_by="ticker")
        return data
    except Exception as e:
        print(f"Error fetching data: {e}")
        return None

def calculate_annualized_volatility(symbol_data):
    """
    Calculate annualized volatility from daily price data.
    
    Args:
        symbol_data (pandas.DataFrame): DataFrame with historical price data for a symbol
    
    Returns:
        float: Annualized volatility
    """
    # Calculate daily logarithmic returns
    daily_returns = np.log(symbol_data['Adj Close'] / symbol_data['Adj Close'].shift(1))
    
    # Drop NaN values
    daily_returns = daily_returns.dropna()
    
    # Calculate daily standard deviation
    daily_std = daily_returns.std()
    
    # Annualize (approx. 252 trading days in a year)
    annualized_volatility = daily_std * np.sqrt(252) * 100  # Convert to percentage
    
    return annualized_volatility

def calculate_expected_return(symbol_data):
    """
    Calculate expected annual return based on historical data.
    
    Args:
        symbol_data (pandas.DataFrame): DataFrame with historical price data for a symbol
    
    Returns:
        float: Expected annual return as a percentage
    """
    # Get first and last adjusted close price
    first_price = symbol_data['Adj Close'].iloc[0]
    last_price = symbol_data['Adj Close'].iloc[-1]
    
    # Calculate total return
    total_return = (last_price / first_price) - 1
    
    # Convert to annual return (based on number of days)
    days = (symbol_data.index[-1] - symbol_data.index[0]).days
    annual_return = ((1 + total_return) ** (365 / days) - 1) * 100  # Convert to percentage
    
    return annual_return

def get_stock_volatility_and_returns(symbols, period="1y"):
    """
    Get volatility and expected returns for a list of stocks.
    
    Args:
        symbols (list): List of stock symbols
        period (str): Time period to fetch (default: "1y")
    
    Returns:
        dict: Dictionary with volatility and expected returns for each symbol
    """
    # Create a cache directory if it doesn't exist
    cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    # Create a cache file path
    cache_file = os.path.join(cache_dir, f"volatility_cache_{period}.json")
    
    # Check if cache exists and is less than 1 day old
    cache_exists = os.path.exists(cache_file)
    cache_fresh = False
    
    if cache_exists:
        file_mod_time = datetime.fromtimestamp(os.path.getmtime(cache_file))
        cache_fresh = (datetime.now() - file_mod_time) < timedelta(days=1)
    
    # If cache exists and is fresh, load the data
    if cache_exists and cache_fresh:
        try:
            with open(cache_file, 'r') as f:
                cache_data = json.load(f)
                
            # Check if all symbols are in the cache
            missing_symbols = [s for s in symbols if s not in cache_data]
            
            if not missing_symbols:
                # Create a results dictionary with only the requested symbols
                results = {s: cache_data[s] for s in symbols}
                return results
        except Exception as e:
            print(f"Error reading cache: {e}")
    
    # Either cache doesn't exist, isn't fresh, or is missing symbols
    # Fetch all data
    data = fetch_historical_data(symbols, period)
    
    if data is None:
        print("Failed to fetch data, returning empty results")
        return {}
    
    results = {}
    cache_data = {} if not (cache_exists and cache_fresh) else cache_data
    
    # Process each symbol
    for symbol in symbols:
        try:
            if len(symbols) == 1:
                # If only one symbol, data isn't grouped by ticker
                symbol_data = data
            else:
                # Extract data for this symbol
                symbol_data = data[symbol]
            
            # Calculate volatility and expected return
            volatility = calculate_annualized_volatility(symbol_data)
            expected_return = calculate_expected_return(symbol_data)
            
            # Store results
            results[symbol] = {
                "volatility": round(float(volatility), 2),
                "expectedReturn": round(float(expected_return), 2)
            }
            
            # Update cache
            cache_data[symbol] = results[symbol]
            
        except Exception as e:
            print(f"Error processing {symbol}: {e}")
            results[symbol] = {
                "volatility": None,
                "expectedReturn": None
            }
    
    # Save to cache
    try:
        with open(cache_file, 'w') as f:
            json.dump(cache_data, f)
    except Exception as e:
        print(f"Error writing cache: {e}")
    
    return results

if __name__ == "__main__":
    # Example usage
    symbols = ["TSLA", "NVDA", "CPNG", "SHOP", "MELI"]
    results = get_stock_volatility_and_returns(symbols)
    print(json.dumps(results, indent=2))
