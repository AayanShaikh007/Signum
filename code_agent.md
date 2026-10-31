# Code agent work log

This file records agent work for NanoQuant in
`C:\Coding\fpga_stockmarketsimulation`. Future work must be appended here as
required by `AGENTS.md`. Dates use America/Toronto. Earlier entries below were
reconstructed from this conversation on October 20, 2026; exact times were not
recorded. Existing project work predating this conversation is not agent work
from this session.

## 2026-10-20 - Restore the GitHub repository into the workspace root

- Request: bring files from `AayanShaikh007/fpga_stockmarketsimulation` directly
  into the current repository without creating a nested repository folder.
- Found the workspace already had the correct origin, but all tracked working
  files were missing. Local main was at `1f63b09`.
- Fetched origin, restored the missing tracked files, and fast-forwarded main
  to `d1db5c6`. Initial attempts encountered sandbox restrictions on Git metadata;
  approved commands completed the operations.
- Verified files were directly in the workspace root and the working tree was
  clean immediately after restoration. No commit or push was performed.

## 2026-10-20 - Prepare and run the project locally

- Read README, hardware instructions, validation notes, and build/test sources.
- Ran `python -m nanoquant --count 20 --seed 1` successfully with system Python
  at `C:\Python313\python.exe`.
- Initial test run: six passed and eight HDL tests skipped because Icarus Verilog
  was missing from PATH.
- Created `.venv` and installed the pinned hardware dependency, `pyserial==3.5`.
- Downloaded the official Windows x64 OSS CAD Suite 20261019 archive to
  `C:\tools\nanoquant-downloads` and extracted it to `C:\tools\oss-cad-suite`.
  Verified the published SHA256:
  `20dd77b47768318692ef657c481c567d6138ff6d16f1b292debdb9fba444ba43`.
- Added `tools/activate.ps1` to enable the project virtual environment and suite
  bin/lib paths for the current terminal. Documented setup commands in README.
  No persistent system PATH changes were made.
- With the toolchain enabled, all original 14 tests passed with zero skips.
- Ran `python tools/build.py`: synthesis, routing, and packing succeeded;
  generated `build/nanoquant.fs` (2,070,048 bytes). Initial post-route estimate
  was 29.81 MHz, passing the 27 MHz target. These are tool estimates.
- Build output is local and Git-ignored; logs include `build/build-run.log`.

## 2026-10-20 - Identify the board and troubleshoot programming access

- Initial USB inventory showed CircuitPython device COM28 and an unknown USB
  device with a port-reset failure. No FPGA programming probe was detected.
- Asked the user to reconnect with a data cable directly to the PC.
- After reconnection, detected FTDI VID:PID `0403:6010`, serial
  `FACTORYAIOT_PRO`, with UART on COM6. COM5/COM8 were Bluetooth ports.
- `openFPGALoader --scan-usb` and `-b tangnano9k --detect` could not access the
  probe using its installed FTDI drivers. No programming occurred through
  openFPGALoader.
- Explained the Zadig/WinUSB alternative for JTAG Interface 0 while retaining
  the UART driver on Interface 1. Did not replace any drivers.
- The user recalled an existing Gowin setup. Explained SRAM programming using
  Gowin Programmer and the generated bitstream, retaining the FTDI drivers.
- Subsequently found the installed programmer at
  `C:\Programs\Gowin\Gowin_V1.9.11.03_Education_x64\Programmer\bin\programmer.exe`
  and Gowin CLI at the corresponding `IDE\bin\gw_sh.exe`.
- Physical programming through the Gowin GUI was handled by the user; the agent
  did not operate that GUI or independently verify its programming steps.

## 2026-10-20 - Add onboard LED action indicators

- Request: show trades and actions on the board LEDs before further milestones.
- Checked Sipeed's official LED example for package pin mapping:
  LED indices 0-5 use pins 10, 11, 13, 14, 15, 16.
- Exposed engine result-valid and signed order signals from `nanoquant_core`.
- Added active-low LED logic and connected it in `nanoquant_top`:

  | LED index | Meaning |
  |---|---|
  | 0 | Any completed decision, including a killed quote |
  | 1 | Positive executed order / buy |
  | 2 | Negative executed order / sell |
  | 3 | Zero order while not killed / hold, including risk-blocked orders |
  | 4 | Kill latched until reset |
  | 5 | Protocol/framing error or busy dropped request, latched until reset |

- Decision/activity pulses last 5,400,000 clocks (200 ms at 27 MHz). Each event
  reloads its own timer; several LEDs can remain lit during rapid mixed actions.
- Added LED constraints and documented behavior in `docs/hardware.md`.
- The first LED build routed successfully but packing failed due to LVCMOS33
  LED outputs conflicting with the checkout's LVCMOS18 reset input in the shared
  bank. Matched LED outputs to LVCMOS18; packing then succeeded. Preserved the
  locally configured reset on pin 4 and its 1.8 V bank setting.
- Added `tests/tb_action_leds.v` and `tests/test_leds.py` to check buy/sell/hold
  patterns, pulse expiry, kill, error, and reset. All 15 tests passed.
- Updated LED design's post-route estimated maximum was 32.04 MHz, passing the
  27 MHz target; the updated bitstream was generated successfully.
- LED appearance on the physical board has not been verified by the agent.

## 2026-10-20 - First physical serial attempt

- Request: validate FPGA-to-Python communication, without building a dashboard.
- Ran the serial demo on COM6 with 20 quotes, seed 1, and kill-at-end.
- Port opened and data arrived, but decoding failed with
  `ValueError: response header`. Correct trading responses were not confirmed.
- Did not resend trading quotes automatically. A subsequent passive read returned
  no bytes. An initial passive-read command had a quoting error; corrected it.
- Asked the user to program the updated bitstream and reset before retrying.

## 2026-10-20 - Fix Gowin synthesis errors and width warnings

- User reported unknown module `action_leds` plus arithmetic truncation warnings.
- Found the generated `impl/gwsynthesis/nanoquant.prj` omitted the LED module,
  while the project file on disk included it. The loaded IDE source list was stale.
- Replaced unsized increment literals with explicit widths in `uart_rx.v`,
  `packet_rx.v`, `uart_tx.v`, and `nanoquant_core.v`.
- Made the engine's conversion of its 33-bit intermediate amount to the 32-bit
  signed order explicit. Amount is capped by the 16-bit maximum-order parameter.
