import { useId, useRef, useState } from 'react'

export interface StrategySpec { schema_version:1; name:string; hypothesis:string; kind:'anchor'|'sma_reversion'; threshold_ticks:number; window:number; max_order:number; position_limit:number }
export interface Draft {
  id:string; created_at:string; deployment:string; fpga_supported:boolean; limits:string
  research?:{query:string;topic_terms:string[];status:string}
  proposal:{supported:boolean;explanation:string;spec:StrategySpec;evidence:{source_id:string;finding:string;limitation:string}[];parameter_reasoning:string;risks:string[]}
  sources:{id:string;title:string;url:string;coverage:string;abstract:string}[]
}
export default function StrategyAssistant({hypothesis,disabled,onApply,onTest,onPrepare}:{hypothesis:string;disabled:boolean;onApply:(spec:StrategySpec)=>void;onTest:(spec:StrategySpec)=>Promise<void>;onPrepare:(spec:StrategySpec)=>Promise<void>}) {
  const [draft,setDraft]=useState<Draft|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const pending=useRef(false)
  async function research() {
    if(pending.current)return
    pending.current=true;setBusy(true);setError('');setDraft(null)
    try {
      const response=await fetch('/api/assistant/drafts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesis})})
      const value=await response.json()
      if(!response.ok)throw new Error(typeof value.detail==='string'?value.detail:'Unable to draft. Check your hypothesis and backend settings.')
      setDraft(value)
    }catch(e){setError(e instanceof Error?e.message:'AI service unavailable')}
    finally{pending.current=false;setBusy(false)}
  }
  function download() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}))
    const a=document.createElement('a');a.href=url;a.download='signum-research-draft.json';a.click();URL.revokeObjectURL(url)
  }
  return <div className="ai-assistant">
    <h3>Research an idea with AI</h3>
    <p>Write your hypothesis above, then ask Azure to suggest a testable rule. Your hypothesis is sent to Crossref for scholarly search and Azure for drafting. No account or portfolio details are sent.</p>
    <p>Supported rules buy below a fixed reference or recent average and sell above it. Opening-range breakouts, timed entries and timed exits require additional engine logic.</p>
    <button className="button secondary" disabled={disabled||busy||hypothesis.trim().length<15} onClick={()=>void research()}>{busy?'Finding sources and drafting…':'Research & draft settings'}</button>
    <small>Local app only · up to 10 requests/hour · may take a minute · never starts trading</small>
    {error&&<p className="notice error" role="alert">{error}</p>}
    {draft&&<StrategyDraftReview draft={draft} hypothesis={hypothesis} disabled={disabled} onApply={onApply} onTest={onTest} onPrepare={onPrepare} onExport={download}/>}
  </div>
}


export function StrategyDraftReview({draft,hypothesis,disabled,onApply,onTest,onPrepare,onExport}:{
  draft:Draft; hypothesis:string; disabled:boolean;
  onApply:(spec:StrategySpec)=>void; onTest:(spec:StrategySpec)=>Promise<void>; onPrepare:(spec:StrategySpec)=>Promise<void>; onExport:()=>void
}) {
  const applyReasonId=useId()
  const applyReason = !draft.proposal.supported ? 'Apply and backtest are unavailable because this hypothesis needs strategy logic that the current Python and FPGA engines do not implement. The editor supports fixed-anchor and moving-average reversion.'
    : hypothesis!==draft.proposal.spec.hypothesis ? 'Hypothesis changed. Generate a new draft before applying.'
    : disabled ? 'Wait for saving or testing to finish and stop any active run before applying.' : ''
  return <div aria-live="polite">
      <h4>{draft.proposal.supported?'Candidate rule — review before applying':'This idea needs a different trading engine'}</h4>
      <p>{draft.proposal.explanation}</p>
      <p className="notice warning">{draft.limits}</p>
      {draft.proposal.supported&&<><dl className="ai-settings"><dt>Template</dt><dd>{draft.proposal.spec.kind}</dd><dt>Price gap</dt><dd>{draft.proposal.spec.threshold_ticks} normalized ticks</dd><dt>Average window</dt><dd>{draft.proposal.spec.window} samples</dd><dt>Max order / holdings</dt><dd>{draft.proposal.spec.max_order} / {draft.proposal.spec.position_limit}</dd></dl>
      <p><strong>Why these starting values:</strong> {draft.proposal.parameter_reasoning}</p></>}
      {applyReason&&<p id={applyReasonId} className="notice warning" role="status">{applyReason}</p>}
      <div className="strategy-tools"><button className="button primary" aria-describedby={applyReason ? applyReasonId : undefined} disabled={Boolean(applyReason)} onClick={()=>void onPrepare(draft.proposal.spec)}>Apply &amp; prepare run</button><button className="button secondary" aria-describedby={applyReason ? applyReasonId : undefined} disabled={Boolean(applyReason)} onClick={()=>onApply(draft.proposal.spec)}>Apply to editor</button><button className="button secondary" aria-describedby={applyReason ? applyReasonId : undefined} disabled={Boolean(applyReason)} onClick={()=>void onTest(draft.proposal.spec)}>Save candidate & backtest</button><button className="button secondary" onClick={onExport}>Export research + sources</button></div>
      {draft.proposal.supported&&<p className="source-note">Apply &amp; prepare run fills the editor, saves a separate strategy, freezes it and selects it for your next run.</p>}
      <details className="ai-research-details"><summary>Research sources ({draft.sources.length}) and evidence</summary>
      {draft.research&&<p><strong>Research query:</strong> {draft.research.query}</p>}
      <h4>Retrieved sources — relevance is not proof</h4>
      {!draft.sources.length&&<p>No relevant sources passed the topic filter. Try a more specific hypothesis. Settings remain unvalidated.</p>}
      {draft.sources.map(source=><div className="ai-source" key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.id}: {source.title}</a><small>{source.coverage}</small>{draft.proposal.evidence.filter(e=>e.source_id===source.id).map((e,i)=><div key={i}><p>{e.finding}</p><p><strong>Limit:</strong> {e.limitation}</p></div>)}<details><summary>What the AI could read</summary><p>{source.abstract||'Bibliographic metadata only. No abstract was provided.'}</p></details></div>)}
      </details>
      <ul>{draft.proposal.risks.map((risk,i)=><li key={i}>{risk}</li>)}</ul>
      <p>Saved research ID: {draft.id}. {!draft.proposal.supported?'Execution unavailable for this hypothesis.':draft.fpga_supported?'Candidate settings fit the FPGA configuration.':'Candidate settings require the Python engine.'} Applying edits does not deploy hardware or place orders.</p>

    </div>
}
