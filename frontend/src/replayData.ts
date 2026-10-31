import history from './data/marketHistory.json'
import { syntheticReplay } from './demoEngine'
import type { Sample } from './demoEngine'
export interface ReplayData {id:string;name:string;symbol:string;kind:'historical'|'synthetic'|'imported';interval:string;rows:Sample[];description:string}
export const datasets:ReplayData[]=[...history.stocks.map(stock=>({id:stock.symbol,name:stock.name,symbol:stock.symbol,kind:'historical' as const,interval:'1 trading day',rows:stock.rows,description:'Recorded 2017 daily closing prices'})),{id:'practice',name:'Practice prices',symbol:'DEMO',kind:'synthetic',interval:'1 minute',rows:syntheticReplay(),description:'Made-up prices for learning; not a real stock'}]
export const historicalSource={url:history.source_url,label:history.source,license:history.license}
export function selectPeriod(data:ReplayData,period:'3m'|'6m'|'all'):Sample[] {
  if(period==='all'||data.kind!=='historical')return data.rows
  const start=new Date(data.rows[0].timestamp),cutoff=Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+(period==='3m'?3:6),start.getUTCDate())
  return data.rows.filter(row=>Date.parse(row.timestamp)<cutoff)
}
export function marketDate(stamp?:string|null) {return stamp?new Date(stamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'—'}
export function playbackTime(ms:number){const s=Math.floor(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
export function replaySpeedText(data:ReplayData,speed:number) {return data.kind==='historical'?`${speed} trading ${speed===1?'day':'days'} per second`:`${speed} price ${speed===1?'sample':'samples'} per second`}