- All 15 tests passed after the width fixes.
- Ran Gowin synthesis through a local Tcl script, `build/verify_gowin.tcl`:
  opened `nanoquant.gprj`, selected `nanoquant_top`, and ran `syn`.
  Synthesis succeeded with no WARN/ERROR entries; log: `build/gowin-verify.log`.
- When the user still received the unknown-module error in the IDE, moved the
  `action_leds` module definition directly into `rtl/nanoquant_top.v`, which was
  already in the loaded source list. Removed the separate `rtl/action_leds.v`
  file and its project/build entries; pointed the LED test at the top source.
- Reran all 15 tests and Gowin synthesis successfully, with no warnings/errors.
  This last verification ran synthesis; it did not itself run Gowin place-and-route
  or program hardware. User was instructed to reload the file and rebuild.

## 2026-10-20 - Successful physical FPGA-to-Python validation

- On the user's request to proceed to the communication milestone, detected COM6
  and ran:

  ```powershell
  . .\tools\activate.ps1
  python -m nanoquant.serial_demo --port COM6 --count 20 --seed 1 --kill-at-end
  ```

- Exit status 0. All 22 physical FPGA replies matched the Python reference.
  The checker validated response header, CRC, sequence, signed order, position,
  kill state, and architectural cycle count.
- Sequences 0-19 exercised buy, sell, and hold decisions. Sequence 20 latched kill;
  sequence 21 confirmed trading remained stopped. Final simulated position: -43.
- Measured host round trips ranged from 4.1930 to 4.6643 ms. These include USB,
  UART, OS, and host processing. `engine_cycles=1` is an architectural constant,
  not a measured FPGA latency result.
- Saved raw output in `build/hardware-serial-check.log` and added the physical
  result to `docs/validation.md`, distinguishing it from the historical record.
- This run left kill latched; reset is required before the next run. Current
  physical state may have changed since that observation.
- No React dashboard, WebSocket telemetry server, C++ benchmark, or isolated FPGA
  latency benchmark was built. LED visibility, power-cycle acceptance, and
  long-duration hardware reliability remain unverified.

## 2026-10-20 - Establish ongoing agent logging

- Request: log all work so far and future work in `code_agent.md`.
- Created this retrospective record and root `AGENTS.md` requiring future agents
  to read and update it for every task, including troubleshooting and read-only work.
- Inspected repository status and existing validation notes. Preserved unrelated
  local edits, including `.gitignore`; no commit or push was performed.
- Verification: checked that both new Markdown files exist and ran whitespace
  validation for them. No runtime tests were needed for these documentation changes.

## Current continuation notes

- Project root: `C:\Coding\fpga_stockmarketsimulation`.
- Activate tools: `. .\tools\activate.ps1` in PowerShell.
- Tests: `python -m unittest discover -s tests -v` (latest result: 15 passed).
- Open-source build: `python tools/build.py`.
- Gowin project: `nanoquant.gprj`; LED module is inside `rtl/nanoquant_top.v`.
- Last confirmed FPGA UART port: COM6; enumerate again before future hardware use.
- Reset before another serial demo. Avoid automatic retries after failed requests,
  since they might already have affected the simulated position.
- Hardware communication milestone passed. Dashboard is deferred until explicitly
  requested. Append future actions and results below rather than replacing history.

## 2026-10-20 - Commit and publish completed work before dashboard development

- Request: commit all completed work to GitHub in reasonably scoped commits before
  starting the dashboard. Use coherent commits for future development as well;
  do not manufacture changes, backdate commits, or split trivial edits for count.
- Reviewed all tracked and untracked changes, including the user-provided
  `development_journal.md`. Added a historical-status notice to that journal,
  refreshed stale README validation claims, and corrected the hardware guide's
  reset pin table to match the current pin 4 constraint.
- Removed an accidental whitespace-only `.gitignore` edit; no functional ignore
  rules changed. Kept virtual environments, binaries, build outputs, and local
  tool downloads excluded from Git.
- Reran the complete test suite: 15 passed, zero skips. `git diff --check` passed.
- Created six focused commits and successfully pushed them to `origin/main`:
  - `0161d03`: Windows activation and setup instructions.
  - `45c7c81`: explicit arithmetic widths in engine/parser/UART modules.
  - `09187af`: LED integration, core result outputs, core counter width fix,
    shared-bank constraints, and serial testbench port update.
  - `f0e2f21`: LED simulation coverage.
  - `9e26ff7`: hardware/LED guide and physical UART validation record.
  - `2442678`: historical development journal with a current-status notice.
- A partial staging patch for the core counter width failed to apply; the complete
  reviewed core change was included in the LED integration commit instead. No
  source changes were lost. Git Credential Manager briefly delayed the push,
  which then completed successfully.
- Added this log and `AGENTS.md` as the seventh commit group. The next action is
  to push that documentation commit and verify local/remote HEAD equality and a
  clean working tree. Dashboard source has not been created in this task.

## 2026-10-20 - Dashboard simulation foundation

- Inspected existing market generator, model, protocol, serial demo, project
  instructions, and the user's Land-book reference. Used its compact card and
  green chart styling in a dark responsive terminal, rather than a landing page.
- Added a local FastAPI/WebSocket service with exclusive run ownership,
  deterministic Python simulation, configurable speed, kill, stop, disconnect
  cleanup, bounded observer queues, serial-port discovery, and origin checks.
- Added the React/TypeScript/Vite frontend with Tailwind, Recharts, mode controls,
  chart markers, exposure meter, decision filters, session JSON export, explicit
  provenance, and separately labeled host measurements and architectural estimates.
- Added six backend tests; all passed on the simulation implementation. Initial
  dependency audit reported vulnerable frontend tooling; remediation is in progress
  before final verification. Hardware transport is the next implementation step.

## 2026-10-20 - Integrate serial transport and verify dashboard services

- Extracted the existing CLI's stop-and-wait serial logic into
  `nanoquant/transport.py`; the CLI and backend now both reuse `SerialSession`,
  the existing encoder/decoder, and the reference model. Serial opens are exclusive.
- Live transactions send once, read a complete reply with a two-second timeout,
  validate protocol/sequence/reference/cycles, and preserve the 2 ms pause outside
  the host RTT measurement. Errors invalidate the session; nothing is resent.
