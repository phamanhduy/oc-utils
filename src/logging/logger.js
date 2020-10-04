const winston = require('winston');

const defaultOptions = {
  transports: [
    new (winston.transports.Console)(),
  ],
};

function registerNewLogger(options) {
  const userOptions = options || defaultOptions;
  return new (winston.Logger)(userOptions);
}

exports.registerNewLogger = registerNewLogger;
