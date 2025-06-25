🔧 Phase 1 — MVP: Portfolio Viewer

🧠 Goal:

Connect Binance API and display user portfolio per asset.

🔨 Components:
	1.	Frontend (React/Next.js preferred):
	•	Simple UI to input API key/secret (via modal or inline form)
	•	Basic asset list (symbol, amount, current price, value in USDT)
	•	Optional: P&L stubbed (zeroed)
	2.	Backend (Node.js or Python FastAPI)
	•	Secure API proxy for Binance REST API
	•	/balance endpoint that:
	•	Authenticates with provided key/secret
	•	Fetches spot wallet balances
	•	Joins with live price feed (via Binance /ticker/price)
	•	Returns enriched asset list to frontend
	3.	Security:
	•	Temporarily store API key in memory or encrypt per session
	•	Later: persist encrypted w/ user wallet signature gating

⸻

⚙️ Phase 2 — Sell (“NuGet”)

🧠 Goal:

Enable user to sell selected assets and log the price + amount.

🧩 Features:
	1.	Checkbox selection on portfolio screen
	2.	Sell (“NuGet”) Button — triggers:
	•	Market sell of all selected assets
	•	Records:
	•	symbol
	•	sell price (at execution)
	•	quantity sold
	•	timestamp
	3.	Backend Changes:
	•	/sell endpoint:
	•	Validates Binance API keys
	•	Loops over selected symbols
	•	Executes market order via /api/v3/order
	•	Stores sale metadata in lightweight DB (SQLite or Supabase for now)

⸻

🔁 Phase 3 — Buy It Back

🧠 Goal:

Repurchase previously sold assets and calculate P&L

🧩 Features:
	•	“Buy It Back” tab/button
	•	Shows:
	•	Assets not yet bought back
	•	Original sell price, quantity, current price
	•	Calculated P&L = (SellPrice - CurrentPrice) * Qty
	•	User selects which to repurchase
	•	Executes market buy
	•	Updates entry as “repurchased”

🧮 Backend:
	•	/buyback endpoint:
	•	Fetches active sell logs
	•	Executes market buy
	•	Marks buyback done, logs timestamp + price

⸻

📊 Phase 4 — Realized P&L

🧠 Goal:

Show summary of user profit/loss across all trades
	•	List of completed round-trips (sold + bought)
	•	Realized P&L: sum of all P&Ls
	•	Basic charting (optional)
	•	Export as CSV (optional)

⸻

🧠 Agent Use Case (Future):

Use AI agent to:
	•	Recommend when to “NuGet” based on price movements
	•	Simulate “what if” buybacks
	•	Alert on significant price drops after sale

⸻

🛠 Stack Recommendation:
	•	Frontend: Next.js + Tailwind + Wagmi (if Solana login added later)
	•	Backend: FastAPI (Python) or Express (Node.js)
	•	Storage: Supabase, Firestore, or PostgreSQL
	•	Security: Encrypt API keys (AES) or use ephemeral sessions
	•	Binance API: REST + WebSocket (optional for real-time)

# Implementation Status (as of current build)

**Summary:**
- Core portfolio viewer, sell (nuke), and buy back flows are implemented and functional.
- Realized P&L, asset selection, confirmation modals, and local/session storage are implemented.
- UI is modern and responsive for desktop, but mobile responsiveness and some polish are still missing.
- Security is limited to local/session storage; no encryption or wallet signature gating yet.
- No persistent backend DB for trades (localStorage only). No CSV export, charting, or onboarding.

---

## Implementation Checklist (as of backend/main.py)

### Phase 1 — MVP: Portfolio Viewer
- [x] Backend: Python FastAPI
- [x] /balance endpoint that:
  - [x] Authenticates with provided key/secret
  - [x] Fetches spot wallet balances
  - [x] Joins with live price feed (via Binance /ticker/price)
  - [x] Returns enriched asset list to frontend
- [x] Frontend (React/Next.js):
  - [x] Simple UI to input API key/secret (with local/session storage)
  - [x] Basic asset list (symbol, amount, current price, value in USDT)
  - [x] Realized P&L (from buy-back trades)
- [~] Security:
  - [~] Temporarily store API key in memory or encrypt per session (currently only sessionStorage, not encrypted)
  - [ ] Later: persist encrypted w/ user wallet signature gating

### Phase 2 — Sell (“NuGet”)
- [x] Checkbox selection on portfolio screen
- [x] Sell (“NuGet”) Button — triggers:
  - [x] Market sell of all selected assets
  - [x] Records: symbol, sell price, quantity sold, timestamp (in localStorage)
- [x] Backend Changes:
  - [x] /sell endpoint
  - [x] Validates Binance API keys
  - [x] Loops over selected symbols
  - [x] Executes market order via /api/v3/order
  - [ ] Stores sale metadata in lightweight DB (currently only localStorage on frontend)

### Phase 3 — Buy It Back
- [x] “Buy It Back” button/flow
- [x] Shows assets not yet bought back, original sell price, quantity, current price, calculated P&L
- [x] User selects which to repurchase
- [x] Executes market buy
- [x] Updates entry as “repurchased” (removes from localStorage, updates realized P&L)
- [x] Backend: /buy endpoint (named /buy, not /buyback)
  - [x] Executes market buy
  - [x] Returns buy result
  - [ ] Fetches active sell logs (handled on frontend only)
  - [ ] Marks buyback done, logs timestamp + price (handled on frontend only)

