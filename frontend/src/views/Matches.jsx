import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReduced } from '../lib/anim.js';
import './matches.css';

export default function Matches({ role, matchStatus, matchError, onRetry, topK, onTopK, items, total, title, sub, onOpen, onBackToForm, onFeedback }) {
  const rootRef = useRef(null);
  useGSAP(() => {
    if (prefersReduced() || !rootRef.current) return;
    gsap.from(rootRef.current.querySelectorAll('.vn-match-card'), { y: 14, autoAlpha: 0, duration: 0.4, stagger: 0.04, clearProps: 'all' });
  }, { scope: rootRef, dependencies: [topK, matchStatus] });

  return (
    <main className="vn-match-root" ref={rootRef}>
      <button type="button" className="link link-button" onClick={onBackToForm}>← Improve profile</button>
      <div className="eyebrow vn-match-eyebrow">Verified discovery · {role === 'investor' ? 'startup dealflow' : 'investor fit'}</div>
      <h1 className="serif-h1 vn-match-h1">{title}</h1>
      <p className="lede vn-match-lede">{sub} Scores are estimates; every result shows evidence and missing data.</p>

      {matchStatus === 'loading' && <div className="card vn-match-empty"><p>Refreshing evidence and ranking your matches…</p></div>}
      {matchStatus === 'error' && <div className="card vn-match-empty"><p>{matchError}</p><button type="button" className="btn btn-ghost" onClick={onRetry}>Try again</button></div>}
      {matchStatus === 'ready' && !items.length && <div className="card vn-match-empty"><p>No verified matches yet. More members will appear as they complete their profiles.</p></div>}

      {matchStatus === 'ready' && items.length > 0 && (
        <>
          <div className="vn-match-count-row">
            <span className="vn-match-count">Showing {items.length} of {total} trusted matches</span>
            <div className="seg vn-match-seg">
              {[5, 10].map((count) => <button key={count} type="button" className={'seg-btn' + (topK === count ? ' active' : '')} onClick={() => onTopK(count)}>Top {count}</button>)}
              <button type="button" className={'seg-btn' + (topK >= total ? ' active' : '')} onClick={() => onTopK(999)}>All</button>
            </div>
          </div>
          <div className="vn-match-list">
            {items.map(({ candidate, rank }) => (
              <article key={candidate.userId} className="vn-match-card rise">
                <div className="vn-match-rank">#{rank}</div>
                <div className="vn-match-score" aria-label={`Estimated fit ${candidate.score} out of 100`}>{candidate.score}</div>
                <button type="button" className="vn-match-body-button" onClick={() => onOpen({ candidate, rank })}>
                  <span className="vn-match-type"><span className="dot" style={{ background: candidate.dot }} />{candidate.type}{candidate.verified && ' · Verified'}</span>
                  <strong className="vn-match-name">{candidate.name}</strong>
                  <span className="vn-match-rationale">{candidate.rationale}</span>
                  <span className="vn-match-confidence">Confidence {candidate.confidence}% · {candidate.sources.length} source{candidate.sources.length === 1 ? '' : 's'}</span>
                </button>
                <div className="vn-match-actions">
                  <button type="button" className={`mini-action${candidate.saved ? ' active' : ''}`} onClick={() => onFeedback(candidate, 'saved')}>{candidate.saved ? '✓ Saved' : 'Save'}</button>
                  <button type="button" className="mini-action" onClick={() => onFeedback(candidate, 'not_relevant')}>Not relevant</button>
                  <button type="button" className="vn-match-analysis" onClick={() => onOpen({ candidate, rank })}>Analysis →</button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
