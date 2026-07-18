const { client, CHAT_MODEL } = require('../config/openai');
const founderSchema = require('../schemas/founder.schema');
const investorSchema = require('../schemas/investor.schema');

const SYSTEM_PROMPT = `You extract structured data from text describing a startup founder/company or an investor.
Rules:
- Use only information present in the text. Use null for unknown scalars and [] for unknown arrays.
- Normalize sectors/industries to lowercase single words or hyphenated terms (e.g. "fintech", "health-tech", "e-commerce").
- Normalize stages to exactly: pre-seed, seed, series-a, series-b, growth.
- Normalize regions/geographies to lowercase (e.g. "vietnam", "sea", "apac", "us", "eu", "global").
- Monetary amounts are in USD numbers (e.g. "1.5M" -> 1500000).`;

async function extractAttributes(role, text) {
  if (!client) {
    const err = new Error('AI text extraction is unavailable without an API key');
    err.status = 503;
    throw err;
  }
  const schema = role === 'investor' ? investorSchema : founderSchema;
  const completion = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Extract the ${role} profile from this text:\n\n${text}` },
    ],
    response_format: { type: 'json_schema', json_schema: schema },
  });
  return JSON.parse(completion.choices[0].message.content);
}

function buildEmbeddingText(role, attrs) {
  const parts = [];
  if (role === 'founder') {
    if (attrs.company_name) parts.push(attrs.company_name);
    if (attrs.industry?.length) parts.push(`${attrs.industry.join(', ')} startup`);
    if (attrs.stage) parts.push(`at ${attrs.stage} stage`);
    if (attrs.country) parts.push(`based in ${attrs.country}`);
    if (attrs.target_regions?.length) parts.push(`targeting ${attrs.target_regions.join(', ')}`);
    if (attrs.business_model) parts.push(`business model: ${attrs.business_model}`);
    if (attrs.product_description) parts.push(attrs.product_description);
    if (attrs.traction_summary) parts.push(`Traction: ${attrs.traction_summary}`);
  } else {
    if (attrs.firm_name) parts.push(attrs.firm_name);
    if (attrs.investor_type) parts.push(`${attrs.investor_type} investor`);
    if (attrs.sectors?.length) parts.push(`investing in ${attrs.sectors.join(', ')}`);
    if (attrs.stages?.length) parts.push(`at ${attrs.stages.join(', ')} stages`);
    if (attrs.geographies?.length) parts.push(`in ${attrs.geographies.join(', ')}`);
    if (attrs.thesis) parts.push(`Thesis: ${attrs.thesis}`);
    if (attrs.constraints) parts.push(`Avoids: ${attrs.constraints}`);
  }
  return parts.join('. ') || `${role} profile with no extracted details`;
}

module.exports = { extractAttributes, buildEmbeddingText };
