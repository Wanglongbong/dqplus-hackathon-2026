import { useEffect, useState } from 'react';
import './community.css';

const empty = { type: 'fundraising', title: '', summary: '' };

export default function OpportunityBoard({ session, canPublish, canConnect, load, create, close, report, connect }) {
  const [filter, setFilter] = useState('');
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState('');
  const [connectingId, setConnectingId] = useState(null);
  const [intro, setIntro] = useState('');
  const [reportingId, setReportingId] = useState(null);
  const [reportReason, setReportReason] = useState('Potentially misleading opportunity');

  async function refresh() {
    try { const result = await load(filter); setItems(result.opportunities || []); } catch (error) { setMessage(error.message); }
  }
  useEffect(() => { refresh(); }, [filter]);

  async function submit(event) {
    event.preventDefault(); setMessage('');
    try { await create(form); setForm(empty); setMessage('Opportunity published.'); await refresh(); } catch (error) { setMessage(error.message); }
  }

  async function sendIntro(item) {
    try {
      await connect(item, intro);
      setMessage('Connection request sent.');
      setConnectingId(null);
      setIntro('');
    } catch (error) { setMessage(error.message); }
  }

  async function closeItem(id) {
    try { await close(id); setMessage('Opportunity closed.'); await refresh(); } catch (error) { setMessage(error.message); }
  }

  async function reportItem(id) {
    try { await report(id, reportReason); setMessage('Report submitted for moderator review.'); setReportingId(null); }
    catch (error) { setMessage(error.message); }
  }

  return (
    <main className="community-page opportunity-layout">
      <section><div className="eyebrow">Time-bound asks and offers</div><h1 className="serif-h1">Opportunity board</h1><p className="lede">Publish what you need now—funding, a pilot, investment opportunities or a partnership.</p>
        <div className="vn-match-tabs">{[['','All'],['fundraising','Fundraising'],['investment','Investment'],['pilot','Pilots'],['partnership','Partnerships']].map(([id,label]) => <button key={id} type="button" className={'vn-match-tab' + (filter === id ? ' active' : '')} onClick={() => setFilter(id)}>{label}</button>)}</div>
        <div className="community-list">{items.map((item) => <article className="card opportunity-card" key={item.id}><div className="card-label">{item.type} · until {new Date(item.expiresAt).toLocaleDateString()}</div><h2>{item.title}</h2><p>{item.summary}</p><div className="opportunity-owner">{item.owner?.profile?.company_name} {item.owner?.profile?.verification_status === 'verified' && '· ✓ Verified'}</div>{item.owner?.userId === session.user.id && <button type="button" className="btn btn-ghost" onClick={() => closeItem(item.id)}>Close opportunity</button>}{item.owner?.userId !== session.user.id && connectingId !== item.id && <button type="button" className="btn btn-primary" disabled={!canConnect} onClick={() => { setConnectingId(item.id); setIntro(`Hi ${item.owner?.profile?.company_name || 'there'}, I am interested in “${item.title}”. I believe there may be a strong fit and would like to explore it together.`); }}>Request connection</button>}{connectingId === item.id && <div className="opportunity-intro"><label className="label">Review your introduction</label><textarea className="textarea" value={intro} onChange={(event) => setIntro(event.target.value)} /><div className="community-actions"><button type="button" className="btn btn-primary" onClick={() => sendIntro(item)}>Send request</button><button type="button" className="btn btn-ghost" onClick={() => setConnectingId(null)}>Cancel</button></div></div>}{item.owner?.userId !== session.user.id && <button type="button" className="mini-action report-action" onClick={() => setReportingId(reportingId === item.id ? null : item.id)}>Report</button>}{reportingId === item.id && <div className="report-form"><label className="label">Reason for moderator review</label><input className="input" value={reportReason} onChange={(event) => setReportReason(event.target.value)} /><button type="button" className="btn btn-ghost" onClick={() => reportItem(item.id)}>Submit report</button></div>}</article>)}</div>
      </section>
      <aside className="card opportunity-compose"><div className="card-label">Post an opportunity</div>{!canPublish && <p className="compose-message">Set your profile to Ready and complete moderator verification to publish.</p>}<form onSubmit={submit}><label className="label">Type</label><select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="fundraising">Fundraising</option><option value="investment">Investment</option><option value="pilot">Pilot</option><option value="partnership">Partnership</option></select><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Seed round for climate intelligence" /><label className="label">What are you looking for?</label><textarea className="textarea" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /><button type="submit" className="btn btn-primary" disabled={!canPublish}>Publish for 30 days</button></form>{message && <p className="compose-message">{message}</p>}</aside>
    </main>
  );
}
