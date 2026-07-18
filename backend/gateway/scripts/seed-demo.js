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
  console.log(`Seeded ${DEMO.length} clearly-labelled scripted demo accounts. Password: ${PASSWORD}`);
  await sequelize.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
