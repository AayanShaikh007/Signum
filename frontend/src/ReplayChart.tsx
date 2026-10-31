import { useState } from 'react'
import { Area,AreaChart,CartesianGrid,ReferenceDot,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts'
import { X } from 'lucide-react'
import InfoTip from './InfoTip'
import { marketDate } from './replayData'
import type { ReplayData } from './replayData'
import type { Sample } from './demoEngine'
import type { Telemetry } from './types'
const dollars=(v:number)=>v.toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function ReplayChart({data,preview,rows,status}:{data:ReplayData;preview:Sample[];rows:Telemetry[];status:string}) {
  const [selected,setSelected]=useState<Telemetry|null>(null)
  const started=rows.length>0
  const rawPoints=started?rows.map(row=>({date:Date.parse(row.market_timestamp!),price:row.price_usd!})):preview.map(row=>({date:Date.parse(row.timestamp),price:row.price}))
  const stride=Math.max(1,Math.ceil(rawPoints.length/800))
  const points=rawPoints.filter((_,i)=>i%stride===0||i===rawPoints.length-1)
  const fills=rows.filter(row=>row.paper?.filled_order).slice(-150)
  const last=rows.at(-1),first=preview[0]?.price??0,price=last?.price_usd??first
  const change=first?(price/first-1)*100:0
  return <section className="replay-chart card">
    <header className="card-heading"><div><span className="section-label">PRICE CHART</span><h2>{data.name}<span className="stock-ticker">{data.symbol}</span><InfoTip label="price chart">The line shows past prices. Green B markers are simulated purchases; red S markers are simulated sales. Select a marker for details.</InfoTip></h2></div><span className={`replay-state ${status==='playing'?'is-playing':''}`}><i/>{status==='idle'?'Preview':status==='playing'?'Playing':status==='paused'?'Paused':status==='completed'?'Finished':'Stopped'}</span></header>
    <div className="replay-price"><span className="replay-price-label">{started?`Close on ${marketDate(last?.market_timestamp)}`:'Starting close · full-period preview below'}</span><strong>{dollars(price)}</strong><span className={change>=0?'gain':'loss'}>{change>=0?'+':''}{change.toFixed(2)}%<small> since replay start</small></span></div>
    <div className="replay-chart-canvas"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{top:25,right:12,bottom:0,left:0}}><defs><linearGradient id="replayFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#76b8ed" stopOpacity={.15}/><stop offset="100%" stopColor="#76b8ed" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#263142" vertical={false} strokeDasharray="3 5"/><XAxis dataKey="date" type="number" domain={[Date.parse(preview[0].timestamp),Date.parse(preview.at(-1)!.timestamp)]} tickFormatter={v=>new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})} axisLine={false} tickLine={false} minTickGap={45} tick={{fontSize:11,fill:'#8896a9'}}/><YAxis domain={['auto','auto']} tickFormatter={v=>`$${Number(v).toFixed(0)}`} axisLine={false} tickLine={false} width={55} tick={{fontSize:11,fill:'#8896a9'}}/><Tooltip labelFormatter={v=>marketDate(new Date(Number(v)).toISOString())} formatter={v=>[dollars(Number(v)),'Close price']} contentStyle={{background:'#151f2c',border:'1px solid #344356',borderRadius:8,color:'#e8edf4',fontSize:12}}/><Area type="linear" dataKey="price" stroke={started?'#83bff0':'#52677d'} strokeWidth={2} fill="url(#replayFill)" isAnimationActive={false}/>{fills.map(row=><ReferenceDot key={row.sequence} x={Date.parse(row.market_timestamp!)} y={row.price_usd??undefined} shape={({cx,cy}:{cx?:number;cy?:number})=><g role="button" tabIndex={0} aria-label={`Inspect ${row.paper!.filled_order>0?'buy':'sell'} on ${marketDate(row.market_timestamp)}`} className="replay-marker" onClick={()=>setSelected(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(row)}}}><circle cx={cx} cy={cy} r={8} fill={row.paper!.filled_order>0?'#50c69b':'#ee929b'} stroke="#0f1722" strokeWidth={2}/><text x={cx} y={(cy??0)+3} fill="#10201e" textAnchor="middle" fontSize={8} fontWeight={700}>{row.paper!.filled_order>0?'B':'S'}</text></g>}/>)}</AreaChart></ResponsiveContainer></div>
    <div className="replay-chart-legend"><span><i className="line-key"/>Close price</span><span><i className="buy-key"/>Bot bought</span><span><i className="sell-key"/>Bot sold</span><small>{started?`${rows.length} of ${preview.length} prices played`:'Full-period preview · press Play to reveal decisions'}</small></div>
    {selected&&rows.includes(selected)&&<div className="replay-inspector"><div><strong>{selected.paper!.filled_order>0?'Bought':'Sold'} {Math.abs(selected.paper!.filled_order)} shares · {marketDate(selected.market_timestamp)}</strong><button className="info-tip-button" aria-label="Close trade details" onClick={()=>setSelected(null)}><X size={16}/></button></div><p>Simulated fill: {dollars(selected.fill_price_usd??selected.price_usd!)} per share. Shares held afterward: {selected.paper!.position}. The rule made this request on the previous sample.</p></div>}
  </section>
}
