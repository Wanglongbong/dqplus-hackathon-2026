import { useEffect, useState } from 'react';
import './community.css';

export default function ConnectionInbox({ load, onAction, onReport }) {
  const [box, setBox] = useState('inbox');
  const [state, setState] = useState({ status: 'loading', items: [], error: '' });
  const [reporting, setReporting] = useState(null);
  const [reportReason, setReportReason] = useState('Spam or misleading information');

  async function refresh() {
    setState({ status: 'loading', items: [], error: '' });
    try {
      const result = await load(box);
      setState({ status: 'ready', items: result.connections || [], error: '' });
    } catch (error) { setState({ status: 'error', items: [], error: error.message }); }
  }
  useEffect(() => { refresh(); }, [box]);

  async function act(id, action) {
    try { await onAction(id, action); await refresh(); } catch (error) { setState((current) => ({ ...current, error: error.message })); }
  }

  async function report(id) {
    try { await onReport(id, reportReason); setReporting(null); setState((current) => ({ ...current, error: 'Report submitted for moderator review.' })); }
    catch (error) { setState((current) => ({ ...current, error: error.message })); }
  }

  return (
    <main className="community-page">
      <div className="eyebrow">Consent-first networking</div><h1 className="serif-h1">Connection inbox</h1><p className="lede">Contact details unlock only after a request is accepted.</p>
      <div className="seg community-tabs"><button type="button" className={'seg-btn' + (box === 'inbox' ? ' active' : '')} onClick={() => setBox('inbox')}>Received</button><button type="button" className={'seg-btn' + (box === 'sent' ? ' active' : '')} onClick={() => setBox('sent')}>Sent</button><button type="button" className={'seg-btn' + (box === 'all' ? ' active' : '')} onClick={() => setBox('all')}>All</button></div>
      {state.error && <div className="card community-alert">{state.error}</div>}
      {state.status === 'loading' && <div className="card community-empty">Loading connections…</div>}
      {state.status === 'ready' && !state.items.length && <div className="card community-empty">No requests here yet.</div>}
      <div className="community-list">{state.items.map((item) => <article className="card connection-card" key={item.id}>
        <div><div className="card-label">{item.direction} · {item.intent} · {item.status}</div><h2>{item.peer?.profile?.company_name || 'Community member'}</h2><p>{item.message}</p></div>
        {item.peer?.contact && <div className="contact-reveal"><b>Contact unlocked</b><span>{item.peer.contact.email || 'No email shared'}</span>{item.peer.contact.linkedinUrl && <a href={item.peer.contact.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn ↗</a>}</div>}
        {item.status === 'pending' && item.direction === 'received' && <div className="community-actions"><button type="button" className="btn btn-primary" onClick={() => act(item.id, 'accept')}>Accept</button><button type="button" className="btn btn-ghost" onClick={() => act(item.id, 'save')}>Save for later</button><button type="button" className="btn btn-ghost" onClick={() => act(item.id, 'decline')}>Decline</button></div>}
        {item.status === 'pending' && item.direction === 'sent' && <div className="community-actions"><button type="button" className="btn btn-ghost" onClick={() => act(item.id, 'withdraw')}>Withdraw</button></div>}
        <button type="button" className="mini-action report-action" onClick={() => setReporting(reporting === item.id ? null : item.id)}>Report</button>
        {reporting === item.id && <div className="report-form"><label className="label">Reason for moderator review</label><input className="input" value={reportReason} onChange={(event) => setReportReason(event.target.value)} /><button type="button" className="btn btn-ghost" onClick={() => report(item.id)}>Submit report</button></div>}
      </article>)}</div>
    </main>
  );
}
