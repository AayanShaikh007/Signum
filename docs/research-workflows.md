# Research and replay workflows

[Back to the project overview](../README.md)

## Strategy research workspace

Open **Strategies** in the dashboard. Write a hypothesis and choose fixed-anchor
or moving-average reversion. Thresholds are normalized ticks, not dollars. The
moving average uses only prior samples and waits for its window to fill.

1. Create a strategy, set its order/position limits, and wait for **Saved**.
   Edits autosave after 800 ms. Conflicting saves pause rather than overwrite.
2. Export a `.strategy.json` file for a portable copy. Import validates its schema;
   files contain declarative settings, never executable Python.
3. Freeze a saved revision. Future edits do not change that snapshot.
4. Select a historical dataset and run Development (first 70%). Tune only there.
   Freeze your final rule, then run Validation (last 30%) without further tuning.
5. Select **Use for next run**, Python engine, and Local $10,000 to paper simulate.
   Alpaca PAPER execution still requires live data and explicit order consent;
   historical backtests never submit broker orders.

Backtests start fresh with $10,000 per period. Signals fill on the next sample
with configured slippage and fees; the final pending signal is not filled.
The chart, drawdown, fills, and buy-and-hold comparison are simulation results,
not evidence of profitability. Each period starts without prior strategy state.
The software cannot guarantee you have never inspected validation data.

Saved files live under ignored `backend/data/research/`: `strategies/` holds
current revisions, `backups/` previous revisions, `snapshots/` frozen rules, and
`experiments/` result JSON with dataset and rule hashes. Copy/export these files
for backups; GitHub does not store them. The editor also offers browser draft
recovery and revision restore. Autosave cannot protect against disk loss.

FPGA Live supports configurable anchor rules and SMA reversion with windows
2, 4, 8, 16, 32, 64. Threshold 1-500 ticks, order cap 1-20 and position cap 1-100
are uploaded from the frozen snapshot before prices, then read back and verified.
Other SMA windows remain Python-only. This configures implemented circuits; it
does not compile arbitrary strategy code. See [FPGA configuration](fpga-configuration.md).


## Public browser demo (Vercel)