- Live runs require a selected port and explicit operator confirmation of physical
  reset. All ended live runs conservatively require reset again. Stops and owner
  disconnects await in-flight work before releasing the serial port. Pending kill
  requests complete before stop when communication is healthy; errors do not
  pretend a kill acknowledgment was received.
- UI controls label Simulation and FPGA Live separately. Added pending-kill status,
  measured Python step timing, mode restoration for observers/reconnects, bounded
  run-specific history, and lazy chart loading to reduce the initial JS bundle.
- Added tests for timing provenance/history limits and serial error/race scenarios.
  Final checks: 15 existing Python/HDL tests passed with no skips; 18 backend tests
  passed; 3 frontend tests passed; TypeScript/Vite production build passed; npm
  audit reported zero vulnerabilities. Backend tests produce one dependency
  deprecation warning from Starlette's httpx compatibility path.
- Started local FastAPI and Vite servers for protocol QA. A real WebSocket smoke
  check through `ws://127.0.0.1:5173/ws` compared 20 simulation quotes to the existing
  generator/model, confirmed kill acknowledgment and released ownership. HTTP
  port discovery through the Vite proxy included COM6. This was simulation-only
  service validation and did not transmit quotes to physical hardware.
- Browser QA: the in-app browser was unavailable. The available Edge browser's
  localhost origin gate then rejected preview because permission was declined.
  No browser workaround or alternate visual automation was attempted. Visual,
  responsive, and browser-interaction QA remain unverified.
- Asked the operator to reset the FPGA and free COM6 before a fresh hardware run;
  no reset confirmation has arrived during this implementation. The new live
  dashboard path is mock-tested, not newly physically validated. The older
  successful 22-response board test is explicitly distinguished in the docs.
- Updated README with exact installation and two-terminal startup/test commands,
  added `docs/dashboard.md` for the telemetry/ownership/reset contract, added a
  tested Python dependency snapshot, and updated validation notes.
- Made focused commits for the simulation backend, terminal UI, shared UART path,
  dependency audit fix, kill acknowledgment, frontend telemetry/chart isolation,
  serial race tests, operating docs, exclusive UART/reconnect behavior, and Python
  dependency snapshot. All commits use actual current work; none are backdated.
- An initial README patch failed because its old-context line no longer matched;
  reapplied the intended documentation change using current context.
- No FPGA RTL or constraints were modified. Generated builds, virtual environments,
  downloaded tools, and node_modules remain ignored. Test servers are temporary
  and are stopped during teardown. Final publication and HEAD checks follow.
- The previous seven-commit publication completed successfully; local and remote
  main matched `cd7690c`, with a clean worktree before this dashboard task.

## 2026-10-20 - Clarify physical reset button

- User asked whether the project's reset is S1 or S2. Checked the current CST:
  `rst_n` is assigned to package pin 4, LVCMOS18.
- Checked Sipeed's board documentation and FAQ, which identifies S2 with the
  JTAG_SEL pin; the pin-4/S2 mapping matches this reset assignment. Instructed
  the user to press and release S2 while keeping the board powered.
- No hardware commands or runtime changes were made. Physical dashboard testing
  still awaits the user's confirmation that reset is complete.

## 2026-10-20 - Physical dashboard-backend test after operator reset

- Operator confirmed pressing both board buttons sequentially. Verified the FTDI
  board UART was COM6 and that no backend was listening on port 8000.
- Started the local FastAPI server and connected one test client to its actual
  `/ws` endpoint. Started FPGA Live with COM6, seed 1, five quotes/second, and the
  operator's reset confirmation. No browser automation was used.
- Received 20 physical quote responses, independently checked their sequence,
  price, quantity, signed order, position, kill state, and telemetry provenance
  against the existing generator/model. The shared transport additionally
  validated reply header, CRC, sequence, architectural cycles, and equivalence.
- Sent one WebSocket kill command. Its physical reply was acknowledged at
  sequence 20, giving 21 matching physical responses total. BUY, SELL, HOLD,
  and KILL appeared. Final position -43; final state killed, owner released,
  reset_required true. No automatic retries occurred.
- Measured host RTT: 4.1874-4.3436 ms, mean 4.2561 ms. These include UART/USB/host
  overhead and are not isolated physical FPGA computation measurements.
- Saved raw events in `build/dashboard-hardware-check.jsonl` and summary in
  `build/dashboard-hardware-summary.json`, both ignored. Updated validation docs.
- The dashboard stops on acknowledged kill, so a second post-kill quote was not
  sent in this run. Browser rendering and LED appearance remain unverified.
- Stopped the temporary backend after the run. Board remains kill-latched at
  last observation; the operator must press/release S2 before the next live run.
- This documentation/evidence update is committed and published using the
  established focused-commit workflow; no runtime source, RTL, or constraints changed.

## 2026-10-20 - Launch dashboard for the user

- User requested to see the dashboard and confirmed pressing/releasing S2.
- Started FastAPI at `http://127.0.0.1:8000` and Vite at
  `http://127.0.0.1:5173`; both reported ready. Left them running for the user's
  requested interactive session. No quotes were sent and no run was started.
- Attempted to open the dashboard using the supported Edge browser tool. A saved
  permission/managed policy denied localhost origin access. Did not attempt any
  alternative browser-control route; provided the direct link for the user to open.
- The user can select FPGA Live, COM6, attest the already performed physical reset,
  and start when ready. Browser visual QA remains unverified by the agent.

## 2026-10-20 - Explain the user's running graph and inactive LEDs

- Read `/api/status` without interrupting the active run. It reported running
  Simulation at five quotes/second, an empty serial port, reference validation,
  null host RTT/cycles, and measured Python step timing. This run uses Python only.
- Reviewed current LED logic: physical activity and decision outputs require actual
  FPGA engine result events. Simulation does not send UART quotes and therefore
  does not trigger those board LEDs.
- Explained that prices are generated in both modes, while FPGA Live delegates
  decisions to hardware and compares replies against Python. Provided steps to
  stop simulation, select FPGA Live/COM6, confirm physical reset, and start.
- No run controls, UART commands, source files, or hardware state were changed.

## 2026-10-20 - Explain current repository code after reported local changes

- Inspected Git status/history, frontend components and WebSocket hook, backend
  routes/controller/telemetry, generator/model/protocol/shared serial transport,
  FPGA top/core/engine/parser, and build script.
