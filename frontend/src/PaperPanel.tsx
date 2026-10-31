import { Wallet } from 'lucide-react'
import type { Telemetry, BrokerAccount } from './types'
const dollars = (n: number) => n.toLocaleString('en-US',{style:'currency',currency:'USD'})
function Details({rows}:{rows:[string,string|number][]}) {
  return <dl className="paper-details">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
export default function PaperPanel({ latest, broker, accountMode }: { latest?: Telemetry; broker?: BrokerAccount | null; accountMode?: boolean }) {
  if(accountMode) return <section className="panel paper-panel">
    <div className="panel-heading"><h2><Wallet size={16}/>Alpaca paper account</h2><span className="pill green">VIRTUAL BROKER FUNDS</span></div>
    <div className="paper-summary"><div><span>Account equity</span><strong>{broker?dollars(broker.equity):'—'}</strong><small>Persistent account-wide equity</small></div><div><span>Available cash</span><strong>{broker?dollars(broker.cash):'—'}</strong><small>Balance does not reset between runs</small></div></div>
    <Details rows={[
      ['Account shares',broker?.position??'—'],['Engine position',latest?.position??'—'],
      ['Holding unrealized P&L',broker?dollars(broker.unrealized_pnl):'—'],['Latest order status',broker?.last_order?.status??'None'],
      ['Order quantity',broker?.last_order?.qty??'—'],['Filled quantity',broker?.last_order?.filled_qty??'—'],
      ['Average fill price',broker?.last_order?.filled_avg_price??'—'],
    ]}/>
    <p className="source-note">Alpaca records simulated fills. Account holdings persist; engine position starts at zero each run. Stop does not liquidate holdings. <a href="https://app.alpaca.markets/" target="_blank" rel="noreferrer">View paper account ↗</a></p>
  </section>
  const paper=latest?.paper
  const value=(key:'cash'|'equity'|'realized_pnl'|'unrealized_pnl'|'total_pnl'|'fees')=>paper?dollars(paper[key]):'—'
  return <section className="panel paper-panel">
    <div className="panel-heading"><h2><Wallet size={16}/>Paper portfolio</h2><span className="pill subtle">VIRTUAL FUNDS · NO REAL ORDERS</span></div>
    <div className="paper-summary"><div><span>Portfolio equity</span><strong>{value('equity')}</strong><small>$10,000 starting cash per run</small></div><div className={paper&&paper.total_pnl<0?'negative':'positive'}><span>Total profit / loss</span><strong>{value('total_pnl')}</strong><small>After simulated fees</small></div></div>
    <Details rows={[
      ['Available cash',value('cash')],['Average share cost',paper?dollars(paper.average_cost):'—'],
      ['Paper shares held',paper?.position??'—'],['Engine position',latest?.position??'—'],
      ['Realized P&L',value('realized_pnl')],['Unrealized P&L',value('unrealized_pnl')],
      ['Total fees',value('fees')],['Completed fills',paper?.fill_count??0],
      ['Latest filled quantity',paper?.filled_order??0],['Latest unfilled units',paper?.unfilled_units??0],
    ]}/>
    <p className="source-note">Paper shares are long-only holdings. Engine position is separate signal inventory and can be negative; the portfolio never executes short sales. Fills are clipped to available cash and shares. Current-price fills use no slippage. Simulation results do not establish profitability.</p>
  </section>
}
