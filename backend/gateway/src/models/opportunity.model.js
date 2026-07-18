const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Opportunity = sequelize.define('Opportunity', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ownerUserId: { type: DataTypes.UUID, allowNull: false, field: 'owner_user_id' },
  type: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  summary: { type: DataTypes.TEXT, allowNull: false },
  criteria: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
}, {
  tableName: 'opportunities',
  underscored: true,
  timestamps: true,
});

module.exports = Opportunity;