- Git reports no application-source changes against HEAD `2198554`; the only
  working-tree change before this explanation was the accumulated agent log.
  Unsaved editor buffers or edits in another checkout cannot be inferred from Git.
- Explained the two execution paths, command/telemetry flow, risk-rule example,
  packet validation, asynchronous serial ownership, FPGA pipeline, LED timers,
  and the distinction between host RTT and architectural engine-cycle estimate.
- No running session was interrupted, no hardware packets were sent, and no
  application code was changed. Runtime tests were not needed for this explanation.

## 2026-10-20 - Add market integration, replay, paper ledger, and engineering monitor

- Request: add real AAPL/NVDA/TSLA prices, inspectable decision markers, $10,000
  paper portfolio/P&L/fees, FPGA metrics, and historical replay; make focused
  commits and push. Inspected the current backend, transport, frontend, tests,
  and official Alpaca streaming/history documentation before implementation.
- Chose data-only Alpaca IEX WebSocket trade prints and paginated REST historical
  bars. Added ignored backend `.env` configuration plus a safe example. Credentials
  stay server-side; the provider endpoint returns only configuration/coverage.
  There are no broker order APIs or real-money execution code paths.
- Asked whether the user has credentials; none are configured locally during this
  task. Implemented explicit missing-key errors without generated fallback.
- Preserved the unchanged FPGA fair-price/position design by normalizing USD prices
  to basis-point ticks around the first accepted sample. Generated inputs keep
  their original ticks and a fixed synthetic $100 anchor. One stock runs at a time
  because the hardware owns only one position register.
- Added source provenance/timestamps, validated replay downloads with bounded
  pagination and ordered samples, cached dataset hashes, and an explicitly
  synthetic 12-sample DEMO fixture for offline testing. No real market dataset
  was downloaded without credentials; synthetic data is not labeled real history.
- Added a Decimal long-only paper ledger with $10,000 initial cash, average cost,
  realized/unrealized/total P&L, cash-funded fills, configurable fees, and unfilled
  quantities. Engine orders/position and paper fills/position remain distinct.
- Extended shared UART transport with classified error counters and separately
  timed Python reference steps, preserving single-send stop-and-wait behavior,
  existing validation, and the 2 ms pause. Added bounded RTT p95/cumulative metrics.
  FPGA-side packet-drop counts stay null/unavailable; no unsupported hardware
  metric or measured compute speedup is fabricated.
- Integrated generated/live/replay sources independently from Python/FPGA mode.
  Live bursts use a latest-event bounded queue, count superseded events, and reject
  duplicates/stale/out-of-order data. Stop/kill works while markets are idle;
  pending source tasks and provider sockets close deterministically on exit.
- Added market-source/stock/replay/date/fee controls, real USD and source-time chart
  axes, accessible clickable trade markers and detailed risk/timing inspection,
  paper accounting panels, and engineering diagnostics. Generated charts retain
  quote-sequence axes. Session export carries enriched telemetry.
- New tests cover paper identities/fees/cash, normalization, provider mocks,
  historical pagination/auth errors, dataset tamper/path/date validation, replay
  streaming, fake-hardware mapping, idle-feed kill, source cleanup, and counters.
- Verification: 15 original Python/HDL tests passed with zero skips; 50 backend
  tests passed; 3 frontend unit tests passed; production build passed; npm audit
  found zero vulnerabilities. Backend test output includes the existing Starlette
  httpx-compatibility deprecation warning.
- Found the previous interactive backend stopped with no owner; restarted that
  service to load new code and retained the existing Vite server for the user.
  Runtime proxy acceptance replayed all 12 synthetic samples and confirmed paper
  cash/holdings constraints, completed state/ownership release, and explicit
  missing-credentials rejection. No hardware requests were sent. Raw smoke logs
  are in ignored `build/research-replay-*.jsonl/json` files.
- Browser visual checks remain blocked by the previously saved origin denial;
  no browser workaround was attempted. Real Alpaca access and a new physical
  FPGA stock/replay run remain unverified pending credentials and reset readiness.
- Added detailed usage/modeling limits in `docs/market-research.md`, refreshed
  README/architecture, and recorded results in `docs/validation.md`.
- An attempted same-patch delete/add replacement of MarketChart was rejected by
  the patch tool; rewrote the intended source file normally and its build passed.
- Used focused commits for the ledger, normalization, provider/replay, metrics,
  integration, source controls, portfolio/performance panels, marker inspection,
  lifecycle hardening, integration tests, documentation, and source-time axes.
  No backdating or artificial empty commits. Final build and GitHub publication follow.

## 2026-10-20 - Explain the short simulation replay

- User asked why an apparent AAPL simulation ends after roughly nine trades.
- Read the running service status and dataset list without changing the run.
  The actual completed run used Python execution and the synthetic DEMO replay,
  not AAPL. Only that 12-sample dataset is currently available. Final sequence
  was 11, state completed, no error, and the paper ledger recorded 10 fills.
- Explained that replay stops at dataset exhaustion, not every sample becomes a
  trade/fill, and the stock selector in replay mode selects a download target.
  Suggested generated data for a continuous offline run or downloading/selecting
  actual AAPL history after API setup. No source or hardware state was changed.

## 2026-10-20 - Add a dismissible, versioned onboarding introduction

- User requested a compact centered animated introduction with an X to skip, kept
  current when new features are added. Inspected current App, styles, and project
  instructions, then added `Onboarding.tsx` and centralized guide content/version.
- Seven short steps explain source versus engine, the finite synthetic replay,
  API setup, physical reset, start/stop/kill, markers, paper fills, and timing limits.
  The introduction never changes settings, starts a run, or sends hardware commands.
- Native modal dialog provides background inertness and focus containment; added
  X/Skip/Escape dismissal, Back/Next and step navigation, manual top-bar reopening,
  responsive sizing, gentle entrance/step/diagram animation, reduced-motion support,
  scroll locking, and local versioned dismissal with blocked-storage fallback.
- Added three preference tests for first visit/dismissal, revised versions, and
  unavailable storage. Frontend suite now has six passing tests; production build
  passes. No runtime/backend/RTL changes were needed. Browser visual verification
  remains unperformed under the previously saved browser-origin access denial.
- Updated README and AGENTS.md to require future user-facing features to update
  the guide and bump its version when appropriate. Existing live servers can serve
  the frontend update without restarting or modifying any active run.
- Committing the component/styling, preference tests, and documentation/log updates
  in focused groups, then publishing to the established GitHub origin.

