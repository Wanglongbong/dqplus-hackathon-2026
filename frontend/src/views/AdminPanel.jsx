import { useEffect, useState } from 'react';
import './community.css';

export default function AdminPanel({ load, reviewProfile, reviewReport }) {
  const [state, setState] = useState({ profiles: [], reports: [], error: '' });
  async function refresh() {
    try { setState({ ...(await load()), error: '' }); } catch (error) { setState({ profiles: [], reports: [], error: error.message }); }
  }
  useEffect(() => { refresh(); }, []);
  async function verify(id, status) { await reviewProfile(id, status); await refresh(); }
  async function resolve(id, action) { await reviewReport(id, action); await refresh(); }
  return <main className="community-page"><div className="eyebrow">Community operations</div><h1 className="serif-h1">Trust & safety review</h1><p className="lede">Review company identities and member reports.</p>{state.error && <div className="card community-alert">{state.error}</div>}<h2 className="admin-section-title">Pending verification · {state.profiles.length}</h2><div className="community-list">{state.profiles.map((profile) => <article className="card" key={profile.id}><div className="card-label">{profile.owner?.role} · {profile.owner?.username} · {profile.verification_method || 'manual review'}</div><h2>{profile.company_name}</h2><p>{(profile.website || []).join(', ')}</p><div className="community-actions"><button type="button" className="btn btn-primary" onClick={() => verify(profile.id, 'verified')}>Verify</button><button type="button" className="btn btn-ghost" onClick={() => verify(profile.id, 'unverified')}>Reject</button></div></article>)}</div><h2 className="admin-section-title">Open reports · {state.reports.length}</h2><div className="community-list">{state.reports.map((report) => <article className="card" key={report.id}><div className="card-label">{report.reason} · reporter {report.reporter?.username || 'unknown'} · target {report.target?.username || 'unknown'}</div>{report.opportunity && <h2>Opportunity: {report.opportunity.title}</h2>}{report.connection && <h2>Connection: {report.connection.intent}</h2>}<p>{report.details || 'No additional details.'}</p><div className="community-actions"><button type="button" className="btn btn-ghost" onClick={() => resolve(report.id)}>Resolve</button>{report.opportunity && <button type="button" className="btn btn-primary" onClick={() => resolve(report.id, 'close_opportunity')}>Close opportunity & resolve</button>}</div></article>)}</div></main>;
}
