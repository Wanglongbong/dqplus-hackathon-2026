const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ConnectionRequest = sequelize.define('ConnectionRequest', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  senderUserId: { type: DataTypes.UUID, allowNull: false, field: 'sender_user_id' },
  receiverUserId: { type: DataTypes.UUID, allowNull: false, field: 'receiver_user_id' },
  intent: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
  savedAt: { type: DataTypes.DATE, allowNull: true, field: 'saved_at' },
  respondedAt: { type: DataTypes.DATE, allowNull: true, field: 'responded_at' },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
}, {
  tableName: 'connection_requests',
  underscored: true,
  timestamps: true,
});

module.exports = ConnectionRequest;
