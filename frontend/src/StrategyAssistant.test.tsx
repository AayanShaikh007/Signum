import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StrategyDraftReview, type Draft } from './StrategyAssistant'

const hypothesis='After the first 15 minutes, trade an opening-range breakout.'
function fixture(supported:boolean):Draft {
  return {id:'test',created_at:'2026-11-17',deployment:'test',fpga_supported:supported,limits:'Metadata only',sources:[],
    proposal:{supported,explanation:'Needs opening-range tracking and timed exits',
      spec:{schema_version:1,name:'Test',hypothesis,kind:'anchor',threshold_ticks:100,window:2,max_order:20,position_limit:100},
      evidence:[],parameter_reasoning:'Placeholder values',risks:[]}}
}
function render(draft:Draft,current=hypothesis,disabled=false) {
  return renderToStaticMarkup(<StrategyDraftReview draft={draft} hypothesis={current} disabled={disabled}
    onApply={()=>{}} onTest={async()=>{}} onPrepare={async()=>{}} onExport={()=>{}}/>)
}
describe('AI draft review',()=>{
  it('explains unsupported execution, hides placeholders and disables all execution actions',()=>{
    const html=render(fixture(false))
    expect(html).toContain('current Python and FPGA engines do not implement')
    expect(html).not.toContain('ai-settings')
    expect(html).not.toContain('Placeholder values')
    expect(html).not.toContain('may require Python')
    expect(html.match(/disabled=""/g)).toHaveLength(3)
    expect(html).toContain('aria-describedby=')
  })
  it('shows supported settings and enables apply after saving',()=>{
    const html=render(fixture(true))
    expect(html).toContain('ai-settings')
    expect(html).not.toContain('disabled=""')
    expect(html).toContain('Apply &amp; prepare run')
    expect(html.indexOf('Apply &amp; prepare run')).toBeLessThan(html.indexOf('Research sources'))
  })
  it('blocks stale hypotheses and active operations',()=>{
    expect(render(fixture(true),'Changed idea')).toContain('Hypothesis changed')
    expect(render(fixture(true),hypothesis,true).match(/disabled=""/g)).toHaveLength(3)
  })
})
