# Signum hands-on lab

Use Local $10,000 simulator for these exercises. No broker orders are submitted.
Backend: http://127.0.0.1:8000/api/status; dashboard: http://127.0.0.1:5173/.
If frontend is stopped, run `npm run dev` from the frontend directory.

## 1. Follow one decision (5 minutes)

Choose Python engine, Generated demo prices, Local $10,000, and Use original
strategy in Strategies. Start at 2 samples/second. Find a BUY and SELL marker;
click each and inspect normalized price, requested quantity, order and position.
Stop after about 30 samples.

The original reference is 10000 ticks; buy at 9995 or below, sell at 10005 or
above, and hold between. Generated marks use ticks/100 dollars, but real-stock
normalization is different: 10000 represents the initial anchor price. A tick
there is 1/10000 of the anchor, not a universal exchange tick or one dollar.
Predict a decision before reading it. An engine SELL is a request: the local
long-only ledger cannot sell shares it does not hold. Engine and portfolio
positions can therefore differ. Stop does not liquidate a position.

## 2. Change one setting (5 minutes)

Create Lab - cautious anchor: fixed anchor, threshold 15, max order 3, position
limit 8. Hypothesis: requiring a larger displacement reduces signal activity.
Wait for Saved, Freeze version, Use for next paper run. Repeat generated prices
at the same speed and sample count. Compare the first 30 decisions with exercise 1.

A larger threshold narrows when a signal qualifies. Smaller risk caps also alter
which nonzero orders can happen, so this combined change cannot isolate the
threshold effect. For a controlled comparison, save another copy with the same
caps and threshold 5. Compare that pair with identical data/sample count.
A new run starts a new local portfolio; profit differences are simulation results.

## 3. Give the rule memory (5 minutes)

Create Lab - SMA16: moving-average reversion, window 16, threshold 5, max order 3,
position limit 8. Save, freeze, select and run with generated prices. The first
16 quotes should HOLD, followed by decisions against the previous 16-price mean.
The newest price is excluded from that comparison's mean, then enters history.

Reversion hypothesizes that departures from a reference may reverse. In a strong
trend, a falling price can keep falling; a buy signal is not a prediction guarantee.
Compare the anchor and moving reference using the same input sequence.

## 4. Freeze, test, then validate (10 minutes)

In Strategies choose an existing NVDA 1Min dataset with 1959 samples (or AAPL
5Min with 416), Development first 70%, fees 1 bps, slippage 2 bps. Run frozen
backtest. Note ending equity, fees, maximum drawdown and buy-and-hold equity.
Repeat the exact frozen snapshot/data/phase to check reproducibility.

Create a new experiment with fees 10 bps and slippage 10 bps; compare the cost
impact. One basis point is 0.01%; ten bps is 0.1%. Higher turnover can accumulate
costs. Drawdown is the decline from an earlier equity peak. The benchmark is a
full-cash buy-and-hold simulation, not a risk/exposure-matched strategy.

After choosing rules and costs using development data, test Validation final 30%
once without tuning against it. Both periods start fresh; their results need not
agree. Repeated validation tuning turns validation into development data.
Backtests fill signals on the next sample; main local runs fill at the current
sample mark, so those results are not directly interchangeable.
The 12-sample synthetic DEMO is a plumbing test, too short for SMA16 warmup.

## 5. Watch real historical prices (5 minutes)

Choose Historical / offline replay in the main controls, a saved NVDA or AAPL
dataset, Python engine and Local $10,000. Select the same frozen strategy and run.
Increase speed: it processes stored bars faster, not a faster stock exchange.
Replay ends when samples run out. These are bar-close samples, not every trade.
The download symbol chooses a download target; selected replay dataset chooses
what actually runs. Existing saved data needs no fresh download.

## 6. Run the same rule on physical hardware (5 minutes)

Stop first. Select SMA16 frozen snapshot, Generated data and Local $10,000. Close
Gowin Programmer/serial terminals, press and release S2, choose FPGA Live/COM6,
confirm physical reset and start. Requires the configurable firmware already flashed.
Expect configuration acknowledged, first 16 HOLD, then Matched physical replies.
Observe latency, trade LEDs, order/position caps. Host RTT includes USB/UART and
OS overhead; architectural engine cycles are not an independently measured timer.

Press Latch kill switch and wait for acknowledgment. Trading stops without selling
all holdings. The board remains killed until S2 reset. Reset before every next
hardware run. The previous acceptance test left kill latched. If configuration
fails, do not retry trades: stop and resolve firmware/reset/port ownership first.

## 7. Keep your work (2 minutes)

Export .strategy.json. Change a hypothesis and wait for Saved. Inspect saved
revision backups; restore one and see it become a new revision. Existing frozen
snapshots remain unchanged. Exported files and ignored backend data need backups;
GitHub does not contain your saved experiments or account journals.

Optional later: Alpaca PAPER with live data uses persistent virtual broker funds
and explicit consent during a supported open session. It is a different execution
mode from this local lab; do not enable it just to replay history.
