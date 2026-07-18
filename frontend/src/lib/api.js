const ROOT = import.meta.env.VITE_API_BASE || '/api';
const BACKEND = ROOT + '/backend';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isNetworkError(error) {
  return error instanceof TypeError || error?.name === 'TimeoutError' || error?.name === 'AbortError';
}

async function request(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new ApiError(data?.error || 'Request failed', res.status);
  return data;
}

export function login({ email, password }) {
  return request(BACKEND + '/auth/login', { method: 'POST', body: { username: email, password } });
}

export function register({ email, password, role }) {
  return request(BACKEND + '/auth/register', {
    method: 'POST', body: { username: email, password, role: role === 'investor' ? 'investor' : 'founder' },
  });
}

export function getProfile(token) {
  return request(BACKEND + '/profiles/me', { token });
}

export function saveProfile(token, profileId, payload) {
  return request(BACKEND + (profileId ? '/profiles/me' : '/profiles'), {
    method: profileId ? 'PATCH' : 'POST', token, body: payload,
  });
}

export function refreshProfile(token) {
  return request(BACKEND + '/discovery/refresh', { method: 'POST', token });
}

export function getMatches(token, filters = {}) {
  const query = new URLSearchParams({ limit: '50', ...filters });
  return request(BACKEND + '/discovery/matches?' + query.toString(), { token });
}

export function sendMatchFeedback(token, candidateUserId, action, reason = '') {
  return request(BACKEND + '/discovery/feedback', { method: 'POST', token, body: { candidateUserId, action, reason } });
}

export function listConnections(token, box = 'all') {
  return request(BACKEND + '/connections?box=' + box, { token });
}

export function requestConnection(token, payload) {
  return request(BACKEND + '/connections', { method: 'POST', token, body: payload });
}

export function updateConnection(token, id, action) {
  return request(BACKEND + '/connections/' + id, { method: 'PATCH', token, body: { action } });
}

export function reportConnection(token, id, reason, details = '') {
  return request(BACKEND + '/connections/' + id + '/report', { method: 'POST', token, body: { reason, details } });
}

export function listOpportunities(token, type = '') {
  return request(BACKEND + '/opportunities' + (type ? '?type=' + encodeURIComponent(type) : ''), { token });
}

export function createOpportunity(token, payload) {
  return request(BACKEND + '/opportunities', { method: 'POST', token, body: payload });
}

export function closeOpportunity(token, id) {
  return request(BACKEND + '/opportunities/' + id, { method: 'PATCH', token, body: { action: 'close' } });
}

export function reportOpportunity(token, id, reason, details = '') {
  return request(BACKEND + '/opportunities/' + id + '/report', { method: 'POST', token, body: { reason, details } });
}

export function getAdminReview(token) {
  return request(BACKEND + '/admin/review', { token });
}

export function reviewProfile(token, id, status) {
  return request(BACKEND + '/admin/profiles/' + id + '/verification', { method: 'PATCH', token, body: { status } });
}

export function reviewReport(token, id, status = 'resolved', action) {
  return request(BACKEND + '/admin/reports/' + id, { method: 'PATCH', token, body: { status, action } });
}

export function toProfilePayload(form, status) {
  return {
    company_name: form.name,
    stage: form.stage,
    industry: form.sectors.join(','),
    where_you_operate: form.geography,
    website: form.website.split(',').map((value) => value.trim()).filter(Boolean),
    description_product: form.description,
    email: form.email || null,
    phone_number: form.phone || null,
    linkedin_url: form.linkedin || null,
    funding_ask_usd: form.fundingAsk === '' ? null : Number(form.fundingAsk),
    check_size_min_usd: form.checkSizeMin === '' ? null : Number(form.checkSizeMin),
    check_size_max_usd: form.checkSizeMax === '' ? null : Number(form.checkSizeMax),
    traction_summary: form.traction || null,
    investment_thesis: form.thesis || null,
    portfolio_highlights: form.portfolio || null,
    year_founded: form.yearFounded === '' ? null : Number(form.yearFounded),
    num_of_employees: form.companySize === '' ? null : Number(form.companySize),
    profile_status: status,
    visibility: form.visibility,
    consent_version: form.consent ? 'community-v1' : null,
  };
}

export function fromProfile(profile) {
  return {
    name: profile.company_name || '',
    website: (profile.website || []).join(', '),
    linkedin: profile.linkedin_url || '',
    stage: profile.stage || '',
    geography: profile.where_you_operate || '',
    sectors: profile.industry ? profile.industry.split(',').map((value) => value.trim()).filter(Boolean) : [],
    description: profile.description_product || '',
    email: profile.email || '',
    phone: profile.phone_number || '',
    fundingAsk: profile.funding_ask_usd == null ? '' : String(profile.funding_ask_usd),
    checkSizeMin: profile.check_size_min_usd == null ? '' : String(profile.check_size_min_usd),
    checkSizeMax: profile.check_size_max_usd == null ? '' : String(profile.check_size_max_usd),
    traction: profile.traction_summary || '',
    thesis: profile.investment_thesis || '',
    portfolio: profile.portfolio_highlights || '',
    yearFounded: profile.year_founded == null ? '' : String(profile.year_founded),
    companySize: profile.num_of_employees == null ? '' : String(profile.num_of_employees),
    visibility: profile.visibility || 'community',
    consent: Boolean(profile.consented_at),
  };
}

const cap = (value) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

export function matchToCandidate(match, viewerRole) {
  const attributes = match.attributes || {};
  const investor = viewerRole !== 'investor';
  return {
    userId: match.userId,
    name: investor ? (attributes.firm_name || 'Unnamed investor') : (attributes.company_name || 'Unnamed startup'),
    type: investor ? 'Investor' : `Startup${attributes.stage ? ' · ' + cap(attributes.stage) : ''}`,
    dot: investor ? '#b08636' : '#3f8f6b',
    sectors: (investor ? attributes.sectors : attributes.industry || []).map(cap),
    score: Math.max(0, Math.min(100, Math.round(match.score * 100))),
    vectorScore: Math.max(0, Math.min(100, Math.round(match.vectorScore * 100))),
    attributeScore: Math.max(0, Math.min(100, Math.round(match.attributeScore * 100))),
    confidence: Math.max(0, Math.min(100, Math.round((match.confidence || 0) * 100))),
    reasons: match.reasons || [],
    missingSignals: match.missingSignals || [],
    sources: attributes.evidence || [],
    saved: Boolean(match.saved),
    verified: attributes.verification_status === 'verified',
    rationale: match.reasons?.length
      ? match.reasons.map(cap).join(' · ')
      : 'Potential fit based on profile similarity; more data is needed.',
  };
}
