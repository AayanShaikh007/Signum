import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Activity, Cpu, FlaskConical, Play, Square, Download, CircleHelp, ShieldCheck } from 'lucide-react'
import PaperPanel from './PaperPanel'
import Onboarding from './Onboarding'
import { publicGuideSteps } from './onboardingContent'
import { backtest, defaultSpec, DemoRun, generator, parseCsv, syntheticReplay, validateDraft, validateSpec } from './demoEngine'
import type { BacktestResult, DemoSpec, Sample } from './demoEngine'
import { DEMO_DRAFT, readLocal, writeLocal } from './demoStorage'
import type { Telemetry } from './types'
const Chart=lazy(()=>import('./MarketChart'))
const money=(v:number)=>v.toLocaleString(undefined,{style:'currency',currency:'USD'})
const repo='https://github.com/AayanShaikh007/Signum'
function download(value:unknown,name:string) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a')
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export default function DemoApp() {
  const [spec,setSpec]=useState<DemoSpec>(()=>readLocal(DEMO_DRAFT,defaultSpec,validateDraft))
  const [source,setSource]=useState<'generated'|'synthetic'|'imported'>('generated')
  const [samples,setSamples]=useState<Sample[]>(syntheticReplay)
  const [speed,setSpeed]=useState(5),[fees,setFees]=useState(1),[slippage,setSlippage]=useState(2)
  const [rows,setRows]=useState<Telemetry[]>([]),[running,setRunning]=useState(false),[state,setState]=useState('ready')
  const [error,setError]=useState(''),[saved,setSaved]=useState(''),[phase,setPhase]=useState<'development'|'validation'>('development')
  const [result,setResult]=useState<BacktestResult|null>(null),[testedSpec,setTestedSpec]=useState<DemoSpec|null>(null)
  const [testRequest,setTestRequest]=useState<object|null>(null)
  const [guide,setGuide]=useState(()=>readLocal('signum.public.guide.v2',true,v=>v!==true))
  const current=useRef<{run:DemoRun;next:()=>Sample;index:number;last:Sample|null}|null>(null)
  const latest=rows.at(-1)
  useEffect(()=>{setSaved(writeLocal(DEMO_DRAFT,spec)?'Autosaved in this browser':'Browser storage unavailable — export JSON to keep your work')},[spec])
  function dismiss(){setGuide(false);writeLocal('signum.public.guide.v2',true)}
  function append(row:Telemetry){setRows(old=>[...old,row].slice(-240))}
  function stop(){setRunning(false);setState('stopped')}
  function start(){
    if(running)return
    try {
      const frozen=validateSpec(spec)
      if(!Number.isFinite(fees)||fees<0||fees>100)throw new Error('Fees must be 0–100 bps.')
      current.current={run:new DemoRun({...frozen},fees,crypto.randomUUID(),source),next:generator(),index:0,last:null}
      setRows([]);setError('');setState('running');setRunning(true)
    }catch(e){setError(String(e))}
  }
  useEffect(()=>{
    if(!running)return
    const timer=setInterval(()=>{
      const session=current.current;if(!session)return
      if(source!=='generated'&&session.index>=samples.length){setRunning(false);setState('completed');return}
      try {
        const sample=source==='generated'?session.next():samples[session.index]
        session.last=sample;session.index++;append(session.run.tick(sample))
      }catch(e){setError(String(e));setRunning(false);setState('error')}
    },1000/speed)
    return ()=>clearInterval(timer)
  },[running,speed,source,samples])
  function kill(){
    const session=current.current;if(!running||!session)return
    append(session.run.tick(session.last??{timestamp:new Date().toISOString(),price:100,quantity:0},true));setRunning(false);setState('killed')
  }
  async function importFile(file:File|undefined,csv=false){
    if(!file)return
    try {
      if(file.size>(csv?2_000_000:20_000))throw new Error('File too large.')
      const text=await file.text()
      if(csv){setSamples(parseCsv(text));setSource('imported')}
      else setSpec(validateSpec(JSON.parse(text)))
      setError('');setResult(null)
    }catch(e){setError(String(e))}
  }
  function test(){try{const frozen=validateSpec(spec);setResult(backtest(frozen,samples,phase,fees,slippage));setTestedSpec({...frozen});setTestRequest({phase,fees,slippage,source:source==='imported'?'user CSV':'synthetic',dataset:samples.map(row=>({...row}))});setError('')}catch(e){setError(String(e))}}
  return <div className="app-shell demo-shell">
    <Onboarding open={guide} onDismiss={dismiss} steps={publicGuideSteps}/>
    <aside className="sidebar"><a href="#overview" className="brand"><span className="brand-mark">S</span><span>Signum<span className="brand-tag">STRATEGY LAB</span></span></a><div className="workspace-label">PUBLIC DEMO</div><a className="nav-item active" href="#overview"><Activity size={17}/>Terminal</a><a className="nav-item" href="#strategies"><FlaskConical size={17}/>Strategy lab</a><a className="nav-item" href="#hardware"><Cpu size={17}/>Inside the FPGA</a><div className="sidebar-divider"/><p className="source-note">Your own virtual portfolio.<br/>No account or installation needed.</p><a className="nav-item" href={repo} target="_blank" rel="noreferrer">Source & local setup ↗</a></aside>
    <main className="main-content" id="overview"><header className="topbar"><div><span className="eyebrow">EXPLORE / EXPERIMENT / UNDERSTAND</span><h1>Trading terminal<span className="pill green">BROWSER DEMO</span></h1></div><button className="button secondary" onClick={()=>setGuide(true)}><CircleHelp size={15}/>Introduction</button></header>
      <nav className="demo-section-nav" aria-label="Demo sections"><a href="#overview">Terminal</a><a href="#strategies">Strategy lab</a><a href="#hardware">FPGA setup</a></nav>
      <div className="notice demo-banner"><ShieldCheck size={18}/><span><strong>Browser simulation — no FPGA connected.</strong> Your $10,000 portfolio is independent. No Alpaca account, shared funds, real orders, or live market connection.</span></div>
      {error&&<div className="notice error" role="alert">{error}</div>}
      <section className="panel source-panel"><div className="panel-heading"><h2>Your experiment</h2><span className="pill subtle">RUNS ENTIRELY ON YOUR DEVICE</span></div><div className="source-fields"><label>Price source<select disabled={running} value={source} onChange={e=>{const v=e.target.value as typeof source;setSource(v);if(v!=='imported')setSamples(syntheticReplay())}}><option value="generated">Generated demo prices · repeatable</option><option value="synthetic">Synthetic replay · 480 samples</option>{source==='imported'&&<option value="imported">Imported historical CSV · {samples.length} samples</option>}</select></label><label>Fees (bps)<input type="number" min={0} max={100} disabled={running} value={fees} onChange={e=>setFees(+e.target.value)}/></label><label className="button secondary file-button">Import historical CSV<input type="file" accept=".csv" aria-label="Import historical CSV" disabled={running} onChange={e=>{void importFile(e.target.files?.[0],true);e.target.value=''}}/></label><button className="button secondary" disabled={running} onClick={()=>{const a=document.createElement('a');const url=URL.createObjectURL(new Blob(['timestamp,price,quantity\n2026-10-19T13:30:00Z,100,20\n2026-10-19T13:31:00Z,99.9,20\n2026-10-19T13:32:00Z,100.2,20\n2026-10-19T13:33:00Z,100.1,20\n'],{type:'text/csv'}));a.href=url;a.download='signum-csv-template.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}>CSV template</button></div><p className="source-note">Bundled prices are synthetic, not AAPL/NVDA measurements. Import your own ordered historical CSV (timestamp,price,quantity; 4–10,000 rows). Files stay in this tab and are never uploaded. Reimport CSV after reload.</p></section>
      <section className="control-bar"><span className="pill green">JavaScript engine · no UART</span><label className="speed-label">Speed<input aria-label="Samples per second" type="range" min={1} max={20} value={speed} onChange={e=>setSpeed(+e.target.value)}/><span>{speed}/s</span></label><button className="button primary" onClick={()=>running?stop():start()}>{running?<Square size={14}/>:<Play size={14}/>} {running?'Stop run':'Start fresh $10,000 run'}</button><button className="button secondary" disabled={!running} onClick={kill}>Latch simulated kill</button><button className="button secondary" disabled={!rows.length} onClick={()=>download(rows,'signum-browser-telemetry.json')}><Download size={14}/>Export run</button></section>
      <div className="metrics-grid">{[['Market price',latest?money(latest.price_usd!):'—'],['Engine position',String(latest?.position??0)],['Latest signal',latest?.decision??'—'],['Paper equity',money(latest?.paper?.equity??10000)]].map(([label,value])=><article className="metric-card" key={label}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-foot">{label==='Engine position'?'Signal inventory · paper holdings shown below':'Browser-only simulation'}</div></article>)}</div>
      <Suspense fallback={<div className="panel">Loading chart…</div>}><Chart rows={rows} state={state} running={running}/></Suspense><PaperPanel latest={latest}/>
      <section className="panel" id="strategies"><div className="panel-heading"><div><h2>Strategy lab</h2><p>Write a hypothesis. Change one rule. Test the result.</p></div><span className="pill subtle">{saved}</span></div><fieldset className="strategy-fields" disabled={running}><label>Name<input maxLength={100} value={spec.name} onChange={e=>setSpec({...spec,name:e.target.value})}/></label><label>Hypothesis<textarea maxLength={5000} rows={2} value={spec.hypothesis} onChange={e=>setSpec({...spec,hypothesis:e.target.value})}/></label><div className="source-fields"><label>Rule<select value={spec.kind} onChange={e=>setSpec({...spec,kind:e.target.value as DemoSpec['kind']})}><option value="anchor">Fixed-anchor reversion</option><option value="sma_reversion">Moving-average reversion</option></select></label>{([['threshold_ticks','Threshold (normalized ticks)',1,500],['window','Prior-sample window',2,500],['max_order','Max order',1,20],['position_limit','Position limit',1,100]] as const).map(([key,label,min,max])=><label key={key}>{label}<input type="number" min={min} max={max} value={spec[key]} onChange={e=>setSpec({...spec,[key]:+e.target.value})}/></label>)}</div></fieldset><p className="source-note">Anchor is 10,000 normalized ticks. SMA uses only previous samples; its first N samples HOLD. Every run snapshots these settings and starts a fresh portfolio. Signals are deterministic rules, not predictions or proof of profitability.</p><div className="strategy-tools"><button className="button secondary" disabled={running} onClick={()=>setSpec({...defaultSpec})}>Original preset</button><button className="button secondary" disabled={running} onClick={()=>setSpec({...defaultSpec,name:'SMA16 experiment',kind:'sma_reversion',window:16,max_order:3,position_limit:8})}>Try SMA16</button><button className="button secondary" onClick={()=>{try{download(validateSpec(spec),'signum.strategy.json')}catch(e){setError(String(e))}}}>Export strategy JSON</button><label className="button secondary file-button">Import strategy<input type="file" accept=".json" aria-label="Import strategy JSON" disabled={running} onChange={e=>{void importFile(e.target.files?.[0]);e.target.value=''}}/></label></div>
      <div className="source-fields"><label>Research period<select value={phase} disabled={running} onChange={e=>setPhase(e.target.value as typeof phase)}><option value="development">Development · first 70%</option><option value="validation">Validation · last 30%</option></select></label><label>Slippage (bps)<input type="number" min={0} max={100} disabled={running} value={slippage} onChange={e=>setSlippage(+e.target.value)}/></label><button className="button primary" disabled={running} onClick={test}>Snapshot & backtest {source==='imported'?'CSV':'synthetic replay'}</button></div><p className="source-note">Backtests use {source==='imported'?'your imported CSV':'the 480-sample synthetic replay'}, next-sample fills, fees and slippage. Each period starts independently. Keep validation unseen while tuning. Main terminal fills at current marks; results are not directly interchangeable.</p>
      {result&&<div className="research-result"><h3>{testedSpec?.name} · frozen result</h3><p>{result.count} samples · {result.start} → {result.end}</p><div className="paper-summary"><div><span>Ending equity</span><strong>{money(result.finalEquity)}</strong><small>P&amp;L {money(result.pnl)} · {result.fills} fills</small></div><div><span>Maximum drawdown</span><strong>{result.maxDrawdown.toFixed(2)}%</strong><small>Fees {money(result.fees)} · final pending signal {result.unfilled} not filled</small></div></div><button className="button secondary" onClick={()=>download({schema_version:1,spec:testedSpec,result,request:testRequest},'signum-backtest.json')}>Export result & frozen settings</button></div>}</section>
      <section className="panel history-panel"><div className="panel-heading"><h2>Decision feed</h2><span className="pill subtle">Last 240 samples kept in memory</span></div><div className="table-scroll"><table><thead><tr><th>Sequence</th><th>Ticks</th><th>Signal</th><th>Engine order</th><th>Paper fill</th><th>Engine position</th></tr></thead><tbody>{rows.slice(-12).reverse().map(row=><tr key={row.sequence}><td>#{row.sequence}</td><td>{row.price}</td><td><span className={`signal ${row.decision.toLowerCase()}`}>{row.decision}</span></td><td>{row.order}</td><td>{row.paper?.filled_order}</td><td>{row.position}</td></tr>)}</tbody></table></div></section>
      <section className="panel source-panel" id="hardware"><div className="panel-heading"><h2><Cpu size={17}/>What happens on the real FPGA?</h2><span className="pill subtle">LOCAL HARDWARE REQUIRED</span></div><p>Prices → Python backend → UART configuration & quotes → Tang Nano 9K → verified decisions → dashboard.</p><p className="source-note">The local version configures Verilog circuits for anchor/SMA rules, checks CRC and settings readback, and compares every reply with Python. This website uses JavaScript only. No physical FPGA timings are measured here.</p><p className="source-note">Recorded physical acceptance: 65/65 SMA16 decisions matched Python; 16-sample warmup and kill acknowledged. Mean measured host round trip 4.29 ms, including USB/UART overhead. Those are recorded results from the developer’s board, not this browser session.</p><a className="button secondary" href={`${repo}/blob/main/docs/hardware.md`} target="_blank" rel="noreferrer">Run locally with your FPGA ↗</a></section>
      <footer className="page-footer"><span>Signum · interactive engineering demonstration</span><span>Strategy draft autosaves on this device. Runs reset on reload. <a href={repo}>GitHub ↗</a></span></footer>
    </main>
  </div>
}
