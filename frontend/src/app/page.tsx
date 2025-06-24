"use client";
import { useState, useEffect } from "react";

function ConfirmModal({ open, onConfirm, onCancel, assetCount }: { open: boolean, onConfirm: () => void, onCancel: () => void, assetCount: number }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="card p-8 flex flex-col items-center gap-4 max-w-md w-full border-2 border-red-500">
        <div className="text-2xl font-bold text-red-400 mb-2">Are you sure?</div>
        <div className="text-center text-[var(--color-text-secondary)] mb-4">
          You are about to <span className="text-red-400 font-bold">SELL {assetCount} ASSET{assetCount > 1 ? 'S' : ''}</span>.<br />
          This action is <span className="font-bold">not reversible</span>.<br />
          Do you want to proceed?
        </div>
        <div className="flex gap-4 w-full justify-center">
          <button className="btn bg-red-600 text-white font-bold py-2 px-6 rounded shadow-md hover:bg-red-700" onClick={onConfirm}>Yes, Sell</button>
          <button className="btn bg-gray-700 text-white font-bold py-2 px-6 rounded shadow-md hover:bg-gray-600" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// Helper for formatting USD
function formatUSD(val: number) {
  return val.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

// Helper for color for realized P/L
function plColor(val: number) {
  return val >= 0 ? 'text-green-500' : 'text-red-500';
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [connected, setConnected] = useState(false);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [realizedPL, setRealizedPL] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [nukeLoading, setNukeLoading] = useState(false);
  const [nukeResult, setNukeResult] = useState<any[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showBuyBack, setShowBuyBack] = useState(false);
  const [soldPortfolio, setSoldPortfolio] = useState<any[]>([]);
  const [buyBackSelection, setBuyBackSelection] = useState<string[]>([]);
  const [buyBackPrices, setBuyBackPrices] = useState<any>({});
  const [buyBackLoading, setBuyBackLoading] = useState(false);
  const [buyBackResult, setBuyBackResult] = useState<any[]>([]);
  const [buyBackSelectMode, setBuyBackSelectMode] = useState(false);
  const [showBuyBackConfirm, setShowBuyBackConfirm] = useState(false);
  const [refreshLiquidatedLoading, setRefreshLiquidatedLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'liquidated'>('portfolio');

  // Footer description
  const footerText = "This is a Binance-style portfolio viewer. Not financial advice. For demonstration purposes only.";

  // Minance header
  const header = (
    <header className="w-full flex flex-row items-center justify-center py-6 mb-2 bg-white">
      <span className="text-3xl font-extrabold tracking-widest text-black drop-shadow-sm" style={{ letterSpacing: '0.1em' }}>Minance</span>
    </header>
  );

  // Load API key/secret from sessionStorage on mount
  useEffect(() => {
    const storedKey = sessionStorage.getItem("binance_api_key");
    const storedSecret = sessionStorage.getItem("binance_api_secret");
    if (storedKey && storedSecret) {
      setApiKey(storedKey);
      setApiSecret(storedSecret);
      setConnected(true);
      // Optionally, auto-fetch portfolio here
    }
  }, []);

  // Load sold portfolio and realized P/L from localStorage on mount
  useEffect(() => {
    const sold = localStorage.getItem("soldPortfolio");
    if (sold) setSoldPortfolio(JSON.parse(sold));
    const pl = localStorage.getItem("realizedPL");
    if (pl) setRealizedPL(parseFloat(pl));
  }, []);

  // Fetch current prices for sold assets when Buy Back modal opens
  useEffect(() => {
    if (!showBuyBack || soldPortfolio.length === 0) return;
    const fetchPrices = async () => {
      try {
        const res = await fetch("http://localhost:8000/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const priceMap: any = {};
        data.forEach((a: any) => { priceMap[a.symbol] = a.price; });
        setBuyBackPrices(priceMap);
      } catch (e) {
        // ignore
      }
    };
    fetchPrices();
  }, [showBuyBack, soldPortfolio, apiKey, apiSecret]);

  async function handleConnect() {
    setLoading(true);
    setError("");
    try {
      sessionStorage.setItem("binance_api_key", apiKey);
      sessionStorage.setItem("binance_api_secret", apiSecret);
      const res = await fetch("http://localhost:8000/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to fetch portfolio");
      }
      const data = await res.json();
      // Only show assets with value >= $5
      const filtered = data.filter((a: any) => a.value_usdt >= 5);
      setPortfolio(filtered);
      setTotalValue(filtered.reduce((sum: number, a: any) => sum + a.value_usdt, 0));
      setConnected(true);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Add a refresh function
  async function handleRefreshPortfolio() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to fetch portfolio");
      }
      const data = await res.json();
      const filtered = data.filter((a: any) => a.value_usdt >= 5);
      setPortfolio(filtered);
      setTotalValue(filtered.reduce((sum: number, a: any) => sum + a.value_usdt, 0));
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function startNukeSelection() {
    setSelectMode(true);
    setSelectedAssets(portfolio.map((a: any) => a.symbol)); // all selected by default
    setNukeResult([]);
  }

  function handleAssetSelect(symbol: string) {
    setSelectedAssets(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  }

  function handleNukeClick() {
    setShowConfirm(true);
  }

  async function handleNuke() {
    setShowConfirm(false);
    setNukeLoading(true);
    setError("");
    setNukeResult([]);
    try {
      // Prepare sell payload: round to integer if price < $1
      const sellPayload = portfolio
        .filter((a: any) => selectedAssets.includes(a.symbol))
        .map((a: any) => ({
          symbol: a.symbol,
          amount: a.price < 1 ? Math.floor(a.amount) : a.amount
        }));
      // Send symbols and amounts to backend
      const res = await fetch("http://localhost:8000/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          sell: sellPayload
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to sell assets");
      }
      const data = await res.json();
      setNukeResult(data.results || []);
      setSelectMode(false);
      // Store sold assets in localStorage for buy back
      const soldNow = (data.results || []).map((tx: any) => ({
        symbol: tx.symbol,
        amount: tx.amount,
        price: tx.price,
        timestamp: tx.timestamp
      }));
      const prevSold = JSON.parse(localStorage.getItem("soldPortfolio") || "[]");
      localStorage.setItem("soldPortfolio", JSON.stringify([...prevSold, ...soldNow]));
      setSoldPortfolio([...prevSold, ...soldNow]);
      // Optionally, refresh portfolio here
      console.log("Sell response:", data);
    } catch (e: any) {
      setError(e.message || "Unknown error");
      console.error("Sell error:", e);
    } finally {
      setNukeLoading(false);
    }
  }

  function handleCancelNuke() {
    setSelectMode(false);
    setSelectedAssets([]);
    setShowConfirm(false);
  }

  function handleBuyBackClick() {
    setShowBuyBack(true);
    setBuyBackSelection(soldPortfolio.map((a: any) => a.symbol));
  }

  function handleBuyBackSelect(symbol: string) {
    setBuyBackSelection(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  }

  function handleCloseBuyBack() {
    setShowBuyBack(false);
    setBuyBackSelection([]);
  }

  async function handleBuyBack() {
    setBuyBackLoading(true);
    setBuyBackResult([]);
    try {
      // Prepare buy payload for selected assets
      const buyPayload = soldPortfolio
        .filter((a: any) => buyBackSelection.includes(a.symbol))
        .map((a: any) => ({ symbol: a.symbol, amount: a.amount }));
      const res = await fetch("http://localhost:8000/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          buy: buyPayload
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to buy back assets");
      }
      const data = await res.json();
      setBuyBackResult(data.results || []);
      // Calculate realized P/L and update localStorage
      let newPL = realizedPL;
      let updatedSold = [...soldPortfolio];
      (data.results || []).forEach((tx: any) => {
        const sold = soldPortfolio.find((s: any) => s.symbol === tx.symbol);
        if (sold && !tx.error && tx.usdt_spent > 0) {
          const pl = (sold.price - (tx.usdt_spent / tx.amount)) * tx.amount;
          newPL += pl;
          // Remove from soldPortfolio after buy back
          updatedSold = updatedSold.filter((s: any) => s.symbol !== tx.symbol);
        }
      });
      setRealizedPL(newPL);
      setSoldPortfolio(updatedSold);
      localStorage.setItem("realizedPL", newPL.toString());
      localStorage.setItem("soldPortfolio", JSON.stringify(updatedSold));
    } catch (e: any) {
      // Optionally show error
    } finally {
      setBuyBackLoading(false);
    }
  }

  // --- Buy Back Selection on Main Screen ---
  function startBuyBackSelection() {
    setBuyBackSelectMode(true);
    setBuyBackSelection(soldPortfolio.map((a: any) => a.symbol)); // all selected by default
    setBuyBackResult([]);
  }

  function handleBuyBackAssetSelect(symbol: string) {
    setBuyBackSelection(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  }

  function handleBuyBackClickMain() {
    setShowBuyBackConfirm(true);
  }

  function handleCancelBuyBack() {
    setBuyBackSelectMode(false);
    setBuyBackSelection([]);
    setShowBuyBackConfirm(false);
  }

  async function handleBuyBackMain() {
    setShowBuyBackConfirm(false);
    setBuyBackLoading(true);
    setBuyBackResult([]);
    try {
      // Prepare buy payload for selected assets
      const buyPayload = soldPortfolio
        .filter((a: any) => buyBackSelection.includes(a.symbol))
        .map((a: any) => ({ symbol: a.symbol, amount: a.amount }));
      const res = await fetch("http://localhost:8000/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          buy: buyPayload
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to buy back assets");
      }
      const data = await res.json();
      setBuyBackResult(data.results || []);
      // Calculate realized P/L and update localStorage
      let newPL = realizedPL;
      let updatedSold = [...soldPortfolio];
      (data.results || []).forEach((tx: any) => {
        const sold = soldPortfolio.find((s: any) => s.symbol === tx.symbol);
        if (sold && !tx.error && tx.usdt_spent > 0) {
          // Use actual_price for both sale and buy
          const pl = (sold.actual_price - tx.actual_price) * tx.amount;
          newPL += pl;
          // Remove from soldPortfolio after buy back
          updatedSold = updatedSold.filter((s: any) => s.symbol !== tx.symbol);
        }
      });
      setRealizedPL(newPL);
      setSoldPortfolio(updatedSold);
      localStorage.setItem("realizedPL", newPL.toString());
      localStorage.setItem("soldPortfolio", JSON.stringify(updatedSold));
      setBuyBackSelectMode(false);
      setBuyBackSelection([]);
    } catch (e: any) {
      // Optionally show error
    } finally {
      setBuyBackLoading(false);
    }
  }

  // Refresh prices for liquidated portfolio
  async function handleRefreshLiquidatedPrices() {
    setRefreshLiquidatedLoading(true);
    try {
      const res = await fetch("http://localhost:8000/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const priceMap: any = {};
      data.forEach((a: any) => { priceMap[a.symbol] = a.price; });
      setBuyBackPrices(priceMap);
    } catch (e) {
      // ignore
    } finally {
      setRefreshLiquidatedLoading(false);
    }
  }

  // Calculate total portfolio value (active assets)
  const totalPortfolioValue = portfolio.reduce((sum, a) => sum + a.value_usdt, 0);

  // Calculate total value and P/L for liquidated portfolio
  let totalLiquidatedValue = 0;
  let totalLiquidatedPL = 0;
  soldPortfolio.forEach((asset: any) => {
    const currentPrice = buyBackPrices[asset.symbol] || 0;
    const salePrice = asset.actual_price || asset.price;
    totalLiquidatedValue += currentPrice * asset.amount;
    totalLiquidatedPL += (salePrice - currentPrice) * asset.amount;
  });

  // Main screen
  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)] font-mono p-4">
        {header}
       
        {/* Connect to Binance Modal/Card */}
        <div className="card p-8 flex flex-col gap-4 w-full max-w-md items-center shadow-lg">
          <div className="text-2xl mb-2 flex flex-col items-center">
            <span className="text-[var(--color-accent)] text-4xl mb-2">&#128179;</span>
            Connect to Binance
          </div>
          <div className="w-full flex flex-col gap-2">
            <label className="text-sm" htmlFor="apiKey">API Key</label>
            <input
              id="apiKey"
              type="text"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="p-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-accent-dark)] focus:outline-none focus:border-[var(--color-accent)]"
              autoComplete="off"
            />
            <label className="text-sm mt-2" htmlFor="apiSecret">API Secret</label>
            <input
              id="apiSecret"
              type="password"
              value={apiSecret}
              onChange={e => setApiSecret(e.target.value)}
              className="p-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-accent-dark)] focus:outline-none focus:border-[var(--color-accent)]"
              autoComplete="off"
            />
          </div>
          <button
            className="btn w-full mt-4 py-2 text-lg font-bold rounded shadow-md disabled:opacity-50"
            onClick={handleConnect}
            disabled={!apiKey || !apiSecret || loading}
          >
            {loading ? "Connecting..." : "Connect Binance API"}
          </button>
          {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
          <p className="text-xs text-[var(--color-text-secondary)] mt-2 text-center">
            <span className="block">Your API credentials are stored locally and never shared.</span>
            <span className="block">Make sure your API has read-only permissions.</span>
          </p>
        </div>
      </div>
    );
  }

  // Portfolio screen with Nuke selection
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)] font-mono p-4">
      {header}
      {/* Mynance header only, no tabs */}

      {/* Top Value Card (Portfolio) */}
      <div className="w-full max-w-[520px] mx-auto bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col md:flex-row items-center justify-between px-4 md:px-6 py-4 md:py-6 mb-6">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold text-black">Est. Total Value</span>
          <span className="text-3xl font-extrabold text-black">{totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 8 })} USDT</span>
          <span className="text-base text-black">{formatUSD(totalPortfolioValue)}</span>
          <span className={`text-base font-bold mt-2 ${plColor(realizedPL)}`}>Realized P/L: {realizedPL >= 0 ? '+' : ''}{realizedPL.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</span>
          <span className="text-xs text-gray-500">From completed buy-back trades</span>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            className="btn px-5 py-2 text-base mb-2"
            onClick={startNukeSelection}
            style={{ minWidth: 90 }}
          >Sell</button>
          <button
            className="btn px-5 py-2 text-base"
            onClick={handleRefreshPortfolio}
            disabled={loading}
            style={{ minWidth: 90 }}
          >{loading ? 'Refreshing...' : 'Refresh Portfolio'}</button>
        </div>
      </div>

      {/* Portfolio Main Section (now the only main section) */}
      <div className="w-full flex flex-col gap-8 items-center">
        {/* Active Portfolio Section */}
        <div className="w-full flex flex-col items-center mb-4">
          <div className="w-full flex flex-row justify-center mb-2 mt-2 px-2">
            <span className="text-xl md:text-2xl font-bold text-black w-full max-w-[480px] text-left">Assets</span>
          </div>
          <div className="flex flex-col w-full items-center gap-4 px-1 md:px-0">
            {portfolio.map(asset => (
              <label key={asset.symbol} className="w-full max-w-[480px] mx-auto bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col sm:flex-row items-center justify-between px-3 md:px-5 py-3 md:py-4 gap-2 md:gap-4">
                <div className="flex flex-row items-center gap-3">
                  {/* Placeholder icon */}
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[var(--color-text-secondary)] font-bold text-lg border border-gray-200">{asset.symbol[0]}</div>
                  <div className="flex flex-col items-start gap-0.5">
                    <div className="flex items-center gap-2">
                      {selectMode && (
                        <input
                          type="checkbox"
                          checked={selectedAssets.includes(asset.symbol)}
                          onChange={() => handleAssetSelect(asset.symbol)}
                          className="accent-yellow-400"
                        />
                      )}
                      <span className="text-base font-bold text-black">{asset.symbol}</span>
                    </div>
                    <span className="text-xs text-gray-500">{asset.amount} units @ ${asset.price}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xl font-bold text-black">${asset.value_usdt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {selectMode && (
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6 w-full justify-center items-center px-2">
            <button
              className="btn bg-red-600 text-white text-xl font-bold py-4 px-8 rounded shadow-md hover:bg-red-700 transition-all disabled:opacity-50"
              onClick={handleNukeClick}
              disabled={selectedAssets.length === 0 || nukeLoading}
            >
              {nukeLoading ? "Selling..." : `SELL ${selectedAssets.length} ASSET${selectedAssets.length > 1 ? 'S' : ''}`}
            </button>
            <button
              className="btn bg-gray-700 text-white text-xl font-bold py-4 px-8 rounded shadow-md hover:bg-gray-600 transition-all"
              onClick={handleCancelNuke}
              disabled={nukeLoading}
            >
              Cancel
            </button>
            {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
          </div>
        )}

        {/* Liquidated Portfolio Section (inline) */}
        {soldPortfolio.length > 0 && (
          <div className="w-full flex flex-col items-center mt-10">
            <div className="w-full max-w-[520px] mx-auto bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col items-center justify-center px-3 md:px-6 py-4 md:py-6 mb-6">
              <span className="text-lg font-bold text-black mb-1">Liquidated Portfolio</span>
              <span className="text-3xl font-extrabold text-black">{totalLiquidatedValue.toLocaleString(undefined, { maximumFractionDigits: 8 })} USDT</span>
              <span className="text-base text-black mb-2">{formatUSD(totalLiquidatedValue)}</span>
              <span className={`text-xl font-bold ${totalLiquidatedPL >= 0 ? 'text-black' : 'text-red-400'}`}>{totalLiquidatedPL >= 0 ? '+' : ''}{totalLiquidatedPL.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</span>
              <span className="text-xs text-gray-500 mb-4">Unrealized P/L (if you had held instead of selling)</span>
              <div className="flex flex-col xs:flex-row gap-2 mb-2 w-full justify-center items-center">
                <button
                  className="btn px-5 py-2 text-base"
                  onClick={handleRefreshLiquidatedPrices}
                  disabled={refreshLiquidatedLoading}
                  style={{ minWidth: 90 }}
                >{refreshLiquidatedLoading ? 'Refreshing...' : 'Refresh'}</button>
                {!buyBackSelectMode && (
                  <button
                    className="btn px-5 py-2 text-base"
                    onClick={startBuyBackSelection}
                    style={{ minWidth: 90 }}
                  >Buy Back</button>
                )}
              </div>
              {/* Expanded buy back view */}
              {buyBackSelectMode && (
                <div className="flex flex-col w-full items-center gap-2 md:gap-4 mb-2">
                  {soldPortfolio.map((asset: any) => {
                    const currentPrice = buyBackPrices[asset.symbol] || 0;
                    const salePrice = asset.actual_price || asset.price;
                    const unrealizedPL = (salePrice - currentPrice) * asset.amount;
                    const plPercentage = salePrice > 0 ? ((salePrice - currentPrice) / salePrice) * 100 : 0;
                    const currentValue = currentPrice * asset.amount;
                    return (
                      <label key={asset.symbol} className="w-full max-w-[480px] mx-auto bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col sm:flex-row items-center justify-between px-3 md:px-5 py-3 md:py-4 gap-2 md:gap-4">
                        <div className="flex flex-row items-center gap-3">
                          {/* Placeholder icon */}
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[var(--color-text-secondary)] font-bold text-lg border border-gray-200">{asset.symbol[0]}</div>
                          <div className="flex flex-col items-start gap-0.5">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={buyBackSelection.includes(asset.symbol)}
                                onChange={() => handleBuyBackAssetSelect(asset.symbol)}
                                className="accent-yellow-400"
                              />
                              <span className="text-base font-bold text-black">{asset.symbol}</span>
                            </div>
                            <span className="text-xs text-gray-500">Sold {asset.amount} units @ ${salePrice}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xl font-bold text-black">${currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          <span className={`text-xs font-mono ${unrealizedPL >= 0 ? 'text-black' : 'text-red-400'}`}>({unrealizedPL >= 0 ? '+' : ''}{unrealizedPL.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {plPercentage.toFixed(2)}%)</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              {buyBackSelectMode && (
                <div className="flex flex-col xs:flex-row gap-2 justify-end w-full items-center mt-2">
                  <button
                    className="btn px-5 py-2 text-base bg-blue-600 text-white font-bold rounded shadow-md hover:bg-blue-700 w-full xs:w-auto"
                    onClick={handleBuyBackClickMain}
                    disabled={buyBackSelection.length === 0 || buyBackLoading}
                  >Buy Back ({buyBackSelection.length})</button>
                  <button
                    className="btn px-5 py-2 text-base bg-gray-700 text-white font-bold rounded shadow-md hover:bg-gray-600 w-full xs:w-auto"
                    onClick={handleCancelBuyBack}
                    disabled={buyBackLoading}
                  >Cancel</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Buy Back Confirmation Modal */}
      {showBuyBackConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-2">
          <div className="card p-4 md:p-8 flex flex-col items-center gap-4 max-w-md w-full border-2 border-blue-500">
            <div className="text-xl md:text-2xl font-bold text-blue-400 mb-2">Are you sure?</div>
            <div className="text-center text-[var(--color-text-secondary)] mb-4 text-sm md:text-base">
              You are about to <span className="text-blue-400 font-bold">BUY BACK {buyBackSelection.length} ASSET{buyBackSelection.length > 1 ? 'S' : ''}</span>.<br />
              This action will use your USDT balance.<br />
              Do you want to proceed?
            </div>
            <div className="flex flex-col xs:flex-row gap-2 w-full justify-center items-center">
              <button className="btn bg-blue-600 text-white font-bold py-2 px-6 rounded shadow-md hover:bg-blue-700 w-full xs:w-auto" onClick={handleBuyBackMain}>Yes, Buy Back</button>
              <button className="btn bg-gray-700 text-white font-bold py-2 px-6 rounded shadow-md hover:bg-gray-600 w-full xs:w-auto" onClick={handleCancelBuyBack}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal open={showConfirm} onConfirm={handleNuke} onCancel={() => setShowConfirm(false)} assetCount={selectedAssets.length} />

      {/* Footer */}
      <footer className="w-full text-center text-xs text-white bg-black py-4 mt-24" style={{ position: 'fixed', left: 0, bottom: 0, zIndex: 50, maxHeight: '60px' }}>
        {footerText}
      </footer>
    </div>
  );
}
