const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MatchFeedback = sequelize.define('MatchFeedback', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  requesterUserId: { type: DataTypes.UUID, allowNull: false, field: 'requester_user_id' },
  candidateUserId: { type: DataTypes.UUID, allowNull: false, field: 'candidate_user_id' },
  action: { type: DataTypes.STRING, allowNull: false },
  reason: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'match_feedback',
  underscored: true,
  timestamps: true,
  indexes: [{ unique: true, fields: ['requester_user_id', 'candidate_user_id'] }],
});

module.exports = MatchFeedback;
