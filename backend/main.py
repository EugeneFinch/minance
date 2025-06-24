from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from binance.client import Client
import asyncio
from fastapi.middleware.cors import CORSMiddleware
import time
import math
import traceback
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://minance-ashen.vercel.app"
    ],  # Allow local dev and Vercel prod frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BalanceRequest(BaseModel):
    api_key: str
    api_secret: str

class Asset(BaseModel):
    symbol: str
    amount: float
    price: float
    value_usdt: float

class SellRequest(BaseModel):
    api_key: str
    api_secret: str
    sell: List[dict]  # Each dict: {symbol: str, amount: float}

class BuyRequest(BaseModel):
    api_key: str
    api_secret: str
    buy: List[dict]  # Each dict: {symbol: str, amount: float}

def adjust_to_integer(amount):
    return int(math.floor(amount))

def get_price_with_fallback(symbol, prices):
    pair = symbol + 'USDT'
    price = prices.get(pair, 0.0)
    if price > 0:
        return price
    # Try CoinGecko fallback
    try:
        # CoinGecko uses lowercase IDs, and some tokens need mapping
        symbol_map = {
            'SOLV': 'solv-protocol',
            # Add more mappings as needed
        }
        coingecko_id = symbol_map.get(symbol, symbol.lower())
        url = f'https://api.coingecko.com/api/v3/simple/price?ids={coingecko_id}&vs_currencies=usdt'
        resp = requests.get(url, timeout=5)
        if resp.ok:
            data = resp.json()
            price = data.get(coingecko_id, {}).get('usdt', 0.0)
            return float(price) if price else 0.0
    except Exception as e:
        print(f"[WARN] CoinGecko fallback failed for {symbol}: {e}")
    return 0.0

@app.post("/balance", response_model=List[Asset])
def get_balance(data: BalanceRequest):
    try:
        client = Client(api_key=data.api_key, api_secret=data.api_secret)
        # Get account balances
        account_info = client.get_account()
        balances = [b for b in account_info['balances'] if float(b['free']) > 0 or float(b['locked']) > 0]
        # Get all prices
        prices = {p['symbol']: float(p['price']) for p in client.get_all_tickers()}
        assets = []
        for b in balances:
            symbol = b['asset']
            amount = float(b['free']) + float(b['locked'])
            if symbol == 'USDT':
                price = 1.0
                value = amount
            else:
                price = get_price_with_fallback(symbol, prices)
                value = amount * price
            assets.append(Asset(symbol=symbol, amount=amount, price=price, value_usdt=value))
        # Filter out assets with zero value
        assets = [a for a in assets if a.value_usdt > 0]
        return assets
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/sell")
def sell_assets(data: SellRequest):
    try:
        client = Client(api_key=data.api_key, api_secret=data.api_secret)
        account_info = client.get_account()
        balances = {b['asset']: float(b['free']) + float(b['locked']) for b in account_info['balances']}
        prices = {p['symbol']: float(p['price']) for p in client.get_all_tickers()}
        results = []
        for item in data.sell:
            symbol = item['symbol']
            req_amount = float(item['amount'])
            amount = balances.get(symbol, 0)
            price = get_price_with_fallback(symbol, prices)
            # If price < $1, round down to integer
            if price < 1:
                adj_amount = int(math.floor(req_amount))
            else:
                adj_amount = float(req_amount)
            if adj_amount <= 0 or symbol == 'USDT':
                continue
            try:
                pair = symbol + 'USDT'
                symbol_info = client.get_symbol_info(pair)
                print(f"[DEBUG] symbol_info for {pair}: {symbol_info}")
                lot_size = next((f for f in symbol_info['filters'] if f['filterType'] == 'LOT_SIZE'), None)
                min_notional = next((f for f in symbol_info['filters'] if f['filterType'] in ['MIN_NOTIONAL', 'NOTIONAL']), None)
                if not lot_size or not min_notional:
                    results.append({
                        'symbol': symbol,
                        'amount': adj_amount,
                        'price': price,
                        'actual_price': 0,
                        'usdt_received': 0,
                        'timestamp': int(time.time()),
                        'error': 'Required filter (LOT_SIZE or MIN_NOTIONAL) not found for this symbol. It may be delisted, not tradable for USDT, or have special trading rules.'
                    })
                    continue
                min_qty = float(lot_size['minQty'])
                min_notional_val = float(min_notional['minNotional'])
                trade_value = adj_amount * price
                print(f"[DEBUG] {symbol} sell attempt: original={amount}, req={req_amount}, adj={adj_amount}, price={price}, min_qty={min_qty}, min_notional={min_notional_val}, trade_value={trade_value}")
                if adj_amount < min_qty or trade_value < min_notional_val:
                    results.append({
                        'symbol': symbol,
                        'amount': adj_amount,
                        'price': price,
                        'actual_price': 0,
                        'usdt_received': 0,
                        'timestamp': int(time.time()),
                        'error': f'Amount {adj_amount} is below minQty {min_qty} or notional {trade_value} < minNotional {min_notional_val}'
                    })
                    continue
                order = client.create_order(
                    symbol=pair,
                    side='SELL',
                    type='MARKET',
                    quantity=adj_amount
                )
                fills = order.get('fills', [])
                usdt_received = sum([float(fill['qty']) * float(fill['price']) for fill in fills])
                total_qty = sum([float(fill['qty']) for fill in fills])
                actual_price = (usdt_received / total_qty) if total_qty > 0 else price
                result = {
                    'symbol': symbol,
                    'amount': adj_amount,
                    'price': price,
                    'actual_price': actual_price,
                    'usdt_received': usdt_received,
                    'timestamp': int(time.time())
                }
                if usdt_received == 0:
                    result['error'] = 'Order placed but no USDT received. Possible reason: dust, min notional, or Binance rejected the trade.'
                results.append(result)
            except Exception as oe:
                print(f"[ERROR] {symbol} sell failed: {repr(oe)}")
                traceback.print_exc()
                results.append({
                    'symbol': symbol,
                    'amount': adj_amount,
                    'price': price,
                    'actual_price': 0,
                    'usdt_received': 0,
                    'timestamp': int(time.time()),
                    'error': str(oe) or repr(oe)
                })
        return {"results": results}
    except Exception as e:
        print(f"[FATAL ERROR] /sell endpoint: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/sellable_assets")
