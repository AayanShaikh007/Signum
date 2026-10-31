import type { Paper, Telemetry } from './types'

export interface DemoSpec { schema_version:1; name:string; hypothesis:string; kind:'anchor'|'sma_reversion'; threshold_ticks:number; window:number; max_order:number; position_limit:number }
export interface Sample { timestamp:string; price:number; quantity:number }
export const defaultSpec:DemoSpec={schema_version:1,name:'Original anchor',hypothesis:'Explore whether departures from a reference reverse.',kind:'anchor',threshold_ticks:5,window:16,max_order:20,position_limit:100}
export function validateDraft(value:unknown):DemoSpec {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid draft')
  const spec=value as DemoSpec
  if(spec.schema_version!==1||typeof spec.name!=='string'||spec.name.length>100||typeof spec.hypothesis!=='string'||spec.hypothesis.length>5000||!['anchor','sma_reversion'].includes(spec.kind))throw new Error('Invalid draft')
  for(const key of ['window','threshold_ticks','max_order','position_limit'] as const)if(!Number.isFinite(spec[key])||Math.abs(spec[key])>1_000_000)throw new Error('Invalid draft')
  return {...defaultSpec,...spec}
}
export function validateSpec(value:unknown):DemoSpec {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Import a strategy JSON object.')
  const spec=value as Record<string,unknown>
  const allowed=Object.keys(defaultSpec)
  if(Object.keys(spec).some(key=>!allowed.includes(key))) throw new Error('Unknown strategy fields. Export a declarative .strategy.json file.')
  const result={...defaultSpec,...spec} as DemoSpec
  if(result.schema_version!==1 || !['anchor','sma_reversion'].includes(result.kind) || typeof result.name!=='string' || !result.name.trim() || result.name.length>100 || typeof result.hypothesis!=='string' || result.hypothesis.length>5000) throw new Error('Invalid strategy name, template or hypothesis.')
  for(const [key,min,max] of [['threshold_ticks',1,500],['window',2,500],['max_order',1,20],['position_limit',1,100]] as const) {
    if(!Number.isInteger(result[key]) || result[key]<min || result[key]>max) throw new Error(`${key} must be an integer between ${min} and ${max}.`)
  }
  return result
}
export class DemoEngine {
  position=0; killed=false; history:number[]=[]
  constructor(readonly spec:DemoSpec) { validateSpec(spec) }
  step(price:number,quantity:number,kill=false) {
    const before=this.position
    this.killed ||= kill
    const ready=this.spec.kind==='anchor' || this.history.length===this.spec.window
    const fair=this.spec.kind==='anchor'?10000:Math.floor(this.history.reduce((a,b)=>a+b,0)/this.history.length)
    let order=0
    if(ready && !this.killed) {
      const delta=fair-price
      const direction=delta>=this.spec.threshold_ticks?1:delta<=-this.spec.threshold_ticks?-1:0
      const room=direction===1?this.spec.position_limit-this.position:this.spec.position_limit+this.position
      order=direction*Math.min(quantity,this.spec.max_order,room) || 0
    }
    this.position+=order
    this.history.push(price);if(this.history.length>this.spec.window)this.history.shift()
    return {order,position:this.position,before,killed:this.killed}
  }
}
const cents=(value:number)=>Math.sign(value)*Math.round(Math.abs(value)*100+1e-7)/100 || 0
export class DemoLedger {
  cash=10000; position=0; average=0; realized=0; fees=0; fills=0
  constructor(readonly feeBps=1,readonly limit=100) {
    if(!Number.isFinite(feeBps)||feeBps<0||feeBps>100)throw new Error('Fees must be 0–100 bps.')
  }
  apply(order:number,price:number,mark=price):Paper {
    const rate=this.feeBps/10000
    let filled=order>0?Math.min(order,Math.floor((this.cash+1e-8)/(price*(1+rate))),Math.max(0,this.limit-this.position)):-Math.min(-order,this.position)
    filled=filled || 0
    const quantity=Math.abs(filled),gross=quantity*price,fee=gross*rate
    if(filled>0) { this.average=(this.average*this.position+gross)/(this.position+quantity);this.position+=quantity;this.cash-=gross+fee }
    if(filled<0) { this.realized+=gross-this.average*quantity;this.position-=quantity;this.cash+=gross-fee;if(!this.position)this.average=0 }
    this.realized-=fee;this.fees+=fee;this.fills+=Number(filled!==0)
    return {starting_cash:10000,cash:cents(this.cash),position:this.position,average_cost:cents(this.average),market_value:cents(mark*this.position),equity:cents(this.cash+mark*this.position),realized_pnl:cents(this.realized),unrealized_pnl:cents((mark-this.average)*this.position),total_pnl:cents(this.cash+mark*this.position-10000),fees:cents(this.fees),filled_order:filled,unfilled_units:Math.abs(order)-quantity,fill_count:this.fills,policy:'Browser-only long-only cash simulation; approximate floating-point accounting'}
  }
}
export function generator(seed=1) {
  let state=seed>>>0
  return ()=> { state=(Math.imul(1664525,state)+1013904223)>>>0;const ticks=10000+state%41-20;state=(Math.imul(1664525,state)+1013904223)>>>0;return {timestamp:new Date().toISOString(),price:ticks/100,quantity:state%41} }
}
// Explicit synthetic replay, not an actual stock or a live market feed.
export function syntheticReplay():Sample[] {
  const next=generator(7)
  return Array.from({length:480},(_,i)=>({timestamp:new Date(Date.UTC(2026,9,19,13,30+i)).toISOString(),price:Math.round((100+Math.sin(i/13)*1.2+Math.sin(i/47)*2+(next().price-100))*100)/100,quantity:20}))
}
export function parseCsv(text:string):Sample[] {
  if(text.length>2_000_000)throw new Error('CSV must be under 2 MB.')
  const lines=text.trim().replace(/^\uFEFF/,'').split(/\r?\n/)
  const headers=lines.shift()?.toLowerCase().split(',').map(v=>v.trim())??[]
  const ti=headers.indexOf('timestamp'),pi=headers.indexOf('price'),qi=headers.indexOf('quantity')
  if(ti<0||pi<0)throw new Error('CSV headers: timestamp,price,quantity (quantity optional). Use ISO timestamps with timezone and plain comma-separated values.')
  if(lines.length<4||lines.length>10000)throw new Error('Import 4–10,000 ordered rows.')
  let previous=-Infinity
  return lines.map((line,index)=> {
    const cells=line.split(',').map(v=>v.trim()),stamp=cells[ti],time=Date.parse(stamp),price=Number(cells[pi]),quantity=qi<0?20:Number(cells[qi])
    if(!/(Z|[+-]\d\d:\d\d)$/.test(stamp)||!Number.isFinite(time)||time<=previous||!Number.isFinite(price)||price<=0||price>1_000_000||!Number.isInteger(quantity)||quantity<0||quantity>65535)throw new Error(`Invalid timestamp, price or quantity on data row ${index+1}.`)
    previous=time
    return {timestamp:new Date(time).toISOString(),price,quantity}
  })
}
export class DemoRun {
  engine:DemoEngine;ledger:DemoLedger;index=0;anchor:number|null=null
  constructor(readonly spec:DemoSpec,readonly fees:number,readonly id:string,readonly source:'generated'|'synthetic'|'imported') {this.engine=new DemoEngine({...spec});this.ledger=new DemoLedger(fees,spec.position_limit)}
  tick(sample:Sample,kill=false):Telemetry {
    this.anchor??=this.source==='generated'?100:sample.price
    const price=normalizedTicks(sample.price,this.anchor)
    const before=performance.now(),result=this.engine.step(price,sample.quantity,kill),compute=(performance.now()-before)*1000
    return {type:'telemetry',run_id:this.id,timestamp:new Date().toISOString(),mode:'simulation',sequence:this.index++,price,quantity:sample.quantity,...result,decision:result.killed?'KILL':result.order>0?'BUY':result.order<0?'SELL':'HOLD',validation_status:'reference',host_round_trip_us:null,python_compute_us:null,engine_cycles:null,estimated_engine_ns:null,symbol:this.source==='imported'?'CSV':'DEMO',data_source:this.source==='generated'?'generated':this.source==='synthetic'?'synthetic_fixture':'browser_csv',market_timestamp:sample.timestamp,price_usd:sample.price,anchor_usd:this.anchor,paper:this.ledger.apply(result.order,sample.price),risk_checks:{max_order:this.spec.max_order,position_limit:this.spec.position_limit,position_before:result.before,position_after:result.position,order_within_limit:Math.abs(result.order)<=this.spec.max_order,position_within_limit:Math.abs(result.position)<=this.spec.position_limit},browser_compute_us:compute}
  }
}
function normalizedTicks(price:number,anchor:number) {
  const ticks=Math.round(price/anchor*10000)
  if(!Number.isSafeInteger(ticks)||ticks<0||ticks>0xffffffff)throw new Error('Normalized price exceeds supported range.')
  return ticks
}
export interface BacktestResult {finalEquity:number;pnl:number;fees:number;fills:number;maxDrawdown:number;start:string;end:string;count:number;curve:number[];unfilled:number}
export function backtest(spec:DemoSpec,samples:Sample[],phase:'development'|'validation',fees:number,slippage:number):BacktestResult {
  if(samples.length<8||!Number.isFinite(slippage)||slippage<0||slippage>100)throw new Error('Backtests need 8+ samples and slippage 0–100 bps.')
  const split=Math.floor(samples.length*.7),selected=phase==='development'?samples.slice(0,split):samples.slice(split)
  const engine=new DemoEngine(spec),ledger=new DemoLedger(fees,spec.position_limit),anchor=selected[0].price
  let pending=0,peak=10000,drawdown=0,paper=ledger.apply(0,anchor)
  const curve:number[]=[]
  for(const sample of selected) {
    const execution=sample.price*(1+(pending>0?1:pending<0?-1:0)*slippage/10000)
    paper=ledger.apply(pending,execution,sample.price)
    peak=Math.max(peak,paper.equity);drawdown=Math.max(drawdown,(peak-paper.equity)/peak*100)
    curve.push(paper.equity)
    pending=engine.step(normalizedTicks(sample.price,anchor),sample.quantity).order
  }
  return {finalEquity:paper.equity,pnl:paper.total_pnl,fees:paper.fees,fills:paper.fill_count,maxDrawdown:drawdown,start:selected[0].timestamp,end:selected.at(-1)!.timestamp,count:selected.length,curve,unfilled:pending}
}
