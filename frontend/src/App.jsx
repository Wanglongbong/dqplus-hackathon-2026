import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import AuthGate from './views/AuthGate.jsx';
import ProfileForm from './views/ProfileForm.jsx';
import Matches from './views/Matches.jsx';
import MatchDetail from './views/MatchDetail.jsx';
import ConnectionInbox from './views/ConnectionInbox.jsx';
import OpportunityBoard from './views/OpportunityBoard.jsx';
import AdminPanel from './views/AdminPanel.jsx';
import { genDraft } from './lib/draft.js';
import {
  ApiError, closeOpportunity, createOpportunity, fromProfile, getAdminReview, getMatches, getProfile,
  listConnections, listOpportunities, matchToCandidate, refreshProfile, reportConnection, requestConnection,
  reportOpportunity, reviewProfile, reviewReport, saveProfile, sendMatchFeedback, toProfilePayload, updateConnection,
} from './lib/api.js';

const SESSION_KEY = 'vn.session.v2';
const emptyForm = {
  name: '', website: '', linkedin: '', stage: '', geography: '', sectors: [], description: '',
  email: '', phone: '', fundingAsk: '', checkSizeMin: '', checkSizeMax: '', traction: '',
  thesis: '', portfolio: '', yearFounded: '', companySize: '', visibility: 'community', consent: false,
};

function readSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
}

function storeSession(value) {
  if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else sessionStorage.removeItem(SESSION_KEY);
}

