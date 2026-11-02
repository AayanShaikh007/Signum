import type { DemoSpec } from './demoEngine'

// Curated after inspecting the bundled 2017 histories, not an out-of-sample result.
export const defaultDemoStock='NVDA'
export const defaultDemoRule:Readonly<DemoSpec>=Object.freeze({
  schema_version:1,name:'SMA16 example',
  hypothesis:'Explore buying below the previous 16-price average and selling above it. The Nvidia 2017 example was selected after reviewing historical results; this is not an unseen test.',
  kind:'sma_reversion',window:16,threshold_ticks:5,max_order:20,position_limit:100,
})
