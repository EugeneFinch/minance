"use client";
import { useState, useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
          <button className="btn bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 px-6 rounded shadow-md" onClick={onConfirm}>Yes, Sell</button>
          <button className="btn bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 px-6 rounded shadow-md" onClick={onCancel}>Cancel</button>
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
  const [showLoginModal, setShowLoginModal] = useState(false);
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const apiSecretInputRef = useRef<HTMLInputElement>(null);

  // Footer description
  const footerText = "This is a Binance-style portfolio viewer. Not financial advice. For demonstration purposes only.";

  // Minance header
  const header = (
    <header className="w-full flex flex-row items-center justify-center py-10 mb-6 bg-transparent">
      <span className="text-5xl font-extrabold tracking-widest text-black drop-shadow-sm" style={{ letterSpacing: '0.12em' }}>
        Minance
      </span>
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
      handleRefreshPortfolio();
      handleRefreshLiquidatedPrices();
    }
  }, []);

  // Load sold portfolio and realized P/L from localStorage on mount
  useEffect(() => {
    const sold = localStorage.getItem("soldPortfolio");
    if (sold) setSoldPortfolio(JSON.parse(sold));
    const pl = parseFloat(localStorage.getItem("realizedPL") || "0");
    setRealizedPL(isNaN(pl) ? 0 : pl);
  }, []);

  // Fetch current prices for sold assets when Buy Back modal opens
  useEffect(() => {
    if (!showBuyBack || soldPortfolio.length === 0) return;
    const fetchPrices = async () => {
      try {
        const res = await fetch(`${API_URL}/balance`, {
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
      const res = await fetch(`${API_URL}/balance`, {
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
      await handleRefreshPortfolio();
      await handleRefreshLiquidatedPrices();
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Helper to require connection before any action
  function requireConnection(action: () => void) {
    if (!connected) {
      setShowLoginModal(true);
      setTimeout(() => {
        apiKeyInputRef.current?.focus();
      }, 100);
      return;
    }
    action();
  }

  // Modified handlers to require connection
  function handleRefreshPortfolioWithAuth() {
    requireConnection(handleRefreshPortfolio);
  }
  function handleRefreshLiquidatedPricesWithAuth() {
    requireConnection(handleRefreshLiquidatedPrices);
  }
  function handleSellClickWithAuth() {
    requireConnection(startNukeSelection);
  }
  function handleBuyBackClickWithAuth() {
    requireConnection(startBuyBackSelection);
  }

  // Add a refresh function
  async function handleRefreshPortfolio() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to fetch portfolio");
      }
      const data = await res.json();
      console.log("[DEBUG] /balance API response:", data);
      const filtered = data.filter((a: any) => a.value_usdt >= 5);
      console.log("[DEBUG] Filtered portfolio:", filtered);
      setPortfolio(filtered);
      setTotalValue(filtered.reduce((sum: number, a: any) => sum + a.value_usdt, 0));
    } catch (e: any) {
      setError(e.message || "Unknown error");
      console.error("[DEBUG] handleRefreshPortfolio error:", e);
    } finally {
      setLoading(false);
    }
  }

  function startNukeSelection() {
    setSelectMode(true);
    setSelectedAssets(portfolio.filter((a: any) => a.symbol !== 'USDT').map((a: any) => a.symbol)); // only non-USDT selected by default
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
        .filter((a: any) => selectedAssets.includes(a.symbol) && a.symbol !== 'USDT')
        .map((a: any) => ({
          symbol: a.symbol,
          amount: a.price < 1 ? Math.floor(a.amount) : a.amount
        }));
      // Send symbols and amounts to backend
      const res = await fetch(`${API_URL}/sell`, {
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
      let prevSold = JSON.parse(localStorage.getItem("soldPortfolio") || "[]");
      let updatedSold = [...prevSold];
      (data.results || []).forEach((tx: any) => {
        // Remove any previous entry for this symbol
        updatedSold = updatedSold.filter((s: any) => s.symbol !== tx.symbol);
        // Add the new sale
        updatedSold.push({
          symbol: tx.symbol,
          amount: tx.amount,
          price: tx.price,
          actual_price: tx.actual_price,
          timestamp: tx.timestamp
        });
      });
      localStorage.setItem("soldPortfolio", JSON.stringify(updatedSold));
      setSoldPortfolio(updatedSold);
      await handleRefreshPortfolio();
      await handleRefreshLiquidatedPrices();
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
        .filter((a: any) => buyBackSelection.includes(a.symbol) && a.symbol !== 'USDT')
        .map((a: any) => ({ symbol: a.symbol, amount: a.amount }));
      const res = await fetch(`${API_URL}/buy`, {
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
        if (sold && !tx.error && tx.actual_price && sold.actual_price && tx.amount) {
          // Buy back price - sell price, times quantity
          const pl = (tx.actual_price - sold.actual_price) * tx.amount;
          newPL += pl;
          updatedSold = updatedSold.filter((s: any) => s.symbol !== tx.symbol);
        }
      });
      setRealizedPL(newPL);
      setSoldPortfolio(updatedSold);
      localStorage.setItem("realizedPL", newPL.toString());
      localStorage.setItem("soldPortfolio", JSON.stringify(updatedSold));
      await handleRefreshPortfolio();
      await handleRefreshLiquidatedPrices();
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
        .filter((a: any) => buyBackSelection.includes(a.symbol) && a.symbol !== 'USDT')
        .map((a: any) => ({ symbol: a.symbol, amount: a.amount }));
      const res = await fetch(`${API_URL}/buy`, {
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
        if (sold && !tx.error && tx.actual_price && sold.actual_price && tx.amount) {
          // Buy back price - sell price, times quantity
          const pl = (tx.actual_price - sold.actual_price) * tx.amount;
          newPL += pl;
          updatedSold = updatedSold.filter((s: any) => s.symbol !== tx.symbol);
        }
      });
      setRealizedPL(newPL);
      setSoldPortfolio(updatedSold);
      localStorage.setItem("realizedPL", newPL.toString());
      localStorage.setItem("soldPortfolio", JSON.stringify(updatedSold));
      setBuyBackSelectMode(false);
      setBuyBackSelection([]);
      await handleRefreshPortfolio();
      await handleRefreshLiquidatedPrices();
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
      // Always fetch latest prices for all assets
      const res = await fetch(`${API_URL}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const priceMap: any = {};
      data.forEach((a: any) => { priceMap[a.symbol] = a.price; });
      setBuyBackPrices(priceMap);
      console.log("[DEBUG] Refreshed liquidated prices:", priceMap);
    } catch (e) {
      // ignore
      console.error("[DEBUG] handleRefreshLiquidatedPrices error:", e);
    } finally {
      setRefreshLiquidatedLoading(false);
    }
  }

  // Calculate total portfolio value (active assets)
  const totalPortfolioValue = portfolio.reduce((sum, a) => sum + a.value_usdt, 0);

  // Calculate total value and P/L for liquidated portfolio
  // Only include assets that have been sold and NOT yet bought back (i.e., still in soldPortfolio)
  let totalLiquidatedValue = 0;
  let totalLiquidatedPL = 0;
  const activeLiquidated = soldPortfolio.filter((asset: any) => asset && asset.symbol !== 'USDT');
  activeLiquidated.forEach((asset: any) => {
    const currentPrice = buyBackPrices[asset.symbol] || 0;
    const salePrice = asset.actual_price || asset.price;
    totalLiquidatedValue += currentPrice * asset.amount;
    totalLiquidatedPL += (salePrice - currentPrice) * asset.amount;
  });

  // Place this inside the Home component, before the return statement:
  async function handleBigRefresh() {
    setLoading(true);
    await handleRefreshPortfolio();
    await handleRefreshLiquidatedPrices();
    setLoading(false);
  }

  // Main screen
  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f7f7] text-[var(--color-text)] font-mono p-4">
        {header}
        <button
          className="btn w-full max-w-xs py-3 text-xl font-extrabold rounded-xl shadow-lg bg-yellow-400 hover:bg-yellow-500 text-black mb-8"
          onClick={() => setShowLoginModal(true)}
        >
          Login
        </button>
        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-10 flex flex-col gap-6 w-full max-w-md items-center border border-gray-200">
              <div className="text-2xl mb-2 flex flex-col items-center">
                <span className="text-[var(--color-accent)] text-4xl mb-2">&#128179;</span>
                Connect to Binance
              </div>
              <div className="w-full flex flex-col gap-2">
                <label className="text-sm" htmlFor="apiKey">API Key</label>
                <input
                  id="apiKey"
                  type="text"
                  ref={apiKeyInputRef}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="p-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-accent-dark)] focus:outline-none focus:border-[var(--color-accent)]"
                  autoComplete="off"
                />
                <label className="text-sm mt-2" htmlFor="apiSecret">API Secret</label>
                <input
                  id="apiSecret"
                  type="password"
                  ref={apiSecretInputRef}
                  value={apiSecret}
                  onChange={e => setApiSecret(e.target.value)}
                  className="p-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-accent-dark)] focus:outline-none focus:border-[var(--color-accent)]"
                  autoComplete="off"
                />
              </div>
              <button
                className="btn w-full mt-6 py-3 text-xl font-extrabold rounded-xl shadow-lg disabled:opacity-50 bg-yellow-400 hover:bg-yellow-500 text-black"
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
              <button
                className="btn w-full mt-2 py-2 text-base font-bold rounded-xl shadow bg-gray-200 text-black"
                onClick={() => setShowLoginModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // In the main return (when connected), after {header} and before the portfolio card, add:
  {connected && (
    <div className="w-full max-w-[520px] mx-auto mb-6">
      <button
        className="btn w-full py-3 text-xl font-extrabold rounded-xl shadow-lg bg-yellow-400 hover:bg-yellow-500 text-black mb-4"
        onClick={handleRefreshPortfolioWithAuth}
        disabled={loading}
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  )}

  // Portfolio screen with Nuke selection
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f7f7] text-[var(--color-text)] font-mono p-4">
      {header}
      {/* Mynance header only, no tabs */}

      {/* Top Value Card (Portfolio) */}
      <div className="w-full max-w-[520px] mx-auto bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col md:flex-row items-center justify-between px-4 md:px-6 py-4 md:py-6 mb-6 relative">
        {/* Refresh button for Portfolio */}
        {!selectMode && (
          <button
            className="btn bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-1 text-base font-bold rounded shadow-md absolute top-4 right-4"
            onClick={handleRefreshPortfolioWithAuth}
            disabled={loading}
            style={{ minWidth: 90 }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold text-black">Portfolio Est Total Value</span>
          <span className="text-3xl font-extrabold text-black">{totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 8 })} USDT</span>
          <span className="text-base text-black">{formatUSD(totalPortfolioValue)}</span>
          <span className={`text-base font-bold mt-2 ${plColor(realizedPL)}`}>Realized P/L: {realizedPL >= 0 ? '+' : ''}{realizedPL.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</span>
          <span className="text-xs text-gray-500">From completed buy-back trades</span>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            className="btn bg-yellow-400 hover:bg-yellow-500 text-black px-5 py-2 text-base mb-2 font-bold rounded shadow-md"
            onClick={handleSellClickWithAuth}
            style={{ minWidth: 90 }}
          >Sell</button>
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
            {portfolio.length === 0 && !loading ? (
              <div className="w-full max-w-[480px] mx-auto bg-white rounded-2xl shadow-md border border-gray-200 flex items-center justify-center px-5 py-6 text-lg text-gray-500 font-semibold text-center">
                No assets to show.
              </div>
            ) : (
              portfolio.map((asset: any) => (
                <label key={asset.symbol} className="w-full max-w-[480px] mx-auto bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col sm:flex-row items-center justify-between px-3 md:px-5 py-3 md:py-4 gap-2 md:gap-4">
                  <div className="flex flex-row items-center gap-3">
                    {/* Placeholder icon */}
                    <div className="w-9 h-9 rounded-full bg-yellow-400 flex items-center justify-center text-black font-bold text-lg border border-yellow-400 shadow-sm">
                      <span role="img" aria-label="coin">🪙</span>
                    </div>
                    <div className="flex flex-col items-start gap-0.5">
                      <div className="flex items-center gap-2">
                        {selectMode && asset.symbol !== 'USDT' && (
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
              ))
            )}
          </div>
        </div>

        {selectMode && (
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6 w-full justify-center items-center px-2">
            <button
              className="btn bg-yellow-400 hover:bg-yellow-500 text-black text-xl font-bold py-4 px-8 rounded shadow-md hover:bg-yellow-600 transition-all disabled:opacity-50"
              onClick={handleNukeClick}
              disabled={selectedAssets.length === 0 || nukeLoading}
            >
              {nukeLoading ? "Selling..." : `SELL ${selectedAssets.length} ASSET${selectedAssets.length > 1 ? 'S' : ''}`}
            </button>
            <button
              className="btn bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 px-8 rounded shadow-md hover:bg-yellow-600 transition-all"
              onClick={handleCancelNuke}
              disabled={nukeLoading}
            >
              Cancel
            </button>
            {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
          </div>
        )}

        {/* Liquidated Portfolio Section (inline) */}
        {activeLiquidated.length > 0 && (
          <div className="w-full flex flex-col items-center mt-10">
            <div className="w-full max-w-[520px] mx-auto bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col items-center justify-center px-3 md:px-6 py-4 md:py-6 mb-6 relative">
              {/* Refresh button for Liquidated Portfolio */}
              {!buyBackSelectMode && (
                <button
                  className="btn bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-1 text-base font-bold rounded shadow-md absolute top-4 right-4"
                  onClick={handleRefreshLiquidatedPricesWithAuth}
                  disabled={refreshLiquidatedLoading}
                  style={{ minWidth: 90 }}
                >
                  {refreshLiquidatedLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              )}
              <span className="text-lg font-bold text-black mb-1 w-full text-left">Liquidated Portfolio</span>
              <span className="text-3xl font-extrabold text-black">{totalLiquidatedValue.toLocaleString(undefined, { maximumFractionDigits: 8 })} USDT</span>
              <span className="text-base text-black mb-2">{formatUSD(totalLiquidatedValue)}</span>
              <span className={`text-xl font-bold ${totalLiquidatedPL >= 0 ? 'text-black' : 'text-red-400'}`}>{totalLiquidatedPL >= 0 ? '+' : ''}{totalLiquidatedPL.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</span>
              <span className="text-xs text-gray-500 mb-4">Unrealized P/L (for assets you sold but have not yet bought back)</span>
              <div className="flex flex-col xs:flex-row gap-2 mb-2 w-full justify-center items-center">
                {!buyBackSelectMode && (
                  <button
                    className="btn bg-yellow-400 hover:bg-yellow-500 text-black px-5 py-2 text-base font-bold rounded shadow-md"
                    onClick={handleBuyBackClickWithAuth}
                    style={{ minWidth: 90 }}
                  >Buy Back</button>
                )}
              </div>
              {/* Expanded buy back view */}
              {buyBackSelectMode && (
                <div className="flex flex-col w-full items-center gap-2 md:gap-4 mb-2">
                  {activeLiquidated.map((asset: any) => {
                    if (asset.symbol === 'USDT') return null;
                    const currentPrice = buyBackPrices[asset.symbol] || 0;
                    const salePrice = asset.actual_price || asset.price;
                    const unrealizedPL = (salePrice - currentPrice) * asset.amount;
                    const plPercentage = salePrice > 0 ? ((salePrice - currentPrice) / salePrice) * 100 : 0;
                    const currentValue = currentPrice * asset.amount;
                    return (
                      <label key={asset.symbol} className="w-full max-w-[480px] mx-auto bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col sm:flex-row items-center justify-between px-3 md:px-5 py-3 md:py-4 gap-2 md:gap-4">
                        <div className="flex flex-row items-center gap-3">
                          {/* Placeholder icon */}
                          <div className="w-9 h-9 rounded-full bg-yellow-400 flex items-center justify-center text-black font-bold text-lg border border-yellow-400 shadow-sm">
                            <span role="img" aria-label="coin">🪙</span>
                          </div>
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
                    className="btn bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 px-6 rounded shadow-md w-full xs:w-auto"
                    onClick={handleBuyBackClickMain}
                    disabled={buyBackSelection.length === 0 || buyBackLoading}
                  >Buy Back ({buyBackSelection.length})</button>
                  <button
                    className="btn bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 px-6 rounded shadow-md w-full xs:w-auto"
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
              <button className="btn bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 px-6 rounded shadow-md w-full xs:w-auto" onClick={handleBuyBackMain}>Yes, Buy Back</button>
              <button className="btn bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 px-6 rounded shadow-md w-full xs:w-auto" onClick={handleCancelBuyBack}>Cancel</button>
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