## 2026-10-20 - Configure and verify local Alpaca credentials

- User supplied Alpaca key ID in an image and secret in text and requested local
  configuration. Confirmed `backend/.env` is Git-ignored before writing it.
- Saved credentials only to that ignored file; did not copy values to frontend,
  logs, documentation, or tracked files. Never printed credential values.
- Verified a data-only HTTPS request for latest IEX trades returned HTTP 200 for
  AAPL, NVDA, and TSLA. The running backend also reports configured=true.
- No brokerage order/account endpoint was called, no dashboard run was started,
  and no physical FPGA packets were sent. Market-data authentication is now
  verified; live-stream/historical acceptance is separate from this setup check.

## 2026-10-20 - Explain live and historical paper-simulation workflows

- User requested separate live-data and historical-data instructions, including
  continuing the reversible $10,000 investment simulation.
- Clarified that both workflows already use the local $10,000 paper ledger; the
  application does not submit orders to Alpaca's paper broker or a real account.
  Generated demo prices provide the continuous offline alternative.
- Explained source selection, independent Python/FPGA engine choice, historical
  download/dataset selection, finite replay, normal stop versus latched kill,
  fresh-run portfolio reset, and physical S2 reset before new FPGA runs.
- No credentials, runtime controls, portfolio state, or hardware state were changed.

## 2026-10-20 - Explain Alpaca live versus paper brokerage capability

- Checked official Alpaca documentation: Alpaca supports both real-money live
  brokerage trading and paper trading, with separate endpoint/credential contexts.
- Distinguished those provider capabilities from NanoQuant, which currently reads
  market data and runs a local virtual ledger without submitting broker orders.
- No account, credential, trading-mode, or execution changes were made.

## 2026-10-20 - Refresh historical-download availability after credential setup

- User reported a disabled NVDA history button. The running backend reported
  provider configured=true, completed simulation replay, and no owner. Browser
  setup state could remain false after credentials were added while the page was open.
- Added lightweight provider-status refresh every 15 seconds and on window focus,
  with unmount cleanup. Added visible download-disable reasons and backend-connection
  gating; retained manual refresh. Updated the introduction's API setup guidance.
- During the task, user asked whether Alpaca balance resets before each trade.
  Clarified that `PaperPortfolio` initializes local virtual cash once per run;
  trades accumulate cash/position/P&L changes, with no Alpaca balance-setting call.
- A Windows-default decoding error interrupted an onboarding text update; reran
  with explicit UTF-8. Frontend's six tests pass and production build passes.
  No broker account, active run, hardware packet, or credentials were modified.

## 2026-10-21 - Plan a strategy-authoring and research workspace

- User asked conceptually how to author/test/save strategies with autosave and
  whether this reflects quantitative research work. No implementation requested.
- Clarified current fixed-anchor threshold: five normalized ticks is approximately
  five basis points (0.05%), not five dollars or a drop from the preceding sample.
- Proposed a shared strategy interface, versioned JSON rule files, Python-first
  backtests, experiment snapshots, backend file persistence with atomic writes,
  browser recovery drafts, and separate hardware capability checks.
- Explained hypothesis-driven testing, unseen validation data, costs, execution
  timing, and reproducibility using QuantConnect's official research guide.
- Emphasized the existing FPGA cannot execute arbitrary strategy files; changes
  need compatible hardware configuration/protocol support or new RTL/bitstreams.
- No application, account, hardware, or strategy behavior was modified.

## 2026-10-21 - Scope Alpaca-account execution setting

- User requested an optional account-backed execution setting using the balance
  shown on Alpaca, with orders/balance visible on its website.
- Inspected current run configuration and data-only client, and checked official
  Alpaca paper/account/order documentation. Alpaca paper uses virtual funds and
  persists account state between runs; it is separate from the local $10,000 ledger.
- Asked the user to confirm paper-only versus actual real-money brokerage because
  account-backed order submission materially changes the current data-only scope.
- No broker account queries, orders, account resets, configuration changes, or
  source implementation were performed pending that scope clarification.

## 2026-10-21 - Implement explicitly confirmed Alpaca PAPER account execution

- User confirmed PAPER only and asked about backend-to-FPGA strategy deployment
  and the proposed research workflow. Explained parameter-register configuration
  versus new FPGA algorithms, and clarified the strategy workspace was proposed
  rather than already implemented. No strategy editor/deployment is claimed.
- Added a fixed paper-host-only adapter, read-only balance endpoint, live-source
  and explicit order-consent gating, persistent broker balance/holding display,
  and separate local $10,000 execution. Existing paper account is never reset.
- Added cash-sized whole-share bounded DAY limits, up to 20 shares/order and
  100 held shares, including existing fractional-position room. Shorting/margin
  sizing, generated/historical broker execution, closed-session order queues,
  and existing open orders for the selected stock are rejected.
- Single POSTs have unique run/sequence client IDs and fsynced local intent logs.
  Partial/pending orders are polled to terminal status; stop/kill/time limit cancels
  only the run's own order and reconciles outcome. Unknown POST outcomes are looked
  up by GET, never automatically resent. Unresolved outcomes require Alpaca review.
- Added portfolio selector, explicit simulated-order authorization, read-balance
  button, broker-aware portfolio panel, five-second-minimum pacing notice, updated
  versioned introduction, README, and detailed docs/alpaca-paper.md.
- Verification: 50 existing backend tests plus nine new broker tests passed;
  all 15 Python/RTL tests passed without skips; six frontend tests and production
  build passed. Broker tests cover host restriction, sizing, fractional room,
  uncertainty/no retry, cancellation, consent/source gating, and controller routing.
- A read-only actual PAPER account check confirmed access and cash/equity fields.
  No orders were submitted to the user's account. Broker lifecycle tests are mocked;
  live provider fill/cancel acceptance and browser visual QA are not claimed.
- Confirmed no active backend owner before replacing the old interactive backend
  to serve new code. Local simulator remains the default; no run was started.
- Committing and publishing in focused adapter/test, controller/API, frontend,
  documentation, and validation-log groups. No credential values or account data
  were written to tracked files; local order journals remain ignored.

### 2026-10-21 � Strategy research workspace

- Implemented the authorized first strategy milestone: declarative fixed-anchor
  and prior-sample SMA reversion templates, hypothesis editing, bounded custom
  thresholds/order sizes/position limits, JSON import/export, and library files.
