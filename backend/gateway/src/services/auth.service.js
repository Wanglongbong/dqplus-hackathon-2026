const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { isAdmin } = require('../middleware/authorizeAdmin');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

function sanitize(user) {
  const plain = user.toJSON();
  delete plain.password;
  plain.isAdmin = isAdmin(plain.username);
  return plain;
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

async function register({ username, password, dob, role }) {
  const normalizedUsername = username.trim().toLowerCase();
  const existing = await User.findOne({ where: { username: normalizedUsername } });
  if (existing) {
    const err = new Error('Username already taken');
    err.status = 409;
    throw err;
  }

  const user = await User.create({ username: normalizedUsername, password, dob, role });
  return { user: sanitize(user), token: issueToken(user) };
}

async function login({ username, password }) {
  const user = await User.scope('withPassword').findOne({ where: { username: username.trim().toLowerCase() } });
  if (!user || !(await user.verifyPassword(password))) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  return { user: sanitize(user), token: issueToken(user) };
}

async function getCurrentUser(id) {
  const user = await User.findByPk(id);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return sanitize(user);
}

module.exports = { register, login, getCurrentUser };