def get_sellable_assets(data: BalanceRequest):
    try:
        client = Client(api_key=data.api_key, api_secret=data.api_secret)
        account_info = client.get_account()
        balances = [b for b in account_info['balances'] if float(b['free']) > 0 or float(b['locked']) > 0]
        prices = {p['symbol']: float(p['price']) for p in client.get_all_tickers()}
        sellable = []
        for b in balances:
            symbol = b['asset']
            amount = float(b['free']) + float(b['locked'])
            if symbol == 'USDT':
                continue
            price = get_price_with_fallback(symbol, prices)
            value = amount * price
            if value < 5:
                continue
            sellable.append({
                'symbol': symbol,
                'amount': amount,
                'price': price,
                'value_usdt': value
            })
        return sellable
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/buy")
def buy_assets(data: BuyRequest):
    try:
        client = Client(api_key=data.api_key, api_secret=data.api_secret)
        account_info = client.get_account()
        balances = {b['asset']: float(b['free']) + float(b['locked']) for b in account_info['balances']}
        prices = {p['symbol']: float(p['price']) for p in client.get_all_tickers()}
        results = []
        for item in data.buy:
            symbol = item['symbol']
            req_amount = float(item['amount'])
            price = get_price_with_fallback(symbol, prices)
            # If price < $1, round down to integer
            if price < 1:
                adj_amount = int(math.floor(req_amount))
            else:
                adj_amount = float(req_amount)
            if adj_amount <= 0 or symbol == 'USDT':
                continue
            try:
                pair = symbol + 'USDT'
                symbol_info = client.get_symbol_info(pair)
                print(f"[DEBUG] symbol_info for {pair}: {symbol_info}")
                lot_size = next((f for f in symbol_info['filters'] if f['filterType'] == 'LOT_SIZE'), None)
                min_notional = next((f for f in symbol_info['filters'] if f['filterType'] in ['MIN_NOTIONAL', 'NOTIONAL']), None)
                if not lot_size or not min_notional:
                    results.append({
                        'symbol': symbol,
                        'amount': adj_amount,
                        'price': price,
                        'actual_price': 0,
                        'usdt_spent': 0,
                        'timestamp': int(time.time()),
                        'error': 'Required filter (LOT_SIZE or MIN_NOTIONAL) not found for this symbol. It may be delisted, not tradable for USDT, or have special trading rules.'
                    })
                    continue
                min_qty = float(lot_size['minQty'])
                min_notional_val = float(min_notional['minNotional'])
                trade_value = adj_amount * price
                print(f"[DEBUG] {symbol} buy attempt: req={req_amount}, adj={adj_amount}, price={price}, min_qty={min_qty}, min_notional={min_notional_val}, trade_value={trade_value}")
                if adj_amount < min_qty or trade_value < min_notional_val:
                    results.append({
                        'symbol': symbol,
                        'amount': adj_amount,
                        'price': price,
                        'actual_price': 0,
                        'usdt_spent': 0,
                        'timestamp': int(time.time()),
                        'error': f'Amount {adj_amount} is below minQty {min_qty} or notional {trade_value} < minNotional {min_notional_val}'
                    })
                    continue
                order = client.create_order(
                    symbol=pair,
                    side='BUY',
                    type='MARKET',
                    quantity=adj_amount
                )
                fills = order.get('fills', [])
                usdt_spent = sum([float(fill['qty']) * float(fill['price']) for fill in fills])
                total_qty = sum([float(fill['qty']) for fill in fills])
                actual_price = (usdt_spent / total_qty) if total_qty > 0 else price
                result = {
                    'symbol': symbol,
                    'amount': adj_amount,
                    'price': price,
                    'actual_price': actual_price,
                    'usdt_spent': usdt_spent,
                    'timestamp': int(time.time())
                }
                if usdt_spent == 0:
                    result['error'] = 'Order placed but no USDT spent. Possible reason: dust, min notional, or Binance rejected the trade.'
                results.append(result)
            except Exception as oe:
                print(f"[ERROR] {symbol} buy failed: {repr(oe)}")
                traceback.print_exc()
                results.append({
                    'symbol': symbol,
                    'amount': adj_amount,
                    'price': price,
                    'actual_price': 0,
                    'usdt_spent': 0,
                    'timestamp': int(time.time()),
                    'error': str(oe) or repr(oe)
                })
        return {"results": results}
    except Exception as e:
        print(f"[FATAL ERROR] /buy endpoint: {e}")
        raise HTTPException(status_code=400, detail=str(e))

