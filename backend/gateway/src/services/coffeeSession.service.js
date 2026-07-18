const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

const SESSION_FEE_VND = 1490000;
const MINIMUM_ACCEPTANCES = 3;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateSessionInput({ dealIds, slots }, now = new Date()) {
  if (!Array.isArray(dealIds) || dealIds.length !== 5 || new Set(dealIds).size !== 5) {
    throw httpError(400, 'Select exactly 5 unique startups');
  }
  if (!Array.isArray(slots) || slots.length !== 3) throw httpError(400, 'Propose exactly 3 time slots');
  const minimum = now.getTime() + (2 * 24 * 60 * 60 * 1000);
  const maximum = now.getTime() + (21 * 24 * 60 * 60 * 1000);
  const normalized = slots.map((slot) => {
    const startsAt = new Date(slot?.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw httpError(400, 'Every slot requires a valid startsAt');
    if (Number(slot.durationMinutes) !== 90) throw httpError(400, 'Every Coffee & Chat slot is 90 minutes');
    if (startsAt.getTime() < minimum || startsAt.getTime() > maximum) throw httpError(400, 'Slots must be 2–21 days in the future');
    return { startsAt: startsAt.toISOString(), durationMinutes: 90 };
  });
  if (new Set(normalized.map((slot) => slot.startsAt)).size !== 3) throw httpError(400, 'Time slots must be unique');
  return { dealIds, slots: normalized };
}

function canCheckInStatus(status) {
  return ['paid', 'confirmed'].includes(status);
}

async function createSession(investorUserId, input) {
  const { dealIds, slots } = validateSessionInput(input);
  return sequelize.transaction(async (transaction) => {
    const deals = await sequelize.query(`
      SELECT id, owner_user_id FROM deal_profiles
      WHERE id IN (:dealIds) AND status = 'published' AND is_stale = false
    `, { replacements: { dealIds }, type: QueryTypes.SELECT, transaction });
    if (deals.length !== 5) throw httpError(400, 'One or more deals are unavailable');

    const [session] = await sequelize.query(`
      INSERT INTO coffee_sessions (investor_user_id, status, fee_vnd, minimum_acceptances)
      VALUES (:investorUserId, 'inviting', :fee, :minimum)
      RETURNING *
    `, { replacements: { investorUserId, fee: SESSION_FEE_VND, minimum: MINIMUM_ACCEPTANCES }, type: QueryTypes.SELECT, transaction });

    await sequelize.query(`
      INSERT INTO session_participants (session_id, participant_user_id, role, status)
      VALUES (:sessionId, :investorUserId, 'investor', 'accepted')
    `, { replacements: { sessionId: session.id, investorUserId }, transaction });

    for (const deal of deals) {
      await sequelize.query(`
        INSERT INTO session_participants (session_id, deal_profile_id, participant_user_id, role, status)
        VALUES (:sessionId, :dealId, :ownerUserId, 'startup', 'invited')
      `, { replacements: { sessionId: session.id, dealId: deal.id, ownerUserId: deal.owner_user_id }, transaction });
    }
    for (const slot of slots) {
      await sequelize.query(`
        INSERT INTO session_slots (session_id, starts_at, duration_minutes)
        VALUES (:sessionId, :startsAt, 90)
      `, { replacements: { sessionId: session.id, startsAt: slot.startsAt }, transaction });
    }
    return getSession(session.id, investorUserId, { transaction });
  });
}

async function assertSessionAccess(sessionId, userId, { transaction } = {}) {
  const rows = await sequelize.query(`
    SELECT cs.* FROM coffee_sessions cs
    LEFT JOIN session_participants sp ON sp.session_id = cs.id AND sp.participant_user_id = :userId
    WHERE cs.id = :sessionId AND (cs.investor_user_id = :userId OR sp.id IS NOT NULL)
    LIMIT 1
  `, { replacements: { sessionId, userId }, type: QueryTypes.SELECT, transaction });
  if (!rows[0]) throw httpError(404, 'Session not found');
  return rows[0];
}

async function getSession(sessionId, viewerUserId, { transaction, admin = false } = {}) {
  const sessionRows = admin
    ? await sequelize.query('SELECT * FROM coffee_sessions WHERE id = :sessionId LIMIT 1', { replacements: { sessionId }, type: QueryTypes.SELECT, transaction })
    : [await assertSessionAccess(sessionId, viewerUserId, { transaction })];
  const session = sessionRows[0];
  if (!session) throw httpError(404, 'Session not found');
  const slots = await sequelize.query('SELECT id, starts_at, duration_minutes FROM session_slots WHERE session_id = :sessionId ORDER BY starts_at', { replacements: { sessionId }, type: QueryTypes.SELECT, transaction });
  const participants = await sequelize.query(`
    SELECT sp.id, sp.role, sp.status, sp.available_slot_ids, sp.responded_at, sp.checked_in_at,
      sp.participant_user_id, dp.id AS deal_profile_id, dp.alias, dp.company_name,
      p.email, p.phone_number
    FROM session_participants sp
    LEFT JOIN deal_profiles dp ON dp.id = sp.deal_profile_id
    LEFT JOIN users u ON u.id = sp.participant_user_id
    LEFT JOIN profiles p ON p.id = u.profile_id
    WHERE sp.session_id = :sessionId
    ORDER BY CASE sp.role WHEN 'investor' THEN 0 WHEN 'startup' THEN 1 ELSE 2 END, sp.created_at
  `, { replacements: { sessionId }, type: QueryTypes.SELECT, transaction });
  const contactOpen = ['paid', 'confirmed', 'completed'].includes(session.status);
  const safeParticipants = participants.map((participant) => {
    const own = participant.participant_user_id === viewerUserId;
    const canSeeIdentity = admin || own || (participant.role === 'startup' && ['accepted', 'attended'].includes(participant.status));
    return {
      id: participant.id,
      role: participant.role,
      status: participant.status,
      alias: participant.alias,
      dealProfileId: participant.deal_profile_id,
      availableSlotIds: participant.available_slot_ids,
      respondedAt: participant.responded_at,
      checkedInAt: participant.checked_in_at,
      ...(canSeeIdentity ? { companyName: participant.company_name } : {}),
      ...((admin || own || (canSeeIdentity && contactOpen)) ? { email: participant.email, phoneNumber: participant.phone_number } : {}),
    };
  });
  const payments = viewerUserId === session.investor_user_id || admin
    ? await sequelize.query('SELECT id, provider, amount_vnd, status, checkout_url, paid_at FROM payments WHERE session_id = :sessionId ORDER BY created_at DESC', { replacements: { sessionId }, type: QueryTypes.SELECT, transaction })
    : [];
  return { ...session, slots, participants: safeParticipants, payments };
}

async function chooseWinningSlot(sessionId, transaction) {
  const rows = await sequelize.query(`
    SELECT ss.id, ss.starts_at, COUNT(sp.id)::int AS votes
    FROM session_slots ss
    LEFT JOIN session_participants sp
      ON sp.session_id = ss.session_id
      AND sp.role = 'startup'
      AND sp.status IN ('accepted', 'attended')
      AND ss.id = ANY(sp.available_slot_ids)
    WHERE ss.session_id = :sessionId
    GROUP BY ss.id, ss.starts_at
    ORDER BY votes DESC, ss.starts_at ASC
    LIMIT 1
  `, { replacements: { sessionId }, type: QueryTypes.SELECT, transaction });
  return rows[0] || null;
}

async function respondToInvite(sessionId, userId, { response, availableSlotIds = [] }) {
  if (!['accepted', 'declined'].includes(response)) throw httpError(400, 'Response must be accepted or declined');
  return sequelize.transaction(async (transaction) => {
    await assertSessionAccess(sessionId, userId, { transaction });
    const participantRows = await sequelize.query(`
      SELECT * FROM session_participants
      WHERE session_id = :sessionId AND participant_user_id = :userId AND role = 'startup'
      FOR UPDATE
    `, { replacements: { sessionId, userId }, type: QueryTypes.SELECT, transaction });
    if (!participantRows[0]) throw httpError(403, 'Only an invited startup can respond');
    if (response === 'accepted') {
      if (!Array.isArray(availableSlotIds) || availableSlotIds.length === 0) throw httpError(400, 'Choose at least one available slot');
      const valid = await sequelize.query('SELECT id FROM session_slots WHERE session_id = :sessionId AND id IN (:ids)', { replacements: { sessionId, ids: availableSlotIds }, type: QueryTypes.SELECT, transaction });
      if (valid.length !== new Set(availableSlotIds).size) throw httpError(400, 'Invalid session slot');
    }
    await sequelize.query(`
      UPDATE session_participants
      SET status = :response, available_slot_ids = :availableSlotIds, responded_at = now(), updated_at = now()
      WHERE id = :participantId
    `, { replacements: { response, availableSlotIds: response === 'accepted' ? availableSlotIds : [], participantId: participantRows[0].id }, transaction });
    const acceptedRows = await sequelize.query(`
      SELECT COUNT(*)::int AS count FROM session_participants
      WHERE session_id = :sessionId AND role = 'startup' AND status IN ('accepted', 'attended')
    `, { replacements: { sessionId }, type: QueryTypes.SELECT, transaction });
    const accepted = acceptedRows[0].count;
    if (accepted >= MINIMUM_ACCEPTANCES) {
      const winner = await chooseWinningSlot(sessionId, transaction);
      await sequelize.query(`
        UPDATE coffee_sessions
        SET status = CASE WHEN status IN ('inviting', 'threshold_met') THEN 'threshold_met' ELSE status END,
          selected_slot_id = :slotId, updated_at = now()
        WHERE id = :sessionId
      `, { replacements: { sessionId, slotId: winner?.id || null }, transaction });
    }
    return getSession(sessionId, userId, { transaction });
  });
}

async function listVenues(sessionId, userId) {
  await assertSessionAccess(sessionId, userId);
  return sequelize.query(`
    SELECT id, name, district, address, rating, suitability_score, capacity, notes, is_demo
    FROM venues WHERE is_active = true ORDER BY suitability_score DESC, rating DESC NULLS LAST LIMIT 3
  `, { type: QueryTypes.SELECT });
}

async function selectVenue(sessionId, userId, venueId) {
  const session = await assertSessionAccess(sessionId, userId);
  if (session.investor_user_id !== userId) throw httpError(403, 'Only the investor can choose a venue');
  const venue = await sequelize.query('SELECT id FROM venues WHERE id = :venueId AND is_active = true LIMIT 1', { replacements: { venueId }, type: QueryTypes.SELECT });
  if (!venue[0]) throw httpError(400, 'Venue is unavailable');
  await sequelize.query(`
    UPDATE coffee_sessions SET venue_id = :venueId,
      status = CASE WHEN status = 'paid' AND selected_slot_id IS NOT NULL THEN 'confirmed' ELSE status END,
      confirmed_at = CASE WHEN status = 'paid' AND selected_slot_id IS NOT NULL THEN now() ELSE confirmed_at END,
      updated_at = now() WHERE id = :sessionId
  `, { replacements: { venueId, sessionId } });
  return getSession(sessionId, userId);
}

async function checkIn(sessionId, adminUserId, participantIds) {
  if (!Array.isArray(participantIds) || participantIds.length === 0) throw httpError(400, 'participantIds are required');
  return sequelize.transaction(async (transaction) => {
    const sessionRows = await sequelize.query('SELECT status FROM coffee_sessions WHERE id = :sessionId FOR UPDATE', { replacements: { sessionId }, type: QueryTypes.SELECT, transaction });
    if (!sessionRows[0]) throw httpError(404, 'Session not found');
    if (!canCheckInStatus(sessionRows[0].status)) throw httpError(409, 'Check-in opens only after payment');
    await sequelize.query(`
      UPDATE session_participants SET status = 'attended', checked_in_at = now(), checked_in_by = :adminUserId, updated_at = now()
      WHERE session_id = :sessionId AND id IN (:participantIds) AND status = 'accepted'
    `, { replacements: { sessionId, participantIds, adminUserId }, transaction });
    const counts = await sequelize.query(`
      SELECT COUNT(*) FILTER (WHERE role = 'startup' AND status = 'attended')::int AS startups,
        COUNT(*) FILTER (WHERE role = 'investor' AND status IN ('accepted', 'attended'))::int AS investors
      FROM session_participants WHERE session_id = :sessionId
    `, { replacements: { sessionId }, type: QueryTypes.SELECT, transaction });
    if (counts[0].startups >= MINIMUM_ACCEPTANCES && counts[0].investors >= 1) {
      await sequelize.query("UPDATE coffee_sessions SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = :sessionId AND status IN ('paid', 'confirmed')", { replacements: { sessionId }, transaction });
      await sequelize.query(`
        UPDATE deal_profiles dp SET offline_meet_count = offline_meet_count + 1, last_met_at = now(), updated_at = now()
        FROM session_participants sp
        WHERE sp.session_id = :sessionId AND sp.deal_profile_id = dp.id AND sp.status = 'attended'
      `, { replacements: { sessionId }, transaction });
    }
    return getSession(sessionId, adminUserId, { transaction, admin: true });
  });
}

async function saveFeedback(sessionId, userId, { subjectDealProfileId, useful, privateNotes }) {
  await assertSessionAccess(sessionId, userId);
  const rows = await sequelize.query(`
    INSERT INTO offline_feedback (session_id, author_user_id, subject_deal_profile_id, useful, private_notes)
    VALUES (:sessionId, :userId, :subjectDealProfileId, :useful, :privateNotes)
    ON CONFLICT (session_id, author_user_id, subject_deal_profile_id)
    DO UPDATE SET useful = EXCLUDED.useful, private_notes = EXCLUDED.private_notes, updated_at = now()
    RETURNING id, session_id, subject_deal_profile_id, useful, private_notes, created_at, updated_at
  `, { replacements: { sessionId, userId, subjectDealProfileId: subjectDealProfileId || null, useful: useful ?? null, privateNotes: privateNotes || null }, type: QueryTypes.SELECT });
  return rows[0];
}

module.exports = {
  SESSION_FEE_VND, MINIMUM_ACCEPTANCES, validateSessionInput, createSession, getSession,
  respondToInvite, listVenues, selectVenue, checkIn, saveFeedback, assertSessionAccess, httpError, canCheckInStatus,
};