- Added 800 ms autosave, optimistic revision checks, atomic fsynced disk writes,
  previous-revision backups/restore, browser draft recovery, and frozen snapshots.
- Added development/validation backtests with chronological 70/30 split,
  next-sample fills, fees/slippage, equity curves, drawdown, buy-and-hold comparison,
  immutable result JSON, and history. No arbitrary Python code is executed.
- Frozen strategies can drive Python local or explicitly authorized live Alpaca
  PAPER runs. Custom limits apply to local and broker holdings. No real-money
  host is supported; no broker orders were submitted in this task.
- Original FPGA rules remain the only supported hardware configuration; reject
  incompatible strategies before opening UART. No RTL/constraints/bitstream changed.
- Updated risk labels/reconnect metadata, introduction version and research workflow
  documentation. Research data remains ignored under backend/data/research.
- Validation: 66 backend tests, six frontend tests, frontend production build passed.
  First original-suite run skipped nine HDL tests because Icarus was absent from
  terminal PATH; activated tools/activate.ps1 and all 15 original tests passed.
  Backend tests report the existing Starlette/httpx deprecation warning.
- Confirmed existing backend idle with no owner. Automatic policy review rejected
  the restart command before execution; did not bypass it. User must manually
  restart backend to load routes. Browser visual QA remains unverified due saved
  browser access policy. No new physical FPGA acceptance test was performed.
- Delivered meaningful commits for persistence, API/backtests, paper risk limits,
  workspace UI, regression tests, reconnect metadata, docs/guide, and this log;
  publishing to main. Strategy upload to FPGA remains a later milestone.

### 2026-10-24 — Rename before LinkedIn post

- User requires renaming NanoQuant before preparing/publishing its LinkedIn post.
  Treat the rename as a prerequisite when helping with that post; remind the user
  if they request it before the rename is complete. New name is not selected yet.
- Recorded preference only; no application changes or tests needed. This does not
  provide control over posts the user makes independently outside this chat.

### 2026-10-31 — Rename project to Signum

- User selected Signum and will rename the GitHub repository separately. Renamed
  dashboard branding, favicon, page/API titles, export names, frontend package,
  Python package/commands/imports, Gowin project, RTL module/file identifiers,
  build artifacts, tests, active documentation, and terminal activation message.
- Updated introduction and version. Retained old browser storage keys to preserve
  draft recovery and dismissal storage; no saved research, credentials, or account
  files changed. Preserved historical journal/validation records and log history.
- Verified RTL content differs only by replacing module identifiers. Wire format
  and trading logic unchanged; existing flashed hardware stays compatible.
- Validation: 66 backend tests, six frontend tests, 15 original Python/RTL tests
  all passed; production frontend build and renamed CLI help commands passed.
  Existing Starlette/httpx deprecation warning persists. No hardware commands,
  broker orders, server restarts, or browser visual verification performed.
- Recorded completion of rename prerequisite for LinkedIn post. User controls
  GitHub repository rename; local folder and origin URL retain current names.
- Committed source rename separately from documentation/log, publishing to current
  main remote. After repository rename, origin can be updated to the actual new URL.

### 2026-10-31 — Evaluate Signum for a LinkedIn post

- Searched public LinkedIn posts/profiles explicitly identifying second-year CE
  or adjacent EE students. Examples ranged from first FPGA programs and traffic
  controllers to pipelined processors, hardware verification, and robotic systems.
- Assessment: Signum merits a project/learning post for integration and verified
  hardware communication. Public search is selected and incomplete; no percentile
  ranking or claim of superiority over typical students is justified.
- Identified limits: simple fixed hardware strategy, no demonstrated end-to-end
  FPGA speed advantage over Python, custom strategies remain Python-only, and
  broker paper execution is not directly performed by FPGA. Recommend a fresh
  demonstrable run and concrete debugging/learning details before posting.
- Research/advice only; no source change, tests, LinkedIn publication, commit or
  push performed. Appended log locally per repository instructions.

### 2026-10-31 — Backend-configurable FPGA strategies

- Implemented user request to deploy supported frozen strategy settings over UART:
  configurable anchor rule plus on-FPGA prior-sample SMA reversion, windows
  2/4/8/16/32/64. Python retains other windows. Hardware bounds: threshold 1-500,
  max order 1-20, absolute position 1-100. No arbitrary strategy code is uploaded.
- Added version-2 CRC-protected atomic settings request, token/readback ACK and
  rejection reply. Configuration locks after a valid setup or first quote until
  physical reset. Invalid/mid-run configuration cannot alter state or clear kill.
  Kept v1 quote/reply layouts and default CLI compatibility; separate v2 version
  preserves old reserved-flag rejection. Config does not pulse trade LEDs.
- Added bounded ring buffer/running sum in RTL; warmup HOLD and unsigned-price
  extremes match Python. Narrowed position/order datapath within enforced bounds.
- Backend configures every FPGA run before prices, verifies exact readback, then
  uses the selected frozen Python reference for every reply. Failure invalidates
  session, releases port, surfaces error, and sends no retry/quotes. The 2 ms
  transaction pause remains. Settings status and counters stream to dashboard.
- Recomputed compatibility for existing strategy files/snapshots; updated strategy
  UI labels, reset/firmware notice, versioned introduction, README and detailed
  protocol/programming/acceptance instructions in docs/fpga-configuration.md.
- Validation: 76 backend tests, 17 original/extended Python/RTL tests, six frontend
  tests and frontend production build passed (99 tests total). Added hardware
  equivalence for all supported SMA windows, wraparound, clipping, extrema, kill,
  rejected/locked settings; transport tests cover timeout, disconnect, legacy ACK,
  CRC/token/readback failure and no retry/trade on failed configuration.
- Material troubleshooting: first parser reused v1 reserved flag and broke a
  corruption regression; isolated setup to v2 and restored passing behavior.
  Initial frontend edit script hit Windows default text encoding; reran UTF-8.
  Initial route missed timing at 25.58 MHz; bounded arithmetic revision passed at
  post-route estimated 30.16 MHz against 27 MHz. Structural check zero problems,
  2179 LUT4, 665 DFF, one BSRAM. Tool-library/ABC warnings and existing Starlette
  httpx deprecation remain; no assertion of warning-free synthesis.
