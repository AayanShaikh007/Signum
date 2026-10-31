# Deploying supported strategies to the FPGA

This update requires a new bitstream. Old firmware rejects the configuration
handshake; the dashboard stops before sending prices. There is no automatic
fallback, trade retry, or reset of hardware kill state.

## First-time firmware update

Close the backend and any serial terminal before programming. In PowerShell:

```powershell
cd C:\Coding\fpga_stockmarketsimulation
. .\tools\activate.ps1
python tools/build.py
```

Alternatively open `signum.gprj` in Gowin, choose `signum_top`, synthesize/place/
route, and use the resulting file from that flow. With Gowin Programmer flash
`build/signum.fs` from the open-source build (or the fresh Gowin output).
Do not use an older cached `impl/` output. See [board instructions](hardware.md).
Programming changes the FPGA; building alone does not. Close Programmer afterward.

Restart the backend and refresh the dashboard. No broker orders are required to
verify the hardware: begin with Generated or Replay data and Local $10,000.

## Selecting a strategy

1. Open Strategies, choose fixed-anchor or moving-average reversion, and set bounds.
2. Hardware SMA windows are 2, 4, 8, 16, 32, 64. Window 20 remains Python-only.
   Thresholds are normalized ticks (1-500); order cap 1-20 and position cap 1-100.
3. Save, freeze, and select the snapshot for the next run. Select FPGA Live.
4. Press/release physical S2, confirm reset, select the port, and Start.
5. Configuration must say **acknowledged** before any price telemetry appears.
   Every physical decision is compared with the same frozen Python reference.
6. To change settings, Stop, physically reset S2, and start a new run. Settings
   cannot change mid-run or clear a kill latch. Kill still blocks the current quote.

Fixed-anchor compares normalized price with 10000. SMA compares the current price
with the floor of the mean of the **previous** N samples. Its first N quotes HOLD.
Its ring buffer and running sum run on the FPGA; the backend does not precompute
its mean or trading decision. History starts empty after physical reset. There is
no continuous state across runs. Live Alpaca PAPER gating remains unchanged.

## Configuration wire protocol v2

Quotes/replies retain v1 byte layouts, magic, CRC, and 2 ms post-transaction pause.
Configuration uses one 16-byte request with the same body struct `<2sBBIIH`:

| Field | Configuration meaning |
|---|---|
| magic | `NQ` |
| version / flags | 2 / 2 |
| sequence | random 32-bit correlation token |
| price word | packed settings below |
| quantity | max order |
| trailing CRC | CRC16-CCITT over the first 14 bytes, little endian |

Settings word: bit 31 selects SMA (0 means anchor); bits 30:28 contain log2(window)
for SMA (1-6), zero for anchor; bits 27:16 hold position limit; bits 15:0 threshold.
All bounds are checked before a single atomic configuration write. No position or
history is changed by configuration. The first accepted quote or configuration
locks configuration until reset. Invalid settings leave all settings unchanged.

Acknowledgment uses the 20-byte response struct `<2sBBIiiH` plus CRC: magic NR,
version 2, flags 2 for success or 6 for rejection, echoed token, raw settings word
in the order field, max order in the position field, and cycles 0. The settings
word is interpreted unsigned. Rejection returns the settings currently active.
Configuration does not generate a trading action/LED pulse or contribute RTT
samples. UART request/reply counters include it; configuration counters identify it.
The acknowledgment verifies settings, not the SHA256 of the full strategy file.

CRC, token, type, or readback failures invalidate the host session. Timeouts send
no retry. Physically reset before reopening. Old v1 reserved flags remain invalid.
The CLI's original v1 demo remains available for default-rule checks, but the
managed dashboard always requires v2 configuration, even for the original rule.

## Validation limits

RTL/UART simulation checks all supported windows, unsigned extreme prices,
warmup, wraparound, order/position clipping, kill, reset, bad settings and locked
reconfiguration. Mock transport checks configuration failures without quotes.
Synthesis/route results are tool estimates. No new physical-board acceptance or
independently measured engine latency is implied by these tests. Engine cycles
remain the architectural one registered stage, not a physical stopwatch reading.

### Build result (October 31, 2026)

The first implementation failed the 27 MHz target (25.58 MHz estimated). Narrowing
position/order arithmetic to the validated hardware bounds resolved that path.
Final post-route estimate: **30.16 MHz**, passing 27 MHz. Utilization: 2,179/8,640
LUT4 (25%), 665/6,480 DFF (10%), one block RAM. Structural synthesis check reported
zero problems; packing produced `build/signum.fs`. Tool-library/ABC informational
warnings remain in the synthesis log. These are tool results, not physical
measurements. Physical acceptance after programming remains outstanding.

### Physical acceptance (October 31, 2026)

After the operator flashed and reset the board, the running FastAPI backend
configured the physical COM6 FPGA for SMA16, threshold 5, max order 3, position
cap 8. Settings acknowledgment matched; all 65 quote responses matched Python.
The first 16 held during warmup; the run produced 15 BUY, 16 SELL, 33 HOLD
(including kill). Maximum observed order was 3 and absolute position 6; this run
did not reach the position clipping boundary. Kill was acknowledged. Including
configuration, 66 UART replies validated with zero recorded communication or
reference errors. Generated prices/local portfolio only; no broker orders.

Measured host RTT: mean 4.2875 ms, range 4.1977-5.1801 ms, p95 4.4180 ms. This
includes UART/USB/host overhead and does not measure isolated FPGA computation.
Other supported windows have simulation coverage, not physical acceptance here.
