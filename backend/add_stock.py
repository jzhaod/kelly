"""
Command-line utility to add a new stock to stock_settings.json with real data.
"""
import json
import os
import sys
from fetch_volatility import get_stock_volatility_and_returns

def add_stock(symbol):
    """
    Add a new stock to stock_settings.json with real volatility and expected return data.
    
    Args:
        symbol (str): Stock symbol to add
    
    Returns:
        bool: True if successful, False otherwise
    """
    # Path to stock_settings.json
    settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stock_settings.json")
    
    # Convert symbol to uppercase
    symbol = symbol.upper()
    
    # Load current settings
    try:
        with open(settings_path, 'r') as f:
            settings = json.load(f)
    except Exception as e:
        print(f"Error loading settings: {e}")
        return False
    
    # Check if stock already exists
    if symbol in settings['stocks']:
        print(f"Stock {symbol} already exists in settings")
        return False
    
    # Calculate volatility and expected returns
    print(f"Fetching data for {symbol}...")
    stock_data = get_stock_volatility_and_returns([symbol], period="5y")
    
    # Add to settings
    if symbol in stock_data and stock_data[symbol]['volatility'] is not None and stock_data[symbol]['expectedReturn'] is not None:
        settings['stocks'][symbol] = {
            'volatility': stock_data[symbol]['volatility'],
            'expectedReturn': stock_data[symbol]['expectedReturn']
        }
        
        # Save updated settings
        try:
            with open(settings_path, 'w') as f:
                json.dump(settings, f, indent=2)
            print(f"Successfully added {symbol} with:")
            print(f"  Expected Return: {stock_data[symbol]['expectedReturn']}%")
            print(f"  Volatility: {stock_data[symbol]['volatility']}%")
            return True
        except Exception as e:
            print(f"Error saving settings: {e}")
            return False
    else:
        print(f"Failed to fetch data for {symbol}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python add_stock.py SYMBOL")
        sys.exit(1)
    
    symbol = sys.argv[1]
    success = add_stock(symbol)
    sys.exit(0 if success else 1)