- Built fresh ignored build/signum.fs. No physical programming, UART acceptance,
  broker orders, backend restart or browser visual QA performed. User must flash
  the new bitstream and reset S2 before using dashboard FPGA configuration.
  Old firmware safely times out before quotes. Timing is estimated, not measured.
- Publishing focused hardware/protocol, backend/transport/tests, dashboard/guide,
  and documentation/log commits. GitHub repository rename remains user-managed.

### 2026-10-31 — Physical configurable FPGA acceptance via restarted backend

- User requested backend restart and physical verification, then confirmed new
  firmware flashed, S2 reset, and board ready. No backend listener existed on
  port 8000; launched fresh hidden uvicorn process with ignored local logs.
- Confirmed COM6 USB VID/PID 0403:6010. Used actual backend REST/WebSocket path
  with Generated prices and Local $10,000; no Alpaca orders or account calls.
- Created a clearly named local acceptance strategy and frozen snapshot: SMA16,
  threshold 5, max order 3, position cap 8. Hardware v2 settings ACK readback
  matched. 65 physical quote responses all matched the Python reference;
  first 16 held for warmup. Decisions: 15 BUY, 16 SELL, 33 HOLD (including kill).
  Largest absolute order 3; observed largest absolute position 6 (cap 8 was
  respected but its clipping boundary was not reached in this physical run).
- Kill acknowledged. 66/66 UART replies validated including configuration;
  zero CRC/header/timeout/sequence/reference/transport errors. Port closed and
  ownership released at end. Board is kill-latched and requires S2 reset before
  another run. Backend remains running for dashboard use.
- Measured host RTT mean 4.2875 ms, range 4.1977-5.1801 ms, p95 4.4180 ms for
  65 quotes. Includes UART/USB/host overhead; no isolated physical engine latency
  measured. No claim that other windows were physically tested.
- Raw telemetry/report and acceptance helper stored locally in ignored
  backend/data. Recorded measured acceptance in docs; no RTL/source changes.

### 2026-10-31 — Explain Tang Nano 9K resources

- Verified Sipeed specifications: 8640 LUT4, 6480 flip-flops and 468 Kbit block SRAM. Explained logic capacity versus register/block-memory storage, and related the existing Signum build usage (2179 LUT4, 665 DFF, one BSRAM) to these separate budgets. Conceptual explanation only; no source changes, tests, commit or push.

### 2026-10-31 — Clarify Nexys board LUT counts

- Checked Digilent Nexys A7 reference manual for 100T/50T variants (63400/32600 LUTs). User said Nexys 6, so exact board remains uncertain; answer conditional on A7 and request model confirmation. Explain LUT6 versus Tang LUT4 counts are not directly equivalent. No source changes, tests, commit or push.

### 2026-10-31 — Launch services and provide hands-on learning lab

- User requested both services and guided experiments. Confirmed backend port
  8000 already running, no active owner, previous hardware test state killed.
  Frontend port 5173 had no listener. Automatic policy review rejected frontend
  Start-Process launch; did not retry through an alternative launch mechanism.
  User must run npm run dev in frontend. Backend required no restart.
- Read actual controls and listed local datasets: NVDA 1959 one-minute bars,
  AAPL 416 five-minute bars, plus synthetic 12-sample DEMO. Added reusable
  docs/hands-on-lab.md with prediction, controlled strategy comparisons, SMA
  warmup, costs/validation, historical replay, physical configuration/kill,
  and recovery/export exercises. Distinguished ledger vs engine, local vs
  broker paper execution, and current-mark vs next-sample fill assumptions.
- No runs started, orders sent or hardware reset performed. No new tests needed
  for instructions; browser QA not performed. Prior board remains kill-latched;
  instruct S2 before hardware exercise. Recording and publishing documentation.

### 2026-10-31 — Independent public browser demo for Vercel

- User selected independent virtual portfolios without Alpaca accounts and
  authorized implementation/deployment. Added separate demo build entry; local
  Python/FPGA frontend remains default dev/build. No backend/RTL changes.
- Public demo runs strategy engine, $10,000 long-only ledger, generated prices,
  synthetic 480-sample replay, historical CSV import, charts/markers, capped
  decisions, stop/kill, run export and 70/30 next-sample backtests in browser.
- Browser-local draft autosave preserves incomplete edits; validated strategy
  import/export and frozen result export include settings/costs/phase/dataset.
  Portfolios are per-tab/run; no shared funds, accounts, broker or UART access.
  CSV files remain local and require reimport after reload. Bundled replay is
  clearly synthetic; no private/account-derived history was published.
- Reused chart/portfolio styling and added responsive public layout, browser
  provenance, hardware results explicitly recorded rather than live, source/setup
  links, public introduction steps, static Vercel config and usage documentation.
- Verification: 17 frontend tests passed, including Python-generated decision/
  ledger parity fixtures, SMA warmup, run isolation, kill, long-only/cash clipping,
  ordered/timezoned CSV, costs/next-sample fills, reproducibility, validation split,
  JSON validation and blocked/corrupt storage. Found and fixed signed-zero and
  half-cent floating rounding differences; browser accounting remains approximate.
  Both local and public production builds passed. Static demo bundle check found
  no local App chunk, backend API paths, WebSocket creation or broker API host.
- Vercel required team access; user approved native consent link. Project creation
  returned schema mismatch/unknown outcome; verified via project listing instead
  of repeating the write. Project exists as signum linked to GitHub Signum; set
  frontend root, npm ci, build:demo, dist, and public access. No credentials copied.
- Publishing focused engine/tests and UI/build commits plus documentation/log.
  Deployment status and public HTTP verification will be recorded after Vercel
  finishes. Localhost browser access restrictions were not bypassed; no local
  browser visual QA performed. No FPGA commands or Alpaca orders sent.

### 2026-10-31 — Public demo deployment verified

- Vercel Git production deployment dpl_8AEnSSrpojy6V1JSNF2ATwXBH83t reached READY
  from main commit 4092feb. Public URL https://signum-aayan14.vercel.app/
  (also assigned signum-azure.vercel.app). Verified public HTTP 200, entry assets
  200, and connect-src none header. Added public link to README.
- Git auto-deployment appeared shortly after the initial empty listing. A manual
  deployment for the same SHA had queued; cancelled that duplicate only and
  retained the successful Git-triggered deployment. No other projects changed.
