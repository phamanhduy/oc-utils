const inert = require('@hapi/inert');
const vision = require('@hapi/vision');
const hapiSwagger = require('hapi-swagger');
const hapiLogger = require('./logging/hapi-logger');

const Swagger = {
  init: async (server, releaseContext) => {
    if (!server) {
      hapiLogger.log('info', 'Swagger: Unexpected input');
      return;
    }
    releaseContext = releaseContext || {};
    const swaggerOptions = {
      info: {
        title: `${releaseContext.serviceName || 'OC'} API`,
        version: `${releaseContext.version || '1.0'} (${releaseContext.name || 'latest'})`,
      },
    };
    await server.register([
      inert,
      vision,
      {
        plugin: hapiSwagger,
        options: swaggerOptions,
      },
    ]);
    hapiLogger.log('info', 'Swagger: Successfully initialized');
  },
};

module.exports = Swagger;
