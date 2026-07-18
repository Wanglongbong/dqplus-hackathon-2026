require('dotenv').config();
const migrate = require('../src/db/migrate');
const { sequelize, Profile, User } = require('../src/models');

const PASSWORD = 'Demo12345!';
const DEMO = [
  { username: 'founder@demo-agrisense.example', role: 'founder', profile: { company_name: 'Demo AgriSense', website: ['https://demo-agrisense.example'], stage: 'seed', industry: 'agritech,cleantech', where_you_operate: 'vietnam,sea', description_product: '[Scripted demo] Sensors and decision tools for climate-smart farms.', funding_ask_usd: 500000, traction_summary: '12 scripted pilot farms', year_founded: 2023, num_of_employees: 8 } },
  { username: 'founder@demo-healthbridge.example', role: 'founder', profile: { company_name: 'Demo HealthBridge', website: ['https://demo-healthbridge.example'], stage: 'pre_seed', industry: 'healthtech,ai', where_you_operate: 'vietnam', description_product: '[Scripted demo] Clinical workflow software for provincial hospitals.', funding_ask_usd: 300000, traction_summary: '3 scripted hospital pilots', year_founded: 2024, num_of_employees: 5 } },
  { username: 'team@demo-impact.example', role: 'investor', profile: { company_name: 'Demo Impact Ventures', website: ['https://demo-impact.example'], stage: 'seed', industry: 'agritech,cleantech,saas', where_you_operate: 'vietnam,sea', investment_thesis: '[Scripted demo] Early-stage climate and agriculture technology in Southeast Asia.', check_size_min_usd: 250000, check_size_max_usd: 1000000 } },
  { username: 'team@demo-future.example', role: 'investor', profile: { company_name: 'Demo Future Fund', website: ['https://demo-future.example'], stage: 'pre_seed', industry: 'ai,healthtech,deeptech', where_you_operate: 'vietnam,sea', investment_thesis: '[Scripted demo] Technical founders improving essential services with AI.', check_size_min_usd: 100000, check_size_max_usd: 500000 } },
  { username: 'team@demo-sea.example', role: 'investor', profile: { company_name: 'Demo SEA Capital', website: ['https://demo-sea.example'], stage: 'series_a', industry: 'fintech,logistics,saas', where_you_operate: 'sea', investment_thesis: '[Scripted demo] Scalable software and financial infrastructure for SEA.', check_size_min_usd: 1000000, check_size_max_usd: 5000000 } },
];

