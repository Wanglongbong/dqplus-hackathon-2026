const net = require('node:net');

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'protonmail.com',
]);

function emailDomain(email = '') {
  const parts = String(email).trim().toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
}

function websiteDomain(value = '') {
  try {
    const input = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(input).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizePublicUrl(value = '') {
  try {
    const input = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (url.username || url.password) return '';
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return '';
    if (net.isIPv4(hostname)) {
      const [a, b] = hostname.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return '';
    }
    if (net.isIPv6(hostname) && (hostname === '::1' || hostname === '::' || /^f[cd]/.test(hostname) || /^fe[89ab]/.test(hostname))) return '';
    if (!net.isIP(hostname) && !hostname.includes('.')) return '';
    return url.toString();
  } catch { return ''; }
}

function normalizeLinkedInUrl(value = '') {
  const normalized = normalizePublicUrl(value);
  if (!normalized) return '';
  const hostname = new URL(normalized).hostname.toLowerCase();
  return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com') ? normalized : '';
}

function evaluateVerification({ email, websites = [] }) {
  const domain = emailDomain(email);
  const websiteDomains = websites.map(websiteDomain).filter(Boolean);
  const matchesWebsite = domain && websiteDomains.some((site) => site === domain || site.endsWith(`.${domain}`) || domain.endsWith(`.${site}`));

  if (matchesWebsite && !PERSONAL_DOMAINS.has(domain)) {
    return { verification_status: 'pending', verification_method: 'domain_match_pending', verified_at: null };
  }
  if (email && websiteDomains.length) {
    return { verification_status: 'pending', verification_method: 'manual_review', verified_at: null };
  }
  return { verification_status: 'unverified', verification_method: null, verified_at: null };
}

module.exports = { evaluateVerification, emailDomain, websiteDomain, normalizePublicUrl, normalizeLinkedInUrl };
