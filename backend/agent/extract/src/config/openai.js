require('dotenv').config();
const OpenAI = require('openai');

const client = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
}) : null;

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
// The pgvector migration uses vector(1536); keep the runtime contract fixed.
const EMBEDDING_DIM = 1536;

module.exports = { client, CHAT_MODEL, EMBEDDING_MODEL, EMBEDDING_DIM };
