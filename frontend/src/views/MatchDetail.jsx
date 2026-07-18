import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { riseIn, prefersReduced } from '../lib/anim.js';
import './matches.css';

export default function MatchDetail({ candidate, rank, emailLang, onLang, copied, onCopy, draftText, canRequest, onBack, onRequest }) {
  const rootRef = useRef(null);
  const scoreRef = useRef(null);
  const [intent, setIntent] = useState('fundraising');
  const [message, setMessage] = useState(draftText || '');
  const [requestState, setRequestState] = useState({ status: 'idle', message: '' });

  useEffect(() => setMessage(draftText || ''), [draftText]);
  useGSAP(() => {
    if (!rootRef.current) return;
    riseIn(rootRef.current);
    if (!prefersReduced() && scoreRef.current) gsap.from(scoreRef.current, { textContent: 0, duration: 0.7, snap: { textContent: 1 } });
  }, { scope: rootRef, dependencies: [candidate] });

  async function submitRequest() {
    setRequestState({ status: 'loading', message: '' });
    try {
      await onRequest({ receiverUserId: candidate.userId, intent, message });
      setRequestState({ status: 'success', message: 'Connection request sent. Contact stays private until they accept.' });
    } catch (error) {
      setRequestState({ status: 'error', message: error.message });
    }
  }

  return (
    <main className="vn-detail-root" ref={rootRef}>
      <button type="button" className="link link-button rise" onClick={onBack}>← All matches</button>
      <div className="vn-detail-header rise">
        <div>
          <div className="vn-detail-type"><span className="dot" style={{ background: candidate.dot }} />{candidate.type}{candidate.verified && ' · Verified'}</div>
          <h1 className="serif-h1 vn-detail-name">{candidate.name}</h1>
          <div className="vn-detail-sectors">{candidate.sectors.map((sector) => <span className="chip" key={sector}>{sector}</span>)}</div>
        </div>
        <div className="vn-detail-score-wrap"><div className="vn-detail-score"><span ref={scoreRef}>{candidate.score}</span></div><div className="vn-detail-score-caption">Estimated fit</div></div>
      </div>

      <section className="card rise vn-detail-section"><div className="card-label accent">Why this match</div><p className="vn-detail-rationale">{candidate.rationale}</p></section>
      <section className="card rise vn-detail-section">
        <div className="vn-detail-breakdown-head"><div className="card-label">Fit breakdown</div><div className="vn-detail-breakdown-meta">rank #{rank} · confidence {candidate.confidence}%</div></div>
        {[['Profile similarity', candidate.vectorScore], ['Attribute fit', candidate.attributeScore]].map(([label, value]) => (
          <div className="vn-detail-bar-row" key={label}><span>{label}</span><span className="vn-detail-bar-track"><i className="vn-detail-bar-fill" style={{ width: value + '%' }} /></span><b>{value}</b></div>
        ))}
      </section>

      {candidate.missingSignals.length > 0 && <section className="card rise vn-detail-section vn-warning-card"><div className="card-label">Confidence limits</div><p>Missing: {candidate.missingSignals.join(', ')}. Treat the score as directional until these fields are verified.</p></section>}

      <section className="card rise vn-detail-section">
        <div className="card-label vn-detail-facts-label">Evidence</div>
        {candidate.sources.length ? <div className="vn-detail-sources">{candidate.sources.map((source) => <a className="vn-detail-source" href={source.url} target="_blank" rel="noreferrer" key={source.url}><span>{source.label}</span><span className="vn-detail-source-open">Open source ↗</span></a>)}</div> : <div className="vn-detail-empty">No public source attached yet. Do not rely on this match without verification.</div>}
      </section>

      <section className="card rise vn-detail-section">
        <div className="vn-detail-draft-head"><div className="card-label">Editable introduction</div><div className="seg"><button type="button" className={'seg-btn' + (emailLang === 'vi' ? ' active' : '')} onClick={() => onLang('vi')}>Tiếng Việt</button><button type="button" className={'seg-btn' + (emailLang === 'en' ? ' active' : '')} onClick={() => onLang('en')}>English</button></div></div>
        <textarea className="textarea vn-request-message" value={message} onChange={(event) => setMessage(event.target.value)} />
        <div className="vn-request-row">
          <select className="select" value={intent} onChange={(event) => setIntent(event.target.value)}><option value="fundraising">Fundraising</option><option value="investment">Investment discussion</option><option value="pilot">Pilot</option><option value="partnership">Partnership</option></select>
          <button type="button" className="btn btn-ghost" onClick={() => onCopy(message)}>{copied ? '✓ Copied' : 'Copy'}</button>
          <button type="button" className="btn btn-primary" disabled={!canRequest || requestState.status === 'loading' || requestState.status === 'success'} onClick={submitRequest}>{requestState.status === 'loading' ? 'Sending…' : requestState.status === 'success' ? 'Request sent' : 'Request connection'}</button>
        </div>
        {!canRequest && <p className="inline-error">A moderator must verify your profile before you can send connection requests.</p>}
        {requestState.message && <p className={requestState.status === 'error' ? 'inline-error' : 'inline-success'}>{requestState.message}</p>}
      </section>
    </main>
  );
}
