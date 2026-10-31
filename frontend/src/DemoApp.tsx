import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, RotateCcw, Play, Pause, Download, Upload, ExternalLink, HelpCircle } from 'lucide-react'
import Onboarding from './Onboarding'
import InfoTip from './InfoTip'
import { publicGuideSteps } from './onboardingContent'
import { backtest, defaultSpec, DemoRun, parseCsv, validateDraft, validateSpec } from './demoEngine'
import type { BacktestResult, DemoSpec, Sample } from './demoEngine'
import { DEMO_DRAFT, readLocal, writeLocal } from './demoStorage'
import { datasets, historicalSource, marketDate, playbackTime, replaySpeedText, selectPeriod } from './replayData'
import type { ReplayData } from './replayData'
import type { Telemetry } from './types'
import './replay.css'
const Chart=lazy(()=>import('./ReplayChart'))
const dollars=(v:number)=>v.toLocaleString('en-US',{style:'currency',currency:'USD'})
const repo='https://github.com/AayanShaikh007/Signum'
function download(value:unknown,name:string) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a')
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
interface Runtime {run:DemoRun;data:Sample[];index:number;active:boolean;last:Sample|null;elapsed:number;activeSince:number}
interface Experiment {spec:DemoSpec;result:BacktestResult;phase:'development'|'validation';fees:number;slippage:number;data:Sample[];symbol:string}
export default function DemoApp() {
  const [spec,setSpec]=useState<DemoSpec>(()=>readLocal(DEMO_DRAFT,{...defaultSpec,name:'Buy below the recent average',kind:'sma_reversion',window:16,max_order:5,position_limit:20},validateDraft))
  const [selected,setSelected]=useState('AAPL'),[period,setPeriod]=useState<'3m'|'6m'|'all'>('all')
  const [custom,setCustom]=useState<ReplayData|null>(null)
  const [speed,setSpeed]=useState(10),[fees,setFees]=useState(1),[slippage,setSlippage]=useState(2)
  const [rows,setRows]=useState<Telemetry[]>([]),[status,setStatus]=useState<'idle'|'playing'|'paused'|'completed'|'killed'|'error'>('idle')
  const [elapsed,setElapsed]=useState(0),[error,setError]=useState(''),[saved,setSaved]=useState('')
  const [phase,setPhase]=useState<'development'|'validation'>('development'),[experiment,setExperiment]=useState<Experiment|null>(null)
  const [guide,setGuide]=useState(()=>readLocal('signum.public.guide.replay-v3',true,v=>v!==true))
  const current=useRef<Runtime|null>(null)
  const data=selected==='imported'&&custom?custom:datasets.find(item=>item.id===selected)??datasets[0]
  const samples=selectPeriod(data,period),locked=status!=='idle',playing=status==='playing',latest=rows.at(-1),paper=latest?.paper
  const fills=rows.filter(row=>row.paper?.filled_order),equity=paper?.equity??10000,pnl=paper?.total_pnl??0
  useEffect(()=>{setSaved(writeLocal(DEMO_DRAFT,spec)?'Rule saved on this device':'Storage is unavailable. Export your rule to keep it.')},[spec])
  function dismiss(){setGuide(false);writeLocal('signum.public.guide.replay-v3',true)}
  function reset(){if(current.current)current.current.active=false;current.current=null;setStatus('idle');setRows([]);setElapsed(0);setError('')}
  function pause(){const run=current.current;if(!run)return;run.elapsed+=performance.now()-run.activeSince;run.active=false;setElapsed(run.elapsed);setStatus('paused')}
  function play(){
    if(current.current?.active)return
    if(status==='paused'&&current.current){current.current.active=true;current.current.activeSince=performance.now();setStatus('playing');return}
    try {
      const frozen=validateSpec(spec)
      current.current={run:new DemoRun({...frozen},fees,crypto.randomUUID(),data.kind,{symbol:data.symbol,nextSampleFills:true,slippageBps:slippage}),data:samples.map(row=>({...row})),index:0,active:true,last:null,elapsed:0,activeSince:performance.now()}
      setRows([]);setElapsed(0);setError('');setStatus('playing')
    }catch(e){setError(e instanceof Error?e.message:String(e))}
  }
  useEffect(()=>{
    if(!playing)return
    const timer=setInterval(()=>{
      const session=current.current;if(!session?.active)return
      try {
        const sample=session.data[session.index];session.last=sample;session.index++
        const row=session.run.tick(sample);setRows(previous=>[...previous,row]);setElapsed(session.elapsed+performance.now()-session.activeSince)
        if(session.index===session.data.length){session.elapsed+=performance.now()-session.activeSince;session.active=false;setStatus('completed')}
      }catch(e){session.active=false;setError(e instanceof Error?e.message:String(e));setStatus('error')}
    },1000/speed)
    return ()=>clearInterval(timer)
  },[playing,speed])
  useEffect(()=>()=>{if(current.current)current.current.active=false},[])
  function kill(){const session=current.current;if(!session)return;session.active=false;if(playing)session.elapsed+=performance.now()-session.activeSince;setElapsed(session.elapsed);if(session.last){const row=session.run.tick(session.last,true);row.control_only=true;setRows(old=>[...old,row])}setStatus('killed')}
  async function importFile(file:File|undefined,csv=false){
    if(!file||locked)return
    try {
      if(file.size>(csv?2_000_000:20_000))throw new Error('File is too large.')
      const text=await file.text()
      if(current.current)throw new Error('Reset the replay before importing a file.')
      if(csv){const values=parseCsv(text);setCustom({id:'imported',name:file.name.replace(/\.csv$/i,''),symbol:'CSV',kind:'imported',interval:'1 CSV row',rows:values,description:'Your imported price history'});setSelected('imported');setPeriod('all')}
      else setSpec(validateSpec(JSON.parse(text)))
      setError('');setExperiment(null)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
  }
  function test(){try{const frozen=validateSpec(spec);setExperiment({spec:{...frozen},result:backtest(frozen,samples,phase,fees,slippage),phase,fees,slippage,data:samples.map(row=>({...row})),symbol:data.symbol});setError('')}catch(e){setError(e instanceof Error?e.message:String(e))}}
  const played=current.current?.index??0
  const chartRows=rows.filter(row=>!row.control_only)
  return <div className="replay-app">
    <Onboarding open={guide} onDismiss={dismiss} steps={publicGuideSteps} reopenText="Reopen this guide with the Help button in the header."/>
    <header className="replay-nav"><a href="#" className="replay-brand"><span>S</span>Signum<small>Stock strategy playground</small></a><nav aria-label="Main navigation"><a href="#rules">Your rule</a><a href="#learn">How it works</a><a href={repo} target="_blank" rel="noreferrer">GitHub<ExternalLink size={13}/></a><button onClick={()=>setGuide(true)} aria-label="Open introduction"><HelpCircle size={18}/><span>Help</span></button></nav></header>
    <main className="replay-main">
      <div className="replay-intro"><div><h1>See when a trading bot buys and sells.</h1><p>Replay past stock prices with $10,000 in pretend money. Change a rule, speed up time, and see what happens.</p></div><span className="replay-disclosure"><i/>Simulation only · no real orders</span></div>
      {error&&<div className="replay-error" role="alert">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
      <section className="card choose-card"><header className="card-heading"><h2>Choose your prices<InfoTip label="price data">Apple, Nvidia and Microsoft use real daily closing prices from 2017. Practice prices are made up. Nothing here is a live market feed.</InfoTip></h2><label className={`replay-file quiet-button ${locked?'is-disabled':''}`}><Upload size={14}/>Use a CSV<input aria-label="Import historical CSV" type="file" accept=".csv" disabled={locked} onChange={e=>{void importFile(e.target.files?.[0],true);e.target.value=''}}/></label></header>
        <div className="stock-options" role="group" aria-label="Choose a stock">{datasets.map(item=><button key={item.id} disabled={locked} className={selected===item.id?'selected':''} aria-pressed={selected===item.id} onClick={()=>{setSelected(item.id);setPeriod('all');setExperiment(null)}}><span className={`stock-avatar ${item.id.toLowerCase()}`}>{item.kind==='synthetic'?'~':item.symbol[0]}</span><span><strong>{item.symbol==='DEMO'?'Practice':item.symbol}</strong><small>{item.name}</small></span>{selected===item.id&&<i/>}</button>)}{custom&&<button disabled={locked} className={selected==='imported'?'selected':''} onClick={()=>{setSelected('imported');setPeriod('all')}}><span className="stock-avatar">C</span><span><strong>CSV</strong><small>{custom.name}</small></span></button>}</div>
        <div className="data-period"><span><b>{data.kind==='historical'?'Real historical prices':data.kind==='synthetic'?'Fictional practice prices':'Imported history'}</b> · {marketDate(samples[0].timestamp)} — {marketDate(samples.at(-1)!.timestamp)} · {samples.length} samples</span>{data.kind==='historical'&&<div className="period-buttons" aria-label="Choose a time period">{([['3m','3 months'],['6m','6 months'],['all','Full year']] as const).map(([value,label])=><button key={value} disabled={locked} aria-pressed={period===value} className={period===value?'selected':''} onClick={()=>{setPeriod(value);setExperiment(null)}}>{label}</button>)}</div>}</div>
        {locked&&<p className="edit-hint">Reset the replay to change its stock, dates or rule. Speed can change while it plays.</p>}
      </section>
      <div className="replay-workspace"><div className="replay-left"><Suspense fallback={<div className="card chart-placeholder">Loading price chart…</div>}><Chart key={`${data.id}-${period}`} data={data} preview={samples} rows={chartRows} status={status}/></Suspense>
        <section className="card playback-card"><div className="playback-actions"><button className="play-button" disabled={status==='killed'||status==='error'} onClick={()=>playing?pause():play()}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'Pause':status==='paused'?'Resume':status==='completed'?'Replay again':'Play replay'}</button><button className="quiet-button" disabled={!locked} onClick={reset}><RotateCcw size={14}/>Reset</button><div className="speed-control"><span>Speed<InfoTip label="replay speed">1× plays one saved price each second. 10× plays ten each second. Daily history is already compressed: one price represents an entire trading day, not one second of live trading.</InfoTip></span><div role="group" aria-label="Replay speed">{[1,5,10,20,50].map(value=><button key={value} className={speed===value?'selected':''} aria-pressed={speed===value} onClick={()=>setSpeed(value)}>{value}×</button>)}</div></div></div>
          <p className="speed-explanation">{replaySpeedText(data,speed)}. {data.kind==='historical'?'Each dot is one past trading day. This is sped-up history, not live trading.':'Each dot is one saved price. Playback skips waiting between its recorded timestamps.'}</p>
          {locked&&spec.kind==='sma_reversion'&&played<spec.window&&<p className="warmup-note">Building the average: {played} / {spec.window} prices. The bot waits during this warmup.</p>}
          <progress max={samples.length} value={played} aria-label="Replay progress"/><div className="playback-status"><span>{played} / {samples.length} prices</span><span>Market date: <b>{marketDate(latest?.market_timestamp)}</b></span><span>Playback time: <b>{playbackTime(elapsed)}</b></span></div>
        </section>
      </div>
      <aside className="card account-card"><header className="card-heading"><h2>Your pretend portfolio<InfoTip label="portfolio">You start each replay with $10,000. The bot can buy only with available cash and sell only shares you own. No broker account is connected.</InfoTip></h2></header><span className="account-caption">TOTAL VALUE</span><strong className="account-equity">{dollars(equity)}</strong><div className={`account-change ${pnl>=0?'gain':'loss'}`}>{pnl>=0?<ArrowUpRight size={16}/>:<ArrowDownLeft size={16}/>} {pnl>=0?'+':''}{dollars(pnl)} <span>({(pnl/100).toFixed(2)}%)</span></div><p>Started with $10,000</p>
        <dl className="account-details"><div><dt>Cash left</dt><dd>{dollars(paper?.cash??10000)}</dd></div><div><dt>Shares owned</dt><dd>{paper?.position??0} <small>{data.symbol}</small></dd></div><div><dt>Shares worth</dt><dd>{dollars(paper?.market_value??0)}</dd></div><div><dt>Profit on sold shares</dt><dd>{dollars(paper?.realized_pnl??0)}</dd></div><div><dt>Profit on held shares</dt><dd>{dollars(paper?.unrealized_pnl??0)}</dd></div><div><dt>Trading fees paid</dt><dd>{dollars(paper?.fees??0)}</dd></div></dl><div className="account-trades"><b>{paper?.fill_count??0}</b><span>completed buys & sells</span></div><p className="account-note">Past results, even good ones, do not predict future profit.</p>
      </aside></div>
      <div className="replay-lower"><section className="card rule-card" id="rules"><header className="card-heading"><h2>Your trading rule<InfoTip label="trading rule">A rule tells the bot when to request a buy or sell. These two rules buy below a reference price and sell above it. They do not learn or predict prices.</InfoTip></h2><span className="subtle-text">{saved}</span></header>
        <fieldset disabled={locked} className="rule-fields"><label>When should the bot buy?<select value={spec.kind} onChange={e=>setSpec({...spec,kind:e.target.value as DemoSpec['kind']})}><option value="anchor">When price drops below its starting price</option><option value="sma_reversion">When price drops below its recent average</option></select></label><div className="rule-numbers"><label>Price gap (basis points)<InfoTip label="price gap">One basis point is 0.01% of the starting price. A gap of 5 means about 5 cents when a stock starts at $100. Smaller gaps usually trigger more signals.</InfoTip><input aria-label="Price gap in basis points" type="number" min={1} max={500} value={spec.threshold_ticks} onChange={e=>setSpec({...spec,threshold_ticks:+e.target.value})}/></label>{spec.kind==='sma_reversion'&&<label>Prices in the average<input type="number" min={2} max={500} value={spec.window} onChange={e=>setSpec({...spec,window:+e.target.value})}/></label>}<label>Shares per order<input type="number" min={1} max={20} value={spec.max_order} onChange={e=>setSpec({...spec,max_order:+e.target.value})}/></label><label>Maximum shares held<input type="number" min={1} max={100} value={spec.position_limit} onChange={e=>setSpec({...spec,position_limit:+e.target.value})}/></label></div></fieldset>
        <div className="rule-explanation"><span><i className="buy-key"/>BUY</span><p>At least {(spec.threshold_ticks/100).toFixed(2)}% of the starting price below {spec.kind==='anchor'?'the starting price':`the previous ${spec.window}-price average`}.</p><span><i className="sell-key"/>SELL</span><p>The same gap above that reference. Otherwise, wait.</p></div>
        {spec.kind==='sma_reversion'&&<p className="small-note">The first {spec.window} samples build the average. The bot waits during this warmup.</p>}
        <details className="rule-advanced"><summary>Costs, saved rules & extra controls</summary><fieldset disabled={locked}><div className="rule-numbers"><label>Fees (basis points)<input type="number" min={0} max={100} value={fees} onChange={e=>setFees(+e.target.value)}/></label><label>Slippage (basis points)<InfoTip label="slippage">A small extra cost models getting a slightly worse price than the chart shows. This is an assumption, not an actual exchange fill.</InfoTip><input aria-label="Slippage in basis points" type="number" min={0} max={100} value={slippage} onChange={e=>setSlippage(+e.target.value)}/></label></div><label>Rule name<input maxLength={100} value={spec.name} onChange={e=>setSpec({...spec,name:e.target.value})}/></label><label>Why might this work?<textarea rows={2} maxLength={5000} value={spec.hypothesis} onChange={e=>setSpec({...spec,hypothesis:e.target.value})}/></label></fieldset><div className="saved-rule-actions"><button className="quiet-button" onClick={()=>{try{download(validateSpec(spec),'signum.strategy.json')}catch(e){setError(e instanceof Error?e.message:String(e))}}}><Download size={14}/>Export rule</button><label className="replay-file quiet-button"><Upload size={14}/>Import rule<input aria-label="Import strategy JSON" type="file" accept=".json" disabled={locked} onChange={e=>{void importFile(e.target.files?.[0]);e.target.value=''}}/></label><button className="quiet-button" disabled={!locked||status==='killed'} onClick={kill}>Stop bot (kill)</button></div><p className="small-note">Buys and sells fill at the next sample, with costs. Stop bot cancels its pending request; it does not sell your holdings. Reset starts over.</p></details>
      </section>
      <section className="card activity-card"><header className="card-heading"><h2>What the bot did<InfoTip label="trade history">These are completed simulated buys and sells. A request can be smaller or unfilled if the portfolio runs out of cash or shares. Select a chart marker for its details.</InfoTip></h2><button className="quiet-button" disabled={!rows.length} onClick={()=>download({source:data.symbol,rows,spec:current.current?.run.spec},'signum-replay.json')}><Download size={14}/>Export</button></header><div className="activity-table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Shares</th><th>Fill price</th></tr></thead><tbody>{fills.slice(-8).reverse().map(row=><tr key={row.sequence}><td>{marketDate(row.market_timestamp)}</td><td><span className={row.paper!.filled_order>0?'action-buy':'action-sell'}>{row.paper!.filled_order>0?'Bought':'Sold'}</span></td><td>{Math.abs(row.paper!.filled_order)}</td><td>{dollars(row.fill_price_usd!)}</td></tr>)}</tbody></table></div>{!fills.length&&<div className="activity-empty"><p>No trades yet.</p><span>Press Play. Buys and sells will appear here as the rule finds a match.</span></div>}<p className="small-note">Signals use prices available at that point. Fills use the following sample; a final request is not filled without another price.</p></section></div>
      <section className="card test-card"><details><summary><span>Test on a separate time period<InfoTip label="backtesting">Backtesting runs a rule over past data. Use the first 70% to develop it and the last 30% to test it without changing the rule. Repeated tuning on the last part makes it no longer unseen.</InfoTip></span><span className="subtle-text">Optional · explore results</span></summary><p>Try your rule on one part of {data.symbol} history. Keep the later part separate to check whether the result holds up.</p><div className="test-actions"><label>Price period<select disabled={playing} value={phase} onChange={e=>setPhase(e.target.value as typeof phase)}><option value="development">First 70% · develop the rule</option><option value="validation">Last 30% · check the rule</option></select></label><button className="play-button" disabled={playing} onClick={test}>Run test</button></div>{experiment&&<div className="test-result"><h3>{experiment.symbol} · {experiment.phase==='development'?'First 70%':'Last 30%'}</h3><p>{marketDate(experiment.result.start)} — {marketDate(experiment.result.end)} · {experiment.result.count} samples · a fresh $10,000</p><dl><div><dt>Ending value</dt><dd>{dollars(experiment.result.finalEquity)}</dd></div><div><dt>Profit / loss</dt><dd>{dollars(experiment.result.pnl)}</dd></div><div><dt>Largest drop from a peak</dt><dd>{experiment.result.maxDrawdown.toFixed(2)}%</dd></div><div><dt>Completed trades</dt><dd>{experiment.result.fills}</dd></div></dl><button className="quiet-button" onClick={()=>download(experiment,'signum-backtest.json')}>Export result & rule</button></div>}</details></section>
      <section className="learn-section" id="learn"><header><h2>What are you looking at?<InfoTip label="how Signum works">This site is a browser simulation. The related local project uses a physical FPGA to process the same supported trading rules.</InfoTip></h2></header><div><article><span>01</span><h3>Past prices, faster</h3><p>{data.kind==='historical'?'The bundled samples are real 2017 daily closes. They are not current quotes.':data.kind==='synthetic'?'Practice mode uses invented prices. It is a learning tool, not evidence about a real stock.':'Your CSV stays in this browser and is not uploaded.'} Speed changes how fast they play, not what happened.</p></article><article><span>02</span><h3>A rule, not a crystal ball</h3><p>Buying a dip assumes prices may recover. They can keep falling. Fees and limits matter; a profitable replay does not prove a profitable strategy.</p></article><article><span>03</span><h3>Real hardware, locally</h3><p>This demo runs in JavaScript. The local version sends prices to a Tang Nano 9K FPGA and checks its responses against Python. No board is connected here.</p><a href={`${repo}/blob/main/docs/hardware.md`} target="_blank" rel="noreferrer">Explore the FPGA setup<ExternalLink size={12}/></a></article></div></section>
      <footer className="replay-footer"><span>Signum · built to learn about trading and digital hardware.</span><a href={historicalSource.url} target="_blank" rel="noreferrer">Historical dataset · CC0<ExternalLink size={12}/></a></footer>
    </main>
  </div>
}
