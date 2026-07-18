const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Profile = sequelize.define(
  'Profile',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    company_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    num_of_employees: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    industry: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    target_region: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    arr: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },
    where_you_operate: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    website: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    description_product: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    checks: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    avg_initial_investment: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },
    annual_investment_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    avg_holding_period: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    year_founded: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    funding_ask_usd: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },
    check_size_min_usd: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },
    check_size_max_usd: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },
    traction_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    investment_thesis: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    portfolio_highlights: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    linkedin_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    verification_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'unverified',
    },
    verification_method: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    profile_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'draft',
    },
    extraction_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
    },
    visibility: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'community',
    },
    consent_version: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    consented_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'profiles',
    underscored: true,
    timestamps: true,
  }
);

module.exports = Profile;
