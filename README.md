# Signum — Tang Nano 9K FPGA trading-engine project

**[Try the public browser demo](https://signum-aayan14.vercel.app/)** — independent virtual portfolios; no FPGA or Alpaca account required.


A learning and portfolio project: deterministic simulated market data, a Python
reference engine, and a matching Verilog engine with UART packet transport.
All orders and fills are simulated. Local runs stay on this PC; optional Alpaca PAPER execution submits virtual orders to the paper broker only.

## React trading dashboard

For persistent Alpaca virtual funds and website-visible simulated fills, see
[Alpaca PAPER account execution](docs/alpaca-paper.md). Real-money trading is unavailable.

The local dashboard supports **Simulation** (Python reference decisions) and
**FPGA Live** (physical UART replies checked against Python). Data source is selected independently: generated prices, Alpaca IEX live
stock trades, or historical/offline replay. The terminal includes price charts with buy/sell markers, decision
history, position/risk limits, kill status, JSON export, COM-port selection,
speed adjustment, and host round-trip metrics.

Prerequisites: Python 3.10+ and Node.js 22.16+ with npm. No FPGA toolchain is
required for simulation or an already programmed board.

First-time setup in PowerShell:

```powershell
cd C:\Coding\fpga_stockmarketsimulation
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd frontend
npm.cmd ci
cd ..
```

Terminal 1, backend (one worker, no reload while using hardware):

```powershell
cd C:\Coding\fpga_stockmarketsimulation
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Terminal 2, frontend:

```powershell
cd C:\Coding\fpga_stockmarketsimulation\frontend
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. Select **Python engine** with **Generated demo prices**, then **Start run** first.
Stop ends generation; each new simulation starts at position zero with seed 1.
Adjust speed from 1 to 20 quotes/second. Export saves the last 240 captured quotes;
the table displays the latest 12 matching its filter.

For **FPGA Live**: program the current `signum.fs`, select the board UART port
(last verified: COM6), close other applications using that serial port, physically
reset the board, and check the reset-confirmation box before starting. Every reply
is validated against the existing protocol and Python reference. The backend keeps
one request outstanding and preserves the 2 ms post-transaction pause.

**Reset before every new physical run**, including after normal stop, kill,
timeout, disconnect, or backend restart. Kill sends a kill-flagged quote and waits
for a validated acknowledgment; it cannot clear the hardware latch. Errors stop
the stream without resending a trade. Other browser tabs can observe but cannot
take ownership. Closing the owning tab stops its run and releases the port after
the current transaction finishes or times out.

Host RTT includes UART/USB and host overhead. The reported one-cycle architecture
implies approximately 37.04 ns at 27 MHz; this is an estimate, **not independently
measured physical computation latency**. Python engine mode does not invent FPGA timings.

Dashboard checks:

```powershell
# From the repository root:
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest backend\tests -q
# Activate OSS CAD Suite for zero skipped RTL tests:
. .\tools\activate.ps1
python -m unittest discover -s tests -v
cd frontend
npm.cmd test
npm.cmd run build
npm.cmd audit
```

See [dashboard architecture and protocol](docs/dashboard.md) for ownership,
telemetry fields, and reset requirements. Keep this service on localhost;
it has no public authentication layer.

For the exact Python packages used during verification (including test tools),
install `backend\requirements-lock.txt` instead of the unpinned development
requirements. The frontend's exact dependency graph is in `package-lock.json`
and is installed by `npm.cmd ci`.

**Current milestone:** UART RX, packet validation, trading engine, UART reply TX,
board wrapper, pin/clock constraints, and build flow are implemented.
**15 tests pass**, including bit-level serial simulation and Python/RTL comparison.
The complete design synthesizes, places, routes at 27 MHz, and produces a bitstream.
**Physical UART validation passed:** 22 replies matched Python, including kill behavior.
LED appearance, power cycling, and long-duration operation still need checking.

## Advanced market research features

On first visit, a centered introduction walks through data sources, execution
engines, run/kill controls, chart inspection, paper accounting, and timing metrics.
Use X, Escape, or Skip introduction to dismiss it; reopen it with **Introduction**
in the top bar. Dismissal is remembered in this browser for the current guide
version. Future user-facing features must update `frontend/src/onboardingContent.ts`
and bump `GUIDE_VERSION` when the revised introduction should appear again.

- Stream AAPL, NVDA, or TSLA trade prints from the data-only Alpaca IEX WebSocket.
- Download paginated historical bars and replay stored, hashed datasets through
  Python or the physical FPGA. A clearly labeled synthetic DEMO works offline.
- Inspect BUY/SELL markers for input price, risk checks, sequence, and UART timing.
- Track a $10,000 cash-only paper portfolio, fills, fees, and realized/unrealized P&L.
- Inspect UART error counters, host RTT percentiles, and measured Python reference
  timing separately from architectural FPGA cycle estimates.

Read [market setup and research workflow](docs/market-research.md) before using
real prices. API credentials belong only in ignored `backend/.env`; only the explicitly selected Alpaca PAPER mode calls the paper broker order endpoint. One stock runs at a time because the FPGA
has one position register. USD stock prices are converted into fixed-anchor
basis-point ticks for the existing engine; both values are visible in inspectors.

## Start with Python

From the project directory, with Python 3.10+ (3.12.14 actually tested):

```powershell
python -m signum --count 20 --seed 1
python -m unittest discover -s tests -v
```

The core has no third-party Python dependencies. HDL tests need Icarus Verilog
(`iverilog` and `vvp`) on PATH; otherwise they are explicitly skipped.

For this checkout on Windows, once OSS CAD Suite is extracted to
`C:\tools\oss-cad-suite`, prepare and activate a project environment:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-hardware.txt
. .\tools\activate.ps1
python -m signum --count 20 --seed 1
python -m unittest discover -s tests -v
python tools/build.py
```

Run the activation line in each new PowerShell terminal. For a different suite
location, use `. .\tools\activate.ps1 -SuitePath 'D:\tools\oss-cad-suite'`.
The helper changes PATH only for the current terminal. The build produces
`build/signum.fs`; programming and checking the physical board are separate
steps described below.

On the original development PC, Python uses this confirmed bundled executable:

```powershell
Set-Location 'C:\Users\shaik\Coding\signum'
$pythonExe = 'C:\Users\shaik\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $pythonExe -m signum --count 20 --seed 1
& $pythonExe -m unittest discover -s tests -v
```

The market generator uses a portable 32-bit LCG:
`state = (1664525*state + 1013904223) mod 2^32`. Each quote advances twice:
price is `10000 + state%41 - 20`, then quantity is `state%41`. Seed 1 begins with
price 9999 and quantity 7. Same seed and count always reproduce the same inputs.

## Strategy and risk rules

- Fair price: 10000 integer ticks; inclusive trading threshold: 5 ticks.
- Buy at price <=9995; sell at price >=10005; otherwise hold.
- Maximum order: 20 units. Position must remain between -100 and +100.
- Quantity is clipped to the request, maximum order, and remaining position room.
- Positive orders buy, negative orders sell. Fills occur immediately in this model.
- Kill blocks the current quote and latches until reset; it does not liquidate.
- Reset clears simulated position, order, and kill state.

One tick is an application-defined fixed unit; prices never use floating point.
For example, at position +99, a requested buy of 20 becomes a buy of 1.
The configured fair price is a teaching assumption, not an estimated market value
or a claim of profitability.

## UART and hardware: next hands-on step

Read [the step-by-step board guide](docs/hardware.md) for explanations, tool setup,
Gowin project instructions, board pin sources, and the PC serial checker.
Read [the packet specification](docs/protocol.md) for exact input/reply formats.

```text
PC -> UART RX -> validated quote -> engine -> reply formatter -> UART TX -> PC
```

Transport is 115200 baud 8N1 with a 27 MHz clock. Send **one quote at a time**,
wait for its reply, then pause 2 ms. Malformed packets do not trade. Requests that
arrive while a previous transaction is active are dropped; there is no queue.
Sequence numbers are echoed but not deduplicated. Never retry automatically after
a timeout; reset before restarting the demo to synchronize simulated positions.

With an activated [OSS CAD Suite](https://github.com/YosysHQ/oss-cad-suite-build/releases)
environment (both bin and lib on PATH):

```powershell
python -m unittest discover -s tests -v
python tools/build.py
```

Output: `build/signum.fs`. The script does not program hardware. Alternatively,
open `signum.gprj` in Gowin IDE and set `signum_top` as top. That IDE path is
provided but unverified here; the open-source build is the confirmed flow.

After programming the correct board and pressing/releasing reset, on the board PC:

```powershell
python -m pip install -r requirements-hardware.txt
python -m serial.tools.list_ports
python -m signum.serial_demo --port COM5 --count 20 --seed 1 --kill-at-end
```

Replace COM5 with the actual serial port. This hardware demo requires pyserial;
its 22-response live check passed on COM6; see the validation record.

## Files and testing

| Path | Purpose |
|---|---|
| signum/model.py | Python decision and risk reference |
| signum/feed.py | Repeatable simulated quotes |
| signum/protocol.py | Quote encoding/decoding and reply decoding |
| signum/serial_demo.py | Stop-and-wait PC-to-board checker |
| rtl/engine.v | Synthesizable trading engine |
| rtl/uart_rx.v, rtl/uart_tx.v | Serial byte reception/transmission |
| rtl/packet_rx.v | Header, CRC, timeout and framing validation |
| rtl/signum_core.v | Parser/engine/reply integration |
| rtl/signum_top.v | Clock, startup reset and board ports |
| rtl/tb_engine.v | Original engine simulation testbench |
| tests/test_signum.py | Python tests and 1,047-cycle engine equivalence |
| tests/tb_serial.v, tests/test_serial.py | Serial bit-level tests and response checks |
| constraints/ | Tang Nano 9K physical and clock constraints |
| signum.gprj | Gowin project template |
| tools/build.py | Reproducible synthesis, routing and packing |

Tests cover exact thresholds, size/position limits, kill/reset, 10,000-quote risk
invariants, corrupted packets, invalid headers, partial timeout, dropped bytes,
framing errors, false starts, reset mid-packet, busy requests, baud mismatch, and
recovery. HDL equivalence uses the default strategy configuration.

The engine uses synchronous active-high reset, accepts a quote on a rising edge
with in_valid, and registers order/position/killed for that quote. Reset takes
priority; invalid cycles retain state and lower out_valid. It has one output
register stage and supports one quote per cycle in isolation; this stop-and-wait
UART wrapper intentionally accepts transactions much more slowly.

## Confirmed results versus remaining checks

[Validation record](docs/validation.md), October 20, 2026:

- Python 3.12.14 and OSS CAD Suite 20261019: **14 passed, zero skipped** (original validation; current suite: 15 passed).
- Synthesis structural check: zero problems. Bitstream packing: successful.
- Post-route estimated maximum: 29.81 MHz, passing the 27 MHz target.
- Resource estimate: 1,351/8,640 LUT4 sites (~15%), 490/6,480 DFF sites (~7%).
- Current checkout: 22 physical UART replies matched Python on COM6; Gowin
  synthesis passed with no warnings or errors.
- Unverified: physical LED appearance, power-cycle behavior, isolated engine
  timing, long-duration operation, and nondefault HDL strategy configurations.

The original first slice had 5 passing Python tests and one skipped HDL test.
The portable toolchain now enables all HDL checks locally; the default system
PATH was not changed. See the validation record for exact tool versions and known
setup issues. Build files and downloaded tools are not committed.

## Later stages and latency

Broader board acceptance and a fresh dashboard-to-FPGA run remain, followed by
equivalent Python/C++/FPGA benchmarks. Measure engine latency separately from UART round-trip
latency. The reply's engine_cycles=1 is an architectural constant, not a timer.
One 27 MHz cycle is about 37.04 ns; that is not an observed end-to-end measurement.
The live host demo separately measures send-to-reply time, including UART, USB,
OS scheduling, and reply processing. The physical UART check measured host round trips of 4.19-4.66 ms; isolated
engine latency has not been measured.

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
does not compile arbitrary strategy code. See [FPGA configuration](docs/fpga-configuration.md).

## Rename from NanoQuant

The project is now **Signum**. Python commands use `python -m signum` and
`python -m signum.serial_demo`. Gowin uses `signum.gprj` with top module
`signum_top`; future open-source builds produce `build/signum.fs`.
The rename itself changed identifiers only. The subsequent configurable-strategy
feature requires newly built firmware; flash it before using FPGA dashboard runs.

Existing backend data, Alpaca settings, and browser recovery drafts are retained.
Historical validation records keep the names of artifacts originally tested.
The local folder and GitHub remote keep their current names until renamed
separately; the absolute startup paths above match the current checkout.

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
[provenance and regeneration](docs/public-market-data.md). They are daily closes,
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

The hypothesis goes to Crossref search and Azure. Crossref provides bibliographic
metadata and sometimes abstract excerpts; this is **not full-paper review, live
web browsing, or market-data analysis**. The UI shows what was retrieved and
permits only citations to those records. Relevance, interpretations and proposed
parameters still need human review. Parameters are untested guesses, not proven
by citations. Only anchor and SMA reversion templates are supported; ideas needing
other rules are flagged rather than deployed. Research records save under ignored
`backend/data/research/ai_drafts/`. A process-local limit allows ten requests/hour,
one at a time, with bounded input/output and no automatic retry. Restarting the
backend resets the limit; it is not a cloud spending cap or public API protection.

Develop on the first 70%, freeze the rule, evaluate the later 30% separately, then
observe live paper results. Model training knowledge and repeated testing can
contaminate historical evaluation. No profitability is promised.