[Open Signum](https://signum-aayan14.vercel.app/). Visitors replay Apple, Nvidia
or Microsoft daily closing prices from **2017** with their own $10,000 virtual
portfolio. Practice prices are explicitly fictional. The stock, date range,
market date, processed sample count and elapsed playback time are labeled.

Speed presets 1×/5×/10×/20×/50× mean **samples per second**. With daily history,
10× plays ten past trading days each second. Even 1× is compressed history;
this is not live market data or a literal multiplier of actual market time.
Pause/resume preserves the run; Reset clears its state and unlocks settings.
No broker account, Alpaca credentials, Python service or UART device is used.

```powershell
cd C:\Coding\fpga_stockmarketsimulation\frontend
npm ci
npm run dev:demo
# Browser-only app: http://127.0.0.1:5174/
```

Production: `npm run build:demo` produces `frontend/dist`. Vercel root is
`frontend`, install `npm ci`, build `npm run build:demo`, output `dist`.
No environment variables are required. Local `npm run dev` / `npm run build`
retain the Python/FPGA app. Do not put Alpaca credentials into Vercel/VITE_*.

The browser replay now uses **next-sample fills**, fees and slippage, matching
its batch-backtest model. Chart markers/history show completed simulated fills,
not every engine signal. Buys are cash-limited, sells cannot exceed holdings.
Pending final signals are not filled. The optional separate-period test uses
first 70% development / final 30% validation with fresh state per period.
Browser numbers approximate decimal arithmetic; Python remains Decimal-based.

Each run is in memory and independent of other visitors. Rule drafts autosave
in this browser. Export rule JSON/results to keep backups. CSV data is not
uploaded or automatically persisted; reimport after reload. Import plain CSV
with `timestamp,price,quantity` (quantity optional, default 20), ordered unique
ISO timestamps with timezone, positive prices up to $1,000,000, quantity 0–65535,
4–10,000 rows, at most 2 MB. Use data you are entitled to use.

Small ⓘ buttons explain prices, playback, rules, portfolio, trades and testing.
They work on hover, keyboard focus or tap, dismiss with Escape/outside tap,
and render outside cards to avoid clipping.

Historical samples come from Cam Nugent’s CC0 S&P 500 stock dataset, version 4:
[provenance and regeneration](public-market-data.md). They are daily closes,
not every trade, not current quotes, and not a total-return series. No private
Alpaca downloads are published. Real hardware requires the local installation;
this website makes no physical latency measurements.

### Refresh default and saved custom rules

Public refresh loads the curated **NVDA / full 2017 / SMA16** example: gap 5 bps,
20-unit maximum order and 100-unit position cap, with fees 1 bps and slippage 2 bps.
Its full-year replay ends at $11,839.87 (+18.40%) under these assumptions. This
stock/example was selected after reviewing historical results, not validated on
an unseen year. The same rule returned 1.94% on AAPL and 9.68% on MSFT samples;
no future return is implied. Optional first-70%/last-30% tests are different periods.

Custom draft autosave remains available. Refresh loads the example without
replacing that saved draft; choose **Restore saved custom rule** to recover it.
The local personal workstation shares the navy visual language, with its actual
Python/FPGA/Alpaca controls retained. Public defaults never automatically configure
or start physical hardware.


## AI strategy research (local app)

In **Strategies**, write a hypothesis (15–2,000 characters) and wait for the
editor to save. Select **Research & draft settings**, review the source records,
limitations and proposed values, then **Apply to editor** or **Save candidate &
backtest**. The latter creates a new strategy file, freezes it and runs the selected
dataset/phase with the selected fees and slippage. It never starts paper orders
or FPGA communication. **Undo AI settings** restores the previous editor values;
existing saved files and experiments remain available. Export research JSON to
keep the draft, source records and model deployment together.

Configure these values in ignored `backend/.env` and restart the backend:

```dotenv
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.cognitiveservices.azure.com/
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_DEPLOYMENT=YOUR-DEPLOYMENT-NAME
AZURE_OPENAI_API_KEY=YOUR-LOCAL-KEY
```

No new dependencies are required. Use the normal backend/frontend startup commands
above. Azure calls run server-side only. The public Vercel demo does not include
this feature or access these credentials. Keep the backend bound to localhost.

Azure converts the hypothesis into a short finance search query. Crossref is queried across bibliographic records, including working papers and books. The backend keeps up to four unique candidates with finance vocabulary and matching topic terms, and shows the query in the result. This heuristic can miss relevant research or retain weak matches, so review each source. If none pass, the result explicitly reports missing evidence. The hypothesis goes to Crossref search and Azure. Crossref provides bibliographic
metadata and sometimes abstract excerpts; this is **not full-paper review, live
web browsing, or market-data analysis**. The UI shows what was retrieved and
permits only citations to those records. Relevance, interpretations and proposed
parameters still need human review. Parameters are untested guesses, not proven
by citations. Only anchor and SMA reversion templates are supported. An opening-range breakout needs session tracking, opening-range levels and exit logic in both execution and backtesting. Unsupported drafts explain the disabled Apply/backtest controls and hide placeholder settings. A name, hypothesis or imported JSON does not implement additional algorithms. Research records save under ignored
`backend/data/research/ai_drafts/`. A process-local limit allows ten requests/hour,
one at a time, with bounded input/output and no automatic retry. Each draft uses two Azure calls, one for search planning and one for settings/evidence review. Restarting the
backend resets the limit; it is not a cloud spending cap or public API protection.

Develop on the first 70%, freeze the rule, evaluate the later 30% separately, then
observe live paper results. Model training knowledge and repeated testing can
contaminate historical evaluation. No profitability is promised.
