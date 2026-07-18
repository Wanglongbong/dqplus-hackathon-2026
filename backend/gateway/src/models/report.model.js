const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Report = sequelize.define('Report', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reporterUserId: { type: DataTypes.UUID, allowNull: false, field: 'reporter_user_id' },
  targetUserId: { type: DataTypes.UUID, allowNull: false, field: 'target_user_id' },
  connectionRequestId: { type: DataTypes.UUID, allowNull: true, field: 'connection_request_id' },
  opportunityId: { type: DataTypes.UUID, allowNull: true, field: 'opportunity_id' },
  reason: { type: DataTypes.STRING, allowNull: false },
  details: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'open' },
}, {
  tableName: 'reports',
  underscored: true,
  timestamps: true,
});

module.exports = Report;
