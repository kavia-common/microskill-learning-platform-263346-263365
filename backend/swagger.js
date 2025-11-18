const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Micro-skill LMS API',
      version: '1.0.0',
      description: 'Express API for lessons, quizzes, and progress tracking'
    }
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
