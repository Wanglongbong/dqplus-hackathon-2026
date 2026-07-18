const sequelize = require('../config/database');
const User = require('./user.model');
const Profile = require('./profile.model');
const ConnectionRequest = require('./connectionRequest.model');
const Opportunity = require('./opportunity.model');
const MatchFeedback = require('./matchFeedback.model');
const Report = require('./report.model');

Profile.hasOne(User, { foreignKey: 'profileId', as: 'owner' });
User.belongsTo(Profile, { foreignKey: 'profileId', as: 'profile' });

User.hasMany(ConnectionRequest, { foreignKey: 'senderUserId', as: 'sentConnections' });
User.hasMany(ConnectionRequest, { foreignKey: 'receiverUserId', as: 'receivedConnections' });
ConnectionRequest.belongsTo(User, { foreignKey: 'senderUserId', as: 'sender' });
ConnectionRequest.belongsTo(User, { foreignKey: 'receiverUserId', as: 'receiver' });

User.hasMany(Opportunity, { foreignKey: 'ownerUserId', as: 'opportunities' });
Opportunity.belongsTo(User, { foreignKey: 'ownerUserId', as: 'owner' });

User.hasMany(MatchFeedback, { foreignKey: 'requesterUserId', as: 'matchFeedback' });
MatchFeedback.belongsTo(User, { foreignKey: 'requesterUserId', as: 'requester' });

User.hasMany(Report, { foreignKey: 'reporterUserId', as: 'reports' });
Report.belongsTo(User, { foreignKey: 'reporterUserId', as: 'reporter' });
Report.belongsTo(User, { foreignKey: 'targetUserId', as: 'target' });
Report.belongsTo(ConnectionRequest, { foreignKey: 'connectionRequestId', as: 'connection' });
Report.belongsTo(Opportunity, { foreignKey: 'opportunityId', as: 'opportunity' });

module.exports = { sequelize, User, Profile, ConnectionRequest, Opportunity, MatchFeedback, Report };
