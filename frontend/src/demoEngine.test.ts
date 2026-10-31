import { describe, expect, it } from 'vitest'
import parity from './demoParity.json'
import { backtest, defaultSpec, DemoEngine, DemoLedger, DemoRun, generator, parseCsv, syntheticReplay, validateDraft, validateSpec } from './demoEngine'
import { readLocal, writeLocal } from './demoStorage'

describe('browser simulator matches existing Python rules and ledger',()=>{
  for(const fixture of parity)it(`${fixture.spec.kind}, threshold ${fixture.spec.threshold_ticks}, cap ${fixture.spec.max_order}`,()=>{
    const engine=new DemoEngine(validateSpec(fixture.spec)),ledger=new DemoLedger(1,fixture.spec.position_limit),next=generator()
    for(const row of fixture.rows){
      const sample=next();expect(Math.round(sample.price*100)).toBe(row.price);expect(sample.quantity).toBe(row.quantity)
      const result=engine.step(row.price,row.quantity);expect(result.order).toBe(row.order);expect(result.position).toBe(row.position)
      const paper=ledger.apply(result.order,row.price/100)
      for(const key of ['cash','equity','fees','position','filled_order','total_pnl','realized_pnl','unrealized_pnl'] as const) expect(paper[key]).toBeCloseTo(row.paper[key],2)
    }
  })
  it('keeps visitors/runs independent and latches kill',()=>{
    const a=new DemoRun(defaultSpec,1,'a','generated'),b=new DemoRun(defaultSpec,1,'b','generated')
    const sample={timestamp:new Date().toISOString(),price:99.9,quantity:20}
    expect(a.tick(sample).order).toBe(20);expect(b.engine.position).toBe(0);expect(b.ledger.cash).toBe(10000)
    expect(a.tick(sample,true).order).toBe(0);expect(a.tick(sample).killed).toBe(true)
    expect(b.tick(sample).order).toBe(20)
  })
  it('never fabricates FPGA or Python latency',()=>{
    const row=new DemoRun(defaultSpec,1,'a','generated').tick(generator()())
    expect(row.host_round_trip_us).toBeNull();expect(row.engine_cycles).toBeNull();expect(row.python_compute_us).toBeNull();expect(row.browser_compute_us).toBeGreaterThanOrEqual(0)
  })
  it('uses previous samples and waits for warmup',()=>{
    const e=new DemoEngine({...defaultSpec,kind:'sma_reversion',window:2,max_order:3})
    expect(e.step(10000,20).order).toBe(0);expect(e.step(10000,20).order).toBe(0);expect(e.step(9990,20).order).toBe(3)
  })
  it('clips long-only fills, cash and position independently',()=>{
    const ledger=new DemoLedger(0,3)
    expect(ledger.apply(-20,100).filled_order).toBe(0)
    expect(ledger.apply(20,100).filled_order).toBe(3)
    expect(ledger.apply(20,100).filled_order).toBe(0)
    expect(ledger.apply(-20,110).position).toBe(0)
    const expensive=new DemoLedger(100,100)
    expect(expensive.apply(20,10000).filled_order).toBe(0)
  })
})
describe('replay, research and persistence',()=>{
  it('rejects malformed, out-of-order and timezone-free CSV without executing it',()=>{
    for(const text of ['price\n1','timestamp,price\n2026-01-01,5\n2026-01-02,5\n2026-01-03,5\n2026-01-04,5','timestamp,price\n2026-01-01T00:00:00Z,5\n2026-01-01T00:00:00Z,5\n2026-01-03T00:00:00Z,5\n2026-01-04T00:00:00Z,5'])expect(()=>parseCsv(text)).toThrow()
    const rows=parseCsv('timestamp,price\n2026-01-01T00:00:00Z,100\n2026-01-02T00:00:00Z,99\n2026-01-03T00:00:00Z,101\n2026-01-04T00:00:00Z,100')
    expect(rows).toHaveLength(4);expect(rows[0].quantity).toBe(20)
  })
  it('repeats frozen backtests and separates chronological periods',()=>{
    const data=syntheticReplay(),a=backtest(defaultSpec,data,'development',1,2)
    expect(backtest(defaultSpec,data,'development',1,2)).toEqual(a)
    const b=backtest(defaultSpec,data,'validation',1,2)
    expect(Date.parse(a.end)).toBeLessThan(Date.parse(b.start));expect(a.count+b.count).toBe(data.length)
    expect(a.fills).toBeGreaterThan(0)
  })
  it('fills a signal only on the following sample and leaves the last unfilled',()=>{
    const data=Array.from({length:10},(_,i)=>({timestamp:new Date(Date.UTC(2026,0,1,0,i)).toISOString(),price:i===0?100:99,quantity:1}))
    const a=backtest(defaultSpec,data,'development',0,0)
    expect(a.curve[0]).toBe(10000);expect(a.curve[1]).toBe(10000);expect(a.fills).toBe(5);expect(a.unfilled).toBe(1)
  })
  it('validates imports and gracefully handles blocked/corrupt browser storage',()=>{
    expect(()=>validateSpec({...defaultSpec,code:'execute'})).toThrow();expect(()=>validateSpec({...defaultSpec,window:0})).toThrow()
    const blocked={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}}
    expect(readLocal('x',defaultSpec,validateSpec,blocked)).toEqual(defaultSpec);expect(writeLocal('x',defaultSpec,blocked)).toBe(false)
    expect(readLocal('x',defaultSpec,validateSpec,{getItem:()=>'{',setItem:()=>{}})).toEqual(defaultSpec)
    const data=new Map<string,string>(),store={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}}
    expect(writeLocal('x',defaultSpec,store)).toBe(true);expect(readLocal('x',null,validateSpec,store)).toEqual(defaultSpec)
    const draft={...defaultSpec,name:'',window:0}
    writeLocal('draft',draft,store)
    expect(readLocal('draft',defaultSpec,validateDraft,store)).toEqual(draft)
    expect(()=>validateSpec(draft)).toThrow()
  })
})
