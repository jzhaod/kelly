"""
Fetch historical price data from NASDAQ.com via direct download and calculate volatility for a list of stocks.
"""
import numpy as np
import pandas as pd
import json
import os
import time
import io
from datetime import datetime, timedelta

# Required libraries
try:
    import requests
except ImportError:
    import subprocess
    print("Installing required libraries...")
    subprocess.check_call(["pip", "install", "requests"])
    import requests

def fetch_nasdaq_historical_data(symbol, period="y5"):
    """
    Fetch historical data for a stock symbol from NASDAQ.com using direct download.
    
    Args:
        symbol (str): Stock symbol
        period (str): Time period to fetch (default: "y5" for 5 years)
    
    Returns:
        pandas.DataFrame: DataFrame with historical data
    """
    print(f"Fetching NASDAQ historical data for {symbol} for period {period}...")
    
    # Direct download link for CSV data
    download_url = f"https://www.nasdaq.com/api/v1/historical/{symbol.lower()}/stocks/{period}"
    
    # Headers to mimic a browser request
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        # Add delay to avoid being blocked
        time.sleep(1)
        response = requests.get(download_url, headers=headers)
        
        if response.status_code != 200:
            print(f"Error fetching data for {symbol}: Status code {response.status_code}")
            return None
            
        # Check if we got CSV data
        content_type = response.headers.get('Content-Type', '')
        if 'text/csv' not in content_type and 'application/csv' not in content_type:
            # Try to check if it's JSON with CSV data
            try:
                json_response = response.json()
                if isinstance(json_response, dict) and 'data' in json_response:
                    csv_content = json_response['data']
                else:
                    csv_content = response.text
            except:
                csv_content = response.text
        else:
            csv_content = response.text
        
        # Process the CSV data
        try:
            # Read CSV from string
            df = pd.read_csv(io.StringIO(csv_content))
            
            # Check if we have data
            if df.empty:
                print(f"No data found for {symbol}")
                return None
                
            # Process date column
            if 'Date' in df.columns:
                df['Date'] = pd.to_datetime(df['Date'])
                df = df.set_index('Date')
            
            # Clean price columns (remove $ and commas if needed)
            price_columns = ['Close/Last', 'Open', 'High', 'Low']
            for col in df.columns:
                if any(price_col in col for price_col in price_columns):
                    if df[col].dtype == object:  # Only process if it's a string
                        df[col] = df[col].replace('[$,]', '', regex=True).astype(float)
            
            # Rename columns to match our expected format
            column_mapping = {
                'Date': 'Date',
                'Close/Last': 'Close',
                'Volume': 'Volume',
                'Open': 'Open',
                'High': 'High',
                'Low': 'Low'
            }
            
            # Create a new DataFrame with renamed columns
            processed_df = pd.DataFrame()
            
            for nasdaq_col, our_col in column_mapping.items():
                for col in df.columns:
                    if nasdaq_col in col:
                        processed_df[our_col] = df[col]
                        break
            
            # Add Adj Close column (same as Close for now since NASDAQ doesn't provide this)
            processed_df['Adj Close'] = processed_df['Close']
            
            # Sort by date (oldest to newest)
            processed_df = processed_df.sort_index()
            
            print(f"Successfully fetched {len(processed_df)} rows of data for {symbol}")
            return processed_df
            
        except Exception as e:
            print(f"Error processing CSV data for {symbol}: {e}")
            # Try to save the response for debugging
            debug_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "debug")
            os.makedirs(debug_dir, exist_ok=True)
            with open(os.path.join(debug_dir, f"{symbol}_response.txt"), 'w') as f:
                f.write(csv_content[:1000])  # Save first 1000 chars
            return None
            
    except Exception as e:
        print(f"Error fetching data for {symbol}: {e}")
        return None

def fetch_historical_data(symbols, period="y5"):
    """
    Fetch historical data for a list of stock symbols from NASDAQ.
    
    Args:
        symbols (list): List of stock symbols
        period (str): Time period to fetch (default: "y5" for 5 years)
    
    Returns:
        dict: Dictionary with DataFrames for each symbol
    """
    print(f"Fetching historical data for {symbols}...")
    result = {}
    
    for symbol in symbols:
        try:
            data = fetch_nasdaq_historical_data(symbol, period)
            if data is not None:
                result[symbol] = data
        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
    
    return result

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
    # Avoid division by zero
    if days == 0:
        print("Warning: Only one day of data available. Cannot calculate annualized return.")
        return 0.0
        
    annual_return = ((1 + total_return) ** (365 / days) - 1) * 100  # Convert to percentage
    
    return annual_return

def get_stock_volatility_and_returns(symbols, period="y5"):
    """
    Get volatility and expected returns for a list of stocks.
    
    Args:
        symbols (list): List of stock symbols
        period (str): Time period to fetch (default: "y5" for 5 years)
    
    Returns:
        dict: Dictionary with volatility and expected returns for each symbol
    """
    # Create a cache directory if it doesn't exist
    cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    # Create a cache file path
    cache_file = os.path.join(cache_dir, f"nasdaq_volatility_cache_{period}.json")
    
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
    data_dict = fetch_historical_data(symbols, period)
    
    if not data_dict:
        print("Failed to fetch data, returning empty results")
        return {}
    
    results = {}
    cache_data = {} if not (cache_exists and cache_fresh) else cache_data
    
    # Process each symbol
    for symbol in symbols:
        try:
            if symbol not in data_dict:
                print(f"No data available for {symbol}")
                results[symbol] = {
                    "volatility": None,
                    "expectedReturn": None
                }
                continue
                
            symbol_data = data_dict[symbol]
            
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

def save_historical_data_to_file(symbol, data, format="csv"):
    """
    Save historical data to a file for later use.
    
    Args:
        symbol (str): Stock symbol
        data (pandas.DataFrame): DataFrame with historical data
        format (str): File format ("csv" or "json")
    
    Returns:
        str: Path to the saved file
    """
    # Create data directory if it doesn't exist
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    os.makedirs(data_dir, exist_ok=True)
    
    # Create file path
    if format.lower() == "csv":
        file_path = os.path.join(data_dir, f"{symbol}.csv")
        data.to_csv(file_path)
    else:
        file_path = os.path.join(data_dir, f"{symbol}.json")
        data.to_json(file_path, orient="records", date_format="iso")
    
    print(f"Saved historical data for {symbol} to {file_path}")
    return file_path

if __name__ == "__main__":
    # Example usage
    symbols = ["TSLA", "NVDA", "CPNG", "SHOP", "MELI"]
    
    # Fetch and save historical data for each symbol
    data_dict = fetch_historical_data(symbols)
    for symbol, data in data_dict.items():
        if data is not None:
            save_historical_data_to_file(symbol, data)
    
    # Calculate and print volatility and expected returns
    results = get_stock_volatility_and_returns(symbols)
    print(json.dumps(results, indent=2))
