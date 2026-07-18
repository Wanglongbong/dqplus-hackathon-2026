const crypto = require('node:crypto');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const { SESSION_FEE_VND, assertSessionAccess, httpError } = require('./coffeeSession.service');

function canonicalize(data) {
  return Object.keys(data || {}).sort().map((key) => {
    const value = data[key];
    const serialized = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `${key}=${serialized}`;
  }).join('&');
}

function signPayOS(data, checksumKey) {
  return crypto.createHmac('sha256', checksumKey).update(canonicalize(data)).digest('hex');
}

function verifyPayOSSignature(data, signature, checksumKey) {
  if (!signature || !checksumKey) return false;
  const expected = signPayOS(data, checksumKey);
  const actual = String(signature).toLowerCase();
  return expected.length === actual.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

async function createCheckout(sessionId, investorUserId) {
  const session = await assertSessionAccess(sessionId, investorUserId);
  if (session.investor_user_id !== investorUserId) throw httpError(403, 'Only the investor can pay for this session');
  if (!['threshold_met', 'awaiting_payment'].includes(session.status)) throw httpError(409, 'Payment opens after at least 3 startups accept');
  const existing = await sequelize.query(`
    SELECT * FROM payments WHERE session_id = :sessionId AND status IN ('pending', 'paid') ORDER BY created_at DESC LIMIT 1
  `, { replacements: { sessionId }, type: QueryTypes.SELECT });
  if (existing[0]) return existing[0];

  const provider = process.env.PAYMENT_PROVIDER || (process.env.NODE_ENV === 'production' ? 'payos' : 'mock');
  if (provider === 'mock' && process.env.NODE_ENV === 'production') throw httpError(503, 'Mock payments are disabled in production');
  const orderCode = Date.now();
  const returnBase = process.env.PUBLIC_WEB_URL || 'http://localhost:5173';
  let checkoutUrl;
  let paymentLinkId = null;

  if (provider === 'payos') {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
    if (!clientId || !apiKey || !checksumKey) throw httpError(503, 'PayOS is not configured');
    const requestData = {
      orderCode,
      amount: SESSION_FEE_VND,
      description: `VNX ${sessionId.slice(0, 8)}`,
      cancelUrl: `${returnBase}/coffee-chat?payment=cancelled&session=${sessionId}`,
      returnUrl: `${returnBase}/coffee-chat?payment=returned&session=${sessionId}`,
    };
    const response = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client-id': clientId, 'x-api-key': apiKey },
      body: JSON.stringify({ ...requestData, signature: signPayOS(requestData, checksumKey) }),
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.code !== '00' || !payload.data?.checkoutUrl) throw httpError(502, payload.desc || 'Could not create PayOS checkout');
    checkoutUrl = payload.data.checkoutUrl;
    paymentLinkId = payload.data.paymentLinkId || null;
  } else {
    checkoutUrl = `${returnBase}/coffee-chat?payment=mock&session=${sessionId}`;
  }

  const rows = await sequelize.query(`
    INSERT INTO payments (session_id, investor_user_id, provider, provider_order_code, provider_payment_link_id, amount_vnd, status, checkout_url)
    VALUES (:sessionId, :investorUserId, :provider, :orderCode, :paymentLinkId, :amount, 'pending', :checkoutUrl)
    RETURNING *
  `, { replacements: { sessionId, investorUserId, provider, orderCode, paymentLinkId, amount: SESSION_FEE_VND, checkoutUrl }, type: QueryTypes.SELECT });
  await sequelize.query("UPDATE coffee_sessions SET status = 'awaiting_payment', updated_at = now() WHERE id = :sessionId AND status = 'threshold_met'", { replacements: { sessionId } });
  return rows[0];
}

async function processPayOSWebhook(payload) {
  const { data, signature } = payload || {};
  if (!verifyPayOSSignature(data, signature, process.env.PAYOS_CHECKSUM_KEY)) throw httpError(401, 'Invalid PayOS signature');
  const orderCode = Number(data?.orderCode);
  if (!Number.isSafeInteger(orderCode)) throw httpError(400, 'Invalid PayOS order code');
  const eventKey = [data.paymentLinkId || '', data.code || '', data.reference || '', orderCode].join(':');
  return sequelize.transaction(async (transaction) => {
    const rows = await sequelize.query('SELECT * FROM payments WHERE provider_order_code = :orderCode FOR UPDATE', { replacements: { orderCode }, type: QueryTypes.SELECT, transaction });
    const payment = rows[0];
    if (!payment) throw httpError(404, 'Payment not found');
    if (payment.webhook_event_key === eventKey) return { duplicate: true, payment };
    const paid = String(data.code) === '00';
    const updatedRows = await sequelize.query(`
      UPDATE payments SET status = :status, paid_at = CASE WHEN :paid THEN COALESCE(paid_at, now()) ELSE paid_at END,
        webhook_event_key = :eventKey, raw_webhook = :rawWebhook, updated_at = now()
      WHERE id = :paymentId RETURNING *
    `, { replacements: { status: paid ? 'paid' : 'cancelled', paid, eventKey, rawWebhook: JSON.stringify(payload), paymentId: payment.id }, type: QueryTypes.SELECT, transaction });
    if (paid) {
      await sequelize.query(`
        UPDATE coffee_sessions SET status = CASE WHEN selected_slot_id IS NOT NULL AND venue_id IS NOT NULL THEN 'confirmed' ELSE 'paid' END,
          confirmed_at = CASE WHEN selected_slot_id IS NOT NULL AND venue_id IS NOT NULL THEN now() ELSE confirmed_at END,
          updated_at = now()
        WHERE id = :sessionId
      `, { replacements: { sessionId: payment.session_id }, transaction });
    }
    return { duplicate: false, payment: updatedRows[0] };
  });
}

module.exports = { canonicalize, signPayOS, verifyPayOSSignature, createCheckout, processPayOSWebhook };