const DEMO_DEALS = [
  ['ClimateTech HN-024', 'ClimateTech', 'pre_seed', 'Hà Nội', 350000, '3 scripted industrial pilots', 'Energy optimization for factories using real-time forecasting.', 7, 88],
  ['FinTech HN-018', 'FinTech', 'seed', 'Hà Nội', 600000, 'Scripted GMV growing 18% monthly', 'Reconciliation and working-capital infrastructure for distributors.', 9, 84],
  ['HealthTech HN-031', 'HealthTech', 'pre_seed', 'Hà Nội', 250000, '2 scripted hospital co-design partners', 'At-home recovery monitoring after treatment.', 6, 81],
  ['AgriTech HN-009', 'AgriTech', 'seed', 'Hưng Yên', 750000, '1,800 scripted active farmers', 'Crop and market data for transparent agricultural supply chains.', 11, 86],
  ['AI Infra HN-042', 'AI', 'pre_seed', 'Hà Nội', 400000, '12 scripted design partners', 'Private AI deployment tools for mid-market companies.', 5, 78],
  ['EdTech HN-015', 'EdTech', 'seed', 'Hà Nội', 500000, '42,000 scripted learners', 'Career simulations with feedback for final-year students.', 8, 82],
  ['Logistics HN-027', 'Logistics', 'seed', 'Bắc Ninh', 900000, '14% scripted route reduction', 'Return-trip coordination for inter-provincial fleets.', 8, 80],
  ['RetailTech HN-006', 'RetailTech', 'pre_seed', 'Hà Nội', 300000, '260 scripted active stores', 'Neighborhood demand forecasting for independent retailers.', 5, 75],
  ['Future of Work HN-038', 'WorkTech', 'pre_seed', 'Hà Nội', 280000, '8 scripted paying teams', 'Capability mapping and project team matching.', 6, 76],
  ['Circular HN-012', 'Circular', 'seed', 'Hà Nội', 650000, '34 scripted tons reused', 'Traceable secondary materials for small construction projects.', 7, 79],
  ['Cyber HN-045', 'Cybersecurity', 'pre_seed', 'Hà Nội', 450000, '5 scripted security teams', 'Adaptive phishing exercises for frontline employees.', 4, 72],
  ['CreatorTech HN-021', 'CreatorTech', 'seed', 'Hà Nội', 550000, '1,200 scripted active creators', 'Rights management and revenue sharing for short-form media.', 6, 74],
];

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
  await sequelize.authenticate();
  await migrate();
  const userIds = [];
  for (const entry of DEMO) {
    let user = await User.findOne({ where: { username: entry.username } });
    if (!user) user = await User.create({ username: entry.username, password: PASSWORD, role: entry.role });
    const profileValues = {
      ...entry.profile,
      email: entry.username,
      verification_status: 'verified',
      verification_method: 'scripted_demo_seed',
      verified_at: new Date(),
      profile_status: 'ready',
      visibility: 'community',
      consent_version: 'community-v1',
      consented_at: new Date(),
    };
    let profile = user.profileId ? await Profile.findByPk(user.profileId) : null;
    if (profile) await profile.update(profileValues);
    else {
      profile = await Profile.create(profileValues);
      user.profileId = profile.id;
      await user.save();
    }
    userIds.push(user.id);
  }

  const founderUsers = await User.findAll({ where: { role: 'founder' }, order: [['createdAt', 'ASC']] });
  for (let index = 0; index < DEMO_DEALS.length; index += 1) {
    const [alias, sector, stage, location, ask, traction, product, evidence, confidence] = DEMO_DEALS[index];
    await sequelize.query(`
      INSERT INTO deal_profiles (owner_user_id, alias, company_name, sector, stage, location, funding_ask_usd,
        traction_summary, product_summary, evidence_count, confidence, source_checked_at, status, is_demo)
      VALUES (:ownerUserId, :alias, :companyName, :sector, :stage, :location, :ask, :traction, :product,
        :evidence, :confidence, now(), 'published', true)
      ON CONFLICT (alias) DO UPDATE SET sector = EXCLUDED.sector, stage = EXCLUDED.stage,
        location = EXCLUDED.location, funding_ask_usd = EXCLUDED.funding_ask_usd,
        traction_summary = EXCLUDED.traction_summary, product_summary = EXCLUDED.product_summary,
        evidence_count = EXCLUDED.evidence_count, confidence = EXCLUDED.confidence,
        source_checked_at = now(), status = 'published', is_demo = true, updated_at = now()
    `, { replacements: {
      ownerUserId: founderUsers[index]?.id || null,
      companyName: founderUsers[index] ? `Scripted ${sector} Venture` : null,
      alias, sector, stage, location, ask, traction, product, evidence, confidence,
    } });
  }

  const venues = [
    ['Scripted partner space · Ba Đình', 'Ba Đình', 94, 'Quiet table for 7–8 people; host confirmation required.'],
    ['Scripted partner space · Hoàn Kiếm', 'Hoàn Kiếm', 89, 'Semi-private room with convenient cross-city access.'],
    ['Scripted partner space · Cầu Giấy', 'Cầu Giấy', 86, 'Presentation screen suitable for product demos.'],
  ];
  for (const [name, district, score, notes] of venues) {
    const existing = await sequelize.query('SELECT id FROM venues WHERE name = :name LIMIT 1', { replacements: { name }, type: require('sequelize').QueryTypes.SELECT });
    if (!existing[0]) await sequelize.query(`
      INSERT INTO venues (name, district, suitability_score, capacity, notes, is_demo)
      VALUES (:name, :district, :score, 8, :notes, true)
    `, { replacements: { name, district, score, notes } });
  }

  const pulseCount = await sequelize.query('SELECT COUNT(*)::int AS count FROM pulse_events WHERE is_demo = true', { type: require('sequelize').QueryTypes.SELECT });
  if (pulseCount[0].count === 0) await sequelize.query(`
    INSERT INTO pulse_events (event_type, public_text, public_meta, is_demo) VALUES
      ('meeting', '5 startups confirmed a scripted Coffee & Chat table', 'Ba Đình · 90 minutes', true),
      ('evidence', 'ClimateTech HN-024 added an official scripted source', '7 signals · 88% confidence', true),
      ('offline', 'AgriTech HN-009 completed scripted offline meeting #4', 'Host check-in recorded', true)
  `);

  const extractUrl = process.env.EXTRACT_SERVICE_URL;
  if (extractUrl) {
    for (const userId of userIds) {
      try {
        await fetch(`${extractUrl}/extract/profile`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-service-token': process.env.INTERNAL_SERVICE_TOKEN || '' },
          body: JSON.stringify({ userId }),
        });
      } catch (error) { console.warn(`Could not extract demo profile ${userId}: ${error.message}`); }
    }
  }
  console.log(`Seeded ${DEMO.length} accounts and ${DEMO_DEALS.length} clearly-labelled scripted deals. Password: ${PASSWORD}`);
  await sequelize.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
