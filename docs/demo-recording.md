# Recording a Signum software demo

Aim for 45-60 seconds. Record the local app at http://127.0.0.1:5173 in Canvid.
Use a supported reversion idea so the clip can follow the actual hardware path.

## Before recording

1. Keep the board connected, load configurable Signum firmware and close other
   serial applications. COM6 is the verified Tang Nano port on this PC.
2. Start Python backend and frontend using the README commands. Check Backend
   connected. Open Introduction if you want a refresher, then close it.
3. Use Generated demo prices and Local $10,000. These provide repeatable inputs.
4. Press and release S2 before each hardware run. Check the physical-reset box.
   SRAM firmware disappears after power loss; reload the vendor-built image if
   the board returns factory text instead of Signum replies.

## Recording sequence

| Approximate time | Action | What should be visible |
|---|---|---|
| 0-5 seconds | Show the local workspace, then open Your rules | Project name and hypothesis editor |
| 5-12 seconds | New strategy, name it, paste the hypothesis below and wait for Saved | Hypothesis and saved status |
| 12-22 seconds | Research & draft settings; shorten waiting time in the edit | Supported candidate with numeric values |
| 22-30 seconds | Expand Research sources briefly, then Apply & prepare run | Evidence, automatic editor settings and selected strategy in Run setup |
| 30-35 seconds | Choose FPGA Live, COM6, physical S2 reset confirmation, speed 10/s | Hardware setup and Start run |
| 35-50 seconds | Start run, let at least 40 samples arrive | Configuration acknowledged, chart, BUY/SELL and FPGA matches Python |
| 50-60 seconds | Inspect a chart marker, show round trip, then Stop run | Decision details and stopped state |

### Hypothesis to use

> Small deviations below a recent average may recover. Use moving-average
> reversion with the prior 16 samples: buy at least 5 normalized ticks below the
> average and sell at least 5 ticks above, with maximum order 3 and position limit 8.

Check that the candidate is supported and FPGA-compatible before applying.
For this example, confirm SMA16, gap 5, max order 3 and position limit 8. A fresh
Azure response may vary, so review it. The first 16 quotes warm up the average.
At 10 samples/second this takes roughly 1.6 seconds, followed by decisions.

Apply & prepare run saves and selects a frozen version. Start run begins hardware
communication. The editor-only button fills fields while leaving freezing and
selection as separate steps. Opening-range breakout hypotheses require additional
engine logic and intentionally cannot be prepared for execution.

## Captions

- AI-assisted strategy settings
- Generated prices / physical FPGA execution
- Hardware replies checked against Python
- Host round trip includes USB/UART

Use readable zooms on hypothesis, proposed settings, configuration acknowledgment
and one decision. Pause the cursor while viewers read. If waiting is shortened,
label that edit. Stop ends generation; reset S2 before the next take.

## Verification on November 18, 2026

The actual Azure-produced settings above passed backend save/freeze, physical
configuration readback and 60 quote responses through the application's WebSocket
path. All matched Python: 14 BUY, 14 SELL, 32 HOLD. Configuration plus quotes gave
61 validated replies with zero recorded communication/reference errors. Mean host
RTT was 4.2406 ms. Max observed order was 3 and absolute position 6. These are
generated-data physical results, not isolated engine latency or strategy research.

Browser page access was blocked by saved permissions during verification. Actual
button clicking and rendered layout remain to be checked once access is enabled;
frontend rendered-markup tests and production build were used in the meantime.
