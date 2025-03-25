"""
Update stock_settings.json with real volatility and expected return data from NASDAQ.com.
"""
import json
import os
from fetch_volatility_nasdaq import get_stock_volatility_and_returns

def update_stock_settings():
    """
    Update stock_settings.json with real volatility and expected return data from NASDAQ.
    """
    # Path to stock_settings.json
    settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stock_settings.json")
    
    # Load current settings
    try:
        with open(settings_path, 'r') as f:
            settings = json.load(f)
    except Exception as e:
        print(f"Error loading settings: {e}")
        return False
    
    # Get the list of stocks
    symbols = list(settings['stocks'].keys())
    
    # Calculate volatility and expected returns using NASDAQ data
    print(f"Calculating real volatility and expected returns for {symbols} using NASDAQ data...")
    stock_data = get_stock_volatility_and_returns(symbols, period="y5")
    
    # Update settings
    for symbol, data in stock_data.items():
        if symbol in settings['stocks'] and data['volatility'] is not None and data['expectedReturn'] is not None:
            settings['stocks'][symbol]['volatility'] = data['volatility']
            settings['stocks'][symbol]['expectedReturn'] = data['expectedReturn']
    
    # Save updated settings
    try:
        with open(settings_path, 'w') as f:
            json.dump(settings, f, indent=2)
        print(f"Successfully updated stock settings with real NASDAQ data")
        return True
    except Exception as e:
        print(f"Error saving settings: {e}")
        return False

if __name__ == "__main__":
    update_stock_settings()
