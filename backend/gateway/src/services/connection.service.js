const { Op } = require('sequelize');
const { ConnectionRequest, Profile, Report, User } = require('../models');
const { publicProfileJson } = require('./profile.service');

const INTENTS = new Set(['fundraising', 'investment', 'pilot', 'partnership']);
const ACTIONS = new Set(['accept', 'decline', 'withdraw', 'save']);
const DAILY_LIMIT = Number(process.env.CONNECTION_DAILY_LIMIT) || 5;

const includePeople = [
  { model: User, as: 'sender', include: [{ model: Profile, as: 'profile' }] },
  { model: User, as: 'receiver', include: [{ model: Profile, as: 'profile' }] },
];

function contactFor(profile) {
  return profile ? { email: profile.email, phone: profile.phone_number, linkedinUrl: profile.linkedin_url } : null;
}

function personFor(user, includeContact = false) {
  if (!user) return null;
  return {
    userId: user.id,
    role: user.role,
    profile: user.profile ? publicProfileJson(user.profile) : null,
    contact: includeContact ? contactFor(user.profile) : null,
  };
}

function serialize(connection, viewerId) {
  const row = connection.toJSON ? connection.toJSON() : connection;
  const accepted = row.status === 'accepted';
  const isSender = row.senderUserId === viewerId;
  return {
    id: row.id,
    intent: row.intent,
    message: row.message,
    status: row.status,
    savedAt: row.savedAt,
    respondedAt: row.respondedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    direction: isSender ? 'sent' : 'received',
    peer: personFor(isSender ? row.receiver : row.sender, accepted),
  };
}

async function expirePending() {
  await ConnectionRequest.update(
    { status: 'expired', respondedAt: new Date() },
    { where: { status: 'pending', expiresAt: { [Op.lt]: new Date() } } },
  );
}

async function createConnection(senderUserId, data) {
  const receiverUserId = data.receiverUserId;
  const intent = data.intent;
  const message = String(data.message || '').trim();
  if (!receiverUserId || receiverUserId === senderUserId) {
    const err = new Error('Choose another community member');
    err.status = 400;
    throw err;
  }
  if (!INTENTS.has(intent)) {
    const err = new Error('Invalid connection intent');
    err.status = 400;
    throw err;
  }
  if (message.length < 20 || message.length > 2000) {
    const err = new Error('Introduction must be between 20 and 2000 characters');
    err.status = 400;
    throw err;
  }

  await expirePending();
  const [sender, receiver] = await Promise.all([
    User.findByPk(senderUserId, { include: [{ model: Profile, as: 'profile' }] }),
    User.findByPk(receiverUserId, { include: [{ model: Profile, as: 'profile' }] }),
  ]);
  if (!sender?.profile || sender.profile.verification_status !== 'verified') {
    const err = new Error('Verify your profile before requesting a connection');
    err.status = 403;
    throw err;
  }
  if (!receiver?.profile || receiver.profile.profile_status !== 'ready'
    || receiver.profile.verification_status !== 'verified' || receiver.profile.visibility !== 'community') {
    const err = new Error('This member is not available for connections');
    err.status = 404;
    throw err;
  }

  const active = await ConnectionRequest.findOne({
    where: {
      status: 'pending',
      [Op.or]: [
        { senderUserId, receiverUserId },
        { senderUserId: receiverUserId, receiverUserId: senderUserId },
      ],
    },
  });
  if (active) {
    const err = new Error('A connection request is already pending between these members');
    err.status = 409;
    throw err;
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const sentToday = await ConnectionRequest.count({ where: { senderUserId, createdAt: { [Op.gte]: dayStart } } });
  if (sentToday >= DAILY_LIMIT) {
    const err = new Error(`Daily connection limit reached (${DAILY_LIMIT})`);
    err.status = 429;
    throw err;
  }

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  let created;
  try {
    created = await ConnectionRequest.create({ senderUserId, receiverUserId, intent, message, expiresAt });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      const conflict = new Error('A connection request is already pending between these members');
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  }
  return serialize(await ConnectionRequest.findByPk(created.id, { include: includePeople }), senderUserId);
}

async function listConnections(userId, { box = 'all', status } = {}) {
  await expirePending();
  const where = {};
  if (box === 'inbox') where.receiverUserId = userId;
  else if (box === 'sent') where.senderUserId = userId;
  else where[Op.or] = [{ senderUserId: userId }, { receiverUserId: userId }];
  if (status) where.status = status;
  const rows = await ConnectionRequest.findAll({ where, include: includePeople, order: [['createdAt', 'DESC']] });
  return rows.map((row) => serialize(row, userId));
}

async function actOnConnection(userId, id, action) {
  if (!ACTIONS.has(action)) {
    const err = new Error('Invalid connection action');
    err.status = 400;
    throw err;
  }
  await expirePending();
  const connection = await ConnectionRequest.findByPk(id, { include: includePeople });
  if (!connection) {
    const err = new Error('Connection request not found');
    err.status = 404;
    throw err;
  }
  if (connection.status !== 'pending') {
    const err = new Error('This request is no longer pending');
    err.status = 409;
    throw err;
  }
  if (action === 'save') {
    if (connection.receiverUserId !== userId) {
      const err = new Error('Only the recipient can save this request');
      err.status = 403;
      throw err;
    }
    connection.savedAt = new Date();
  } else if (action === 'withdraw') {
    if (connection.senderUserId !== userId) {
      const err = new Error('Only the sender can withdraw this request');
      err.status = 403;
      throw err;
    }
    connection.status = 'withdrawn';
    connection.respondedAt = new Date();
  } else {
    if (connection.receiverUserId !== userId) {
      const err = new Error('Only the recipient can respond to this request');
      err.status = 403;
      throw err;
    }
    connection.status = action === 'accept' ? 'accepted' : 'declined';
    connection.respondedAt = new Date();
  }
  await connection.save();
  return serialize(await ConnectionRequest.findByPk(id, { include: includePeople }), userId);
}

async function reportConnection(userId, id, { reason, details }) {
  const connection = await ConnectionRequest.findByPk(id);
  if (!connection || ![connection.senderUserId, connection.receiverUserId].includes(userId)) {
    const err = new Error('Connection request not found');
    err.status = 404;
    throw err;
  }
  const cleanReason = String(reason || '').trim();
  const cleanDetails = String(details || '').trim();
  if (!cleanReason || cleanReason.length > 255 || cleanDetails.length > 3000) {
    const err = new Error('Report reason or details length is invalid');
    err.status = 400;
    throw err;
  }
  const targetUserId = connection.senderUserId === userId ? connection.receiverUserId : connection.senderUserId;
  return Report.create({ reporterUserId: userId, targetUserId, connectionRequestId: id, reason: cleanReason, details: cleanDetails || null });
}

module.exports = { createConnection, listConnections, actOnConnection, reportConnection, serialize };