- Verified remote UI through the supported in-app browser (no localhost access
  bypass): introduction close, Start/Stop, populated price chart/BUY/SELL markers,
  virtual ledger updates, SMA16 preset, frozen development backtest (336 samples)
  and recorded-hardware explanation. Inspected desktop screenshot; no browser
  console errors. Left public demo open as deliverable. Mobile CSS implemented
  but no separate mobile screenshot; CSV file chooser/export download not manually
  exercised. Parsing/export data paths have code/unit validation as recorded.
- Vercel build succeeded with npm environment/install-script warnings and one
  audit notice; separate production-only dependency audit reported zero findings.
  No live quotes, personal trading data, credentials, FPGA access or broker orders
  were included. Browser simulation and recorded hardware results clearly differ.
- Three implementation/documentation commits already pushed; this fourth focused
  publication record/link commit completes work. Subsequent main pushes auto-deploy
  the browser-only Vercel build; local dev/build remains Python/FPGA mode.

### 2026-10-31 — Explain public demo chart and duration

- Explained supplied screenshot: generated DEMO prices are synthetic, not a real stock; chart sequence 237–476 displays last 240 of 477 processed samples. Exact elapsed wall time cannot be recovered from screenshot or sample index alone, especially if speed changes. Distinguished signal markers, long-only paper holdings, engine position and artificial-data P&L. Identified missing explicit session duration/source context in UI without claiming implementation. Advice only; no tests, source changes, commit or push.

### 2026-10-31 — Dashboard UI alignment and readability review

- User requested careful review/fix of wonky and offset text. Found double panel
  heading gutters, tiny/non-wrapping typography, overly separated portfolio
  label/value pairs, inherited heading letter spacing on badges, collapsed public
  sidebar links without useful labels, malformed local text encoding, and compact
  Q chart controls. Trading calculations unchanged.
- Standardized public card gutters, form grids, control heights, text hierarchy,
  line heights and responsive wrapping. Shared portfolio now groups label/value
  pairs in a two-column desktop grid and one column on mobile. Split paper shares,
  engine position, fills and fees into explicitly labeled rows. Improved chart
  headings/legend/sample buttons, detail inspector, footer and guide wrapping.
- Public mobile navigation stays visible when sidebar disappears; import controls
  have keyboard-focusable file inputs. Corrected legacy N/NQ branding and mojibake,
  removed stale Python-only SMA label, refreshed guide copy/version/dismissal key.
- Existing 17 frontend tests passed; public and local production builds passed.
  No tests added for reversible typography-only changes. Browser handles initially
  failed with browser.user unavailable; reset documented CUA session and reacquired
  public tab successfully. First combined delete/add patch was rejected without
  writes; applied a direct file edit instead. Console encoding error during a text
  inspection was resolved by emitting escaped JSON; source stayed UTF-8.
- Publishing two focused UI commits and this log; desktop/mobile verification
  against the updated production deployment follows. No broker/hardware actions.

### 2026-10-31 — Beginner-focused replay redesign and section help

- User expanded UI cleanup into a public-demo redesign: simpler language, clear
  purpose, real historical prices, sped-up replay, plus short circled-i help on
  hover. Prior cleanup was physically reviewed at desktop and 390px width with
  zero measured overflow in inspected controls/cards; new redesign supersedes
  its public layout while preserving shared local improvements.
- Rebuilt public page as stock picker + date range, price chart, play/pause/reset
  and 1/5/10/20/50x controls, progress/market date/elapsed playback, adjacent cash/
  shares/value portfolio, plain-language rule editor, completed-trade history,
  optional separate-period tests, and concise explanation/local FPGA links.
- Bundled AAPL/NVDA/MSFT 2017 daily closes, 251 each. Verified publisher metadata
  reports CC0 and version 4; pinned download, checksum, regeneration script and
  provenance documentation committed. No Alpaca data/account credentials used.
  Fictional practice replay remains distinct. Speed explicitly means samples/sec:
  daily data plays trading days per second, not literal live-market acceleration.
- Replay now uses next-sample fills with fees/slippage, matching batch tests.
  Markers/history reflect completed fills, not unfilled engine requests. Pause/
  resume keeps state; reset unlocks settings. Added run guards and warmup message.
- Added reusable fixed-position portaled info tooltips across sections, hover,
  focus, tap, Escape/outside dismissal and viewport clamping. Updated public guide
  and dismissal version. Retained local storage and JSON/CSV workflows.
- 20 frontend tests passed, including dated data/order/period checks and equivalence
  of next-sample replay with batch backtest. Both public and local builds passed.
  A nullable chart coordinate TypeScript failure was corrected. Large shell file
  write was rejected by policy before execution; used purpose-built apply_patch
  for safe direct edits instead. No hardware/broker actions; no RTL changes.
- Publishing focused data, engine/tests, public UI, and documentation/log commits.
  Production desktop/mobile/tooltip/playback verification follows deployment.

### 2026-10-31 — Redesign production acceptance and help interactions

- Vercel production deployment dpl_8CbrDGaJLmdAhboA4ooVLRYzE5h2 reached READY from
  8395297. Reviewed desktop screenshot and 390px mobile viewport on public URL.
- Exercised NVDA three-month replay at 20x: 62/62 samples, ending March 31, 2017,
  completed buy/sell markers and trade history, fees and portfolio changes.
  Replayed at 1x, paused/resumed and paused again at 17/62 with state retained.
  Ran separate last-30% test (19 samples) on mobile; fresh state produced no
  completed trades, consistent with warmup/selected prices, not a fabricated fill.
- Price-data/speed/backtest info popups opened on click; keyboard Enter opened
  help and Escape closed it. Backtest info did not toggle its containing details.
  Mobile popup stayed within viewport; inspected cards/labels/controls measured
  zero overflow at 390px and desktop widths. Reset restored initial portfolio;
  returned viewport to default and selected AAPL/full year/10x, no active run.
- Initial new-page close-guide click timed out during browser load; fresh state
  confirmed loaded dialog and next click worked. Exact-label test selector for
  wrapped select did not match; used non-exact label and verified selection.
- Final usability adjustments: explicit starting/replayed close label, visible
  Help text with matching guide instructions, asynchronous import guard if a
  replay starts while a file is being read. Existing 20 tests passed again;
  final demo build checked. Local build already passed. No hardware/broker actions.
- Pushing final focused acceptance/usability commit and retaining main automatic
  production deployment. Browser no-console-error check and final state follow.