export default function App() {
  const [session, setSession] = useState(readSession);
  const [form, setForm] = useState(emptyForm);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('form');
  const [status, setStatus] = useState('draft');
  const [savedAt, setSavedAt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [matches, setMatches] = useState({ status: 'idle', items: [], error: '' });
  const [topK, setTopK] = useState(5);
  const [selected, setSelected] = useState(null);
  const [emailLang, setEmailLang] = useState('vi');
  const [copied, setCopied] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const role = session?.user.role || 'founder';
  const investor = role === 'investor';

  useEffect(() => {
    if (!session) return;
    getProfile(session.token).then((item) => {
      setProfile(item); setForm({ ...emptyForm, ...fromProfile(item) }); setStatus(item.profile_status || 'draft');
    }).catch((error) => {
      if (error instanceof ApiError && error.status === 401) logout();
      else if (!(error instanceof ApiError && error.status === 404)) setSaveError(error.message);
    });
  }, [session?.token]);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    const poll = () => listConnections(session.token, 'inbox').then((result) => {
      if (active) setNotificationCount((result.connections || []).filter((item) => item.status === 'pending').length);
    }).catch(() => {});
    poll();
    const timer = window.setInterval(poll, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session?.token]);

  const validity = useMemo(() => {
    const number = (value) => value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
    const result = {
      name: form.name.trim().length > 1,
      website: /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}/i.test(form.website.trim()),
      stage: Boolean(form.stage), geography: form.geography.trim().length > 1,
      sectors: form.sectors.length > 0, email: /^\S+@\S+\.\S+$/.test(form.email.trim()),
      description: (investor ? form.thesis : form.description).trim().length >= 20,
      consent: form.consent === true,
    };
    if (investor) {
      result.checkSizeMin = number(form.checkSizeMin);
      result.checkSizeMax = number(form.checkSizeMax) && Number(form.checkSizeMax) >= Number(form.checkSizeMin);
    } else {
      result.fundingAsk = number(form.fundingAsk);
      result.traction = form.traction.trim().length >= 5;
      result.yearFounded = /^\d{4}$/.test(form.yearFounded) && Number(form.yearFounded) <= new Date().getFullYear();
      result.companySize = number(form.companySize);
    }
    return result;
  }, [form, investor]);

  const missingLabels = {
    name: investor ? 'fund name' : 'startup name', website: 'company website', stage: 'stage',
    geography: 'geography', sectors: 'sectors', email: 'work email', description: investor ? 'investment thesis' : 'product description',
    consent: 'consent', checkSizeMin: 'minimum ticket', checkSizeMax: 'maximum ticket', fundingAsk: 'funding ask',
    traction: 'traction', yearFounded: 'year founded', companySize: 'team size',
  };
  const missing = Object.keys(validity).filter((key) => !validity[key]).map((key) => missingLabels[key]);

  function handleAuthed(next) { setSession(next); storeSession(next); setView('form'); }
  function logout() { setSession(null); storeSession(null); setProfile(null); setForm(emptyForm); setMatches({ status: 'idle', items: [], error: '' }); setView('form'); }
  function onField(key, value) { setForm((current) => ({ ...current, [key]: value })); setStatus('draft'); setSavedAt(0); }
  function toggleSector(id) { setForm((current) => ({ ...current, sectors: current.sectors.includes(id) ? current.sectors.filter((item) => item !== id) : [...current.sectors, id] })); setStatus('draft'); }

  async function persist(nextStatus) {
    setSaving(true); setSaveError('');
    try {
      const saved = await saveProfile(session.token, profile?.id, toProfilePayload(form, nextStatus));
      setProfile(saved); setStatus(saved.profile_status); setForm((current) => ({ ...current, consent: Boolean(saved.consented_at) })); setSavedAt(Date.now());
      if (!session.user.profileId) {
        const next = { ...session, user: { ...session.user, profileId: saved.id } }; setSession(next); storeSession(next);
      }
      return saved;
    } catch (error) { setSaveError(error.message); return null; } finally { setSaving(false); }
  }

  async function saveDraft() { await persist('draft'); }
  async function markReady() {
    if (missing.length) { setShowErrors(true); return; }
    setShowErrors(false);
    const saved = await persist('ready');
    if (!saved) return;
    setMatches({ status: 'loading', items: [], error: '' });
    try { await refreshProfile(session.token); await loadMatches(); setView('matches'); }
    catch (error) { setMatches({ status: 'error', items: [], error: error.message }); setView('matches'); }
  }

  async function loadMatches() {
    setMatches({ status: 'loading', items: [], error: '' });
    try {
      const result = await getMatches(session.token);
      setMatches({ status: 'ready', items: (result.matches || []).map((item) => matchToCandidate(item, role)), error: '' });
    } catch (error) { setMatches({ status: 'error', items: [], error: error.message }); throw error; }
  }

  async function navigate(next) {
    if (next === 'matches' && status !== 'ready') {
      setShowErrors(true);
      setView('form');
      return;
    }
    if (next === 'matches' && status === 'ready' && matches.status === 'idle') {
      try { await loadMatches(); } catch { /* rendered by matches */ }
    }
    setView(next);
  }

  async function feedback(candidate, action) {
    await sendMatchFeedback(session.token, candidate.userId, action);
    if (action === 'not_relevant') setMatches((current) => ({ ...current, items: current.items.filter((item) => item.userId !== candidate.userId) }));
    else setMatches((current) => ({ ...current, items: current.items.map((item) => item.userId === candidate.userId ? { ...item, saved: true } : item) }));
  }

  function draftFor(candidate) {
    return genDraft({ who: form.name, need: investor ? form.thesis : form.description, candidate, lang: emailLang, intent: investor ? 'investment' : 'investors' });
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  }

  if (!session) return <AuthGate onAuthed={handleAuthed} />;

  const shown = topK >= matches.items.length ? matches.items : matches.items.slice(0, topK);
  const matchItems = shown.map((candidate, index) => ({ candidate, rank: index + 1 }));
  const title = investor ? 'Startups that fit your thesis.' : 'Investors that fit your round.';
  const sub = investor ? 'Verified founders ranked against your investment criteria.' : 'Verified capital partners ranked against your company and raise.';

  return (
    <div className="vn-shell">
      <Header session={session} status={status} verification={profile?.verification_status} view={view} notificationCount={notificationCount} onNavigate={navigate} onLogout={logout} />
      {view === 'form' && <ProfileForm role={role} form={form} onField={onField} onToggleSector={toggleSector} status={status} verification={profile?.verification_status} savedAt={savedAt} saving={saving} saveError={saveError} showErrors={showErrors} validity={validity} missing={missing} onSaveDraft={saveDraft} onReady={markReady} />}
      {view === 'matches' && <Matches role={role} matchStatus={matches.status} matchError={matches.error} onRetry={loadMatches} topK={topK} onTopK={setTopK} items={matchItems} total={matches.items.length} title={title} sub={sub} onOpen={({ candidate }) => { setSelected(candidate); setCopied(false); setView('detail'); }} onBackToForm={() => setView('form')} onFeedback={feedback} />}
      {view === 'detail' && selected && <MatchDetail candidate={selected} rank={matches.items.indexOf(selected) + 1} emailLang={emailLang} onLang={(lang) => { setEmailLang(lang); setCopied(false); }} copied={copied} onCopy={copyText} draftText={draftFor(selected)} canRequest={profile?.verification_status === 'verified'} onBack={() => setView('matches')} onRequest={(payload) => requestConnection(session.token, payload)} />}
      {view === 'connections' && <ConnectionInbox load={(box) => listConnections(session.token, box)} onAction={(id, action) => updateConnection(session.token, id, action)} onReport={(id, reason) => reportConnection(session.token, id, reason)} />}
      {view === 'opportunities' && <OpportunityBoard session={session} canPublish={profile?.profile_status === 'ready' && profile?.verification_status === 'verified' && profile?.visibility === 'community'} canConnect={profile?.verification_status === 'verified'} load={(type) => listOpportunities(session.token, type)} create={(payload) => createOpportunity(session.token, payload)} close={(id) => closeOpportunity(session.token, id)} report={(id, reason) => reportOpportunity(session.token, id, reason)} connect={(item, message) => requestConnection(session.token, { receiverUserId: item.owner.userId, intent: item.type, message })} />}
      {view === 'admin' && session.user.isAdmin && <AdminPanel load={() => getAdminReview(session.token)} reviewProfile={(id, nextStatus) => reviewProfile(session.token, id, nextStatus)} reviewReport={(id, action) => reviewReport(session.token, id, 'resolved', action)} />}
    </div>
  );
}
