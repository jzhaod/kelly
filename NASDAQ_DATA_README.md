# NASDAQ Data Fetcher for Kelly Criterion Portfolio Allocation

This document explains the new NASDAQ data fetching functionality added to the Kelly Criterion Portfolio Allocation tool.

## Overview

The original implementation used Yahoo Finance (via the `yfinance` Python library) to fetch historical stock data. This update adds the ability to fetch data directly from NASDAQ.com as an alternative data source.

## New Files

1. `fetch_volatility_nasdaq.py` - Core implementation for fetching and processing NASDAQ stock data
2. `update_stock_data_nasdaq.py` - Updates stock settings using NASDAQ data
3. `add_stock_nasdaq.py` - Command-line utility to add a new stock with NASDAQ data

## Requirements

The NASDAQ data fetcher requires the following Python packages:
- requests
- beautifulsoup4
- pandas
- numpy

These will be automatically installed if missing when you run the scripts.

## Usage

### Updating All Stocks with NASDAQ Data

To update all stocks in your settings with NASDAQ data:

```bash
python update_stock_data_nasdaq.py
```

This will:
1. Load your current stock symbols from `stock_settings.json`
2. Fetch 5-year historical data from NASDAQ.com for each symbol
3. Calculate volatility and expected returns
4. Update your settings file with the new values

### Adding a New Stock with NASDAQ Data

To add a new stock using NASDAQ data:

```bash
python add_stock_nasdaq.py SYMBOL
```

For example, to add Apple:

```bash
python add_stock_nasdaq.py AAPL
```

### Fetching Data Directly

You can also use the NASDAQ data fetcher directly in your scripts:

```python
from fetch_volatility_nasdaq import get_stock_volatility_and_returns

# Get volatility and expected returns for multiple stocks
stocks = ["AAPL", "MSFT", "GOOGL"]
results = get_stock_volatility_and_returns(stocks, period="y5")
print(results)
```

## Available Time Periods

The NASDAQ data fetcher supports the following time periods:
- `y1` - 1 year
- `y3` - 3 years
- `y5` - 5 years (default)
- `y10` - 10 years

## Caching

The data fetcher includes a caching mechanism to avoid unnecessary requests to NASDAQ.com. 
Fetched data is cached for 1 day by default in the `cache` directory.

## Implementation Notes

1. **Web Scraping**: The NASDAQ data fetcher uses web scraping techniques to extract data from NASDAQ.com's HTML pages.

2. **Rate Limiting**: The script includes a 1-second delay between requests to avoid being blocked by NASDAQ.com.

3. **Data Processing**: The fetcher processes the raw HTML data to create a structured DataFrame with the same columns and format as the original Yahoo Finance data, making it a drop-in replacement.

4. **Pagination Handling**: The script automatically handles pagination to retrieve more data than what is shown on a single page.

## Troubleshooting

If you encounter issues with the NASDAQ data fetcher:

1. **No Data Found**: Check that the stock symbol is valid on NASDAQ.com. The symbol may be different from other platforms.

2. **Access Blocked**: If you make too many requests in a short time, NASDAQ.com may temporarily block your IP address. Wait a while before trying again.

3. **Format Changes**: If NASDAQ.com changes its website layout, the scraper may stop working. Check for updates to the script.

## Switching Back to Yahoo Finance

If you need to switch back to Yahoo Finance, just use the original scripts:
- `update_stock_data.py` instead of `update_stock_data_nasdaq.py`
- `add_stock.py` instead of `add_stock_nasdaq.py`
