const swaggerJsdoc = require('swagger-jsdoc');
const path = require('node:path');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VietNexus Community API',
      version: '2.0.0',
      description: 'Authenticated profiles, trusted discovery, connection consent and opportunities.',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            dob: { type: 'string', format: 'date' },
            role: { type: 'string', enum: ['founder', 'investor'] },
            profileId: { type: 'string', format: 'uuid', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Profile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            company_name: { type: 'string' },
            country: { type: 'string', nullable: true },
            stage: { type: 'string', nullable: true },
            num_of_employees: { type: 'integer', nullable: true },
            industry: { type: 'string', nullable: true },
            target_region: { type: 'string', nullable: true },
            arr: { type: 'number', nullable: true },
            where_you_operate: { type: 'string', nullable: true },
            website: { type: 'array', items: { type: 'string' }, nullable: true },
            description_product: { type: 'string', nullable: true },
            checks: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            phone_number: { type: 'string', nullable: true },
            avg_initial_investment: { type: 'number', nullable: true },
            annual_investment_count: { type: 'integer', nullable: true },
            avg_holding_period: { type: 'number', nullable: true },
            year_founded: { type: 'integer', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ProfileInput: {
          type: 'object',
          properties: {
            company_name: { type: 'string' },
            country: { type: 'string' },
            stage: { type: 'string' },
            num_of_employees: { type: 'integer' },
            industry: { type: 'string' },
            target_region: { type: 'string' },
            arr: { type: 'number' },
            where_you_operate: { type: 'string' },
            website: { type: 'array', items: { type: 'string' } },
            description_product: { type: 'string' },
            checks: { type: 'string' },
            email: { type: 'string' },
            phone_number: { type: 'string' },
            avg_initial_investment: { type: 'number' },
            annual_investment_count: { type: 'integer' },
            avg_holding_period: { type: 'number' },
            year_founded: { type: 'integer' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [path.join(__dirname, '../routes/*.js')],
});

module.exports = swaggerSpec;