### Phase 4 — Realized P&L
- [x] Show summary of user profit/loss across all trades (realized P&L)
  - [x] List of completed round-trips (sold + bought)
  - [x] Realized P&L: sum of all P&Ls
  - [ ] Basic charting (not implemented)
  - [ ] Export as CSV (not implemented)

## Updated Frontend Flow & Requirements

The following user flow and UI requirements are based on the latest design direction and screenshots:

### User Flow
1. **Login / Connect Binance API**
   - User is prompted to enter their Binance API Key and Secret in a secure modal or form.
   - Credentials are stored locally and never shared.
2. **Display Portfolio**
   - After connecting, the user sees a dashboard with their portfolio:
     - Each asset shows: symbol, amount (units), current price, and value in USDT.
     - Total portfolio value is displayed prominently.
3. **Show Realized P/L**
   - Realized profit/loss from completed buy-back trades is shown.
   - Panic History section lists past "Nuke" (sell) and "Buy Back" actions with timestamps and P&L.
4. **Panic Sell (Nuke) Button**
   - Large, prominent button to trigger selling selected assets.
   - User can select which assets to "nuke" (sell).
5. **Buy Back Button**
   - Large, prominent button to trigger repurchasing previously sold assets.
   - User can select which assets to buy back.

### UI/UX Requirements (Binance Style)

- **Color Scheme:**
  - White background throughout the app
  - Black primary text for all content
  - Yellow (#f0b90b) buttons with black text (hover: darker yellow)
  - Use yellow highlights for accents and important actions
- **Layout:**
  - Modern, card-based dashboard layout
  - Use rounded corners and subtle shadows for cards and modals
  - Tabs and sections should be visually separated with cards or borders
- **Buttons:**
  - Large, prominent yellow buttons for primary actions (Sell, Buy Back, Connect)
  - Black text on yellow buttons for maximum contrast
  - Rounded corners and bold font for all buttons
- **Typography:**
  - Use bold, clear, sans-serif or mono fonts for headings and numbers
  - All text should be black for readability
- **Responsiveness:**
  - Responsive layout for desktop and mobile
  - Cards and buttons should scale and stack appropriately on smaller screens
- **Feedback:**
  - Clear feedback for loading, errors, and successful actions
  - Use yellow or red highlights for warnings/errors
- **Security Notice:**
  - Display a clear notice that API credentials are stored locally and never shared
- **Other:**
  - Optionally, allow user to show/hide API secret input
  - Footer should be fixed, black background with white or yellow text

> All UI elements should follow the Binance visual language: white backgrounds, black text, yellow highlights, and a clean, modern look.

---

## Future Improvement Ideas

- Advanced error handling (user-friendly messages for invalid API keys, network errors, etc.)
- Loading spinners or skeleton screens for better UX during data fetch
- Security enhancements (masking API secret, session expiration, etc.)
- Temporarily store API key in memory or encrypt per session (beyond React state)
- UI polish: animations, transitions, and accessibility improvements
- Option to show/hide API secret input
- More detailed portfolio breakdown (e.g., asset icons, price change indicators)
- Support for multiple Binance accounts
- Internationalization (i18n) and localization
- Mobile-first optimizations and PWA support
- Dark/light mode toggle
- Integration with other exchanges or wallets
- User onboarding/help tooltips
- Export portfolio as CSV or PDF
- Customizable dashboard widgets

---

# Minance: Binance Portfolio Viewer

## Features

- **Single-tab layout**: The main portfolio view now includes both active assets and a "Liquidated Portfolio" section inline, rather than separate tabs.
- **Asset selection and Sell flow**: Click "Sell" to enter selection mode, choose assets, and confirm via a modal before selling.
- **Liquidated Portfolio & Buy Back**: Sold assets appear in the Liquidated section. Click "Buy Back" to select and repurchase assets, with confirmation.
- **Realized and Unrealized P/L**: Realized P/L is tracked and shown for completed trades. Unrealized P/L is shown for liquidated assets as if you had held them.
- **Mobile Responsive**: (To be added) The UI will adapt for mobile screens for easy use on any device.
- **Binance-style UI**: White backgrounds, black text, yellow highlights, and modern card/tab design.
- **Session/local storage**: API keys are stored in sessionStorage; realized P/L and liquidated assets in localStorage.

## User Experience

- **Connect**: Enter your Binance API key/secret (read-only recommended).
- **Portfolio**: View your assets, total value, and realized P/L. Sell assets with confirmation.
- **Liquidated Portfolio**: See value and P/L of sold assets. Buy back with confirmation.
- **Footer**: Persistent, fixed at the bottom.

## Deployment

- The frontend is ready to be deployed to Vercel. See below for instructions.

## To Do

- [ ] Make the UI fully mobile responsive.
- [ ] Deploy to Vercel for user testing.

---

## How to Deploy to Vercel

1. Push your latest code to GitHub.
2. Go to [vercel.com](https://vercel.com/) and import your repository.
3. Set up environment variables if needed (e.g., backend API URL).
4. Deploy and share the link with users for testing.

---
