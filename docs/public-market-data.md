# Public replay data

The public demo bundles 251 daily closing prices per stock (AAPL, NVDA, MSFT),
January 3–December 29, 2017, from Cam Nugent’s **S&P 500 stock data**, version 4.

- Dataset: https://www.kaggle.com/datasets/camnugent/sandp500
- Source metadata API: https://www.kaggle.com/api/v1/datasets/view/camnugent/sandp500
- Pinned download: https://www.kaggle.com/api/v1/datasets/download/camnugent/sandp500?datasetVersionNumber=4
- Publisher license: **CC0: Public Domain** (verified in metadata October 31, 2026).
- The committed JSON records source URL, license, download URL and archive SHA256.

Regenerate with `python tools/prepare_public_history.py` from repository root.
Only selected close prices/date labels are bundled; original downloads and
credentials are not deployed. Requests go to Kaggle only during preparation,
not from visitors’ browsers. The source archive is not committed.

These values are as supplied by the 2018 publication. Do not compare them
uncritically with modern split-adjusted quote charts. Dividends, corporate-action
accounting, order books, liquidity, exchange fills and intra-day movement are not
modeled. Timestamp UTC midnight represents the source date, not an actual trade
execution timestamp. Historical volume is not used as an order; each sample
carries a teaching quantity of 20, further capped by rule and cash/share limits.

A separate 480-sample synthetic practice series is explicitly labeled fictional.
Imported CSV is user-supplied and stays in the tab. The bundled historical series
and local FPGA/Alpaca data paths remain separate.
