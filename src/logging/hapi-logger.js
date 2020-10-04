'use strict';

const packageJson = require('../../package.json');
const winston = require('winston');
const _ = require('lodash');
const { createWinstonCloudWatch } = require('./winston-cloudwatch');

let loggerLevels = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
};

const errorStackFormat = winston.format(info => {
  if (info instanceof Error) {
    return Object.assign({}, info, {
      stack: info.stack,
      message: info.message
    })
  }
  ['error', 'err', 'e'].forEach(key => {
    if (info[key] instanceof Error) {
      info[key] = {
        message: info[key].message,
        stack: info[key].stack,
      }
    }
  });
  return info;
})

const defaultLogger = winston.createLogger({
  format: winston.format.combine(errorStackFormat(), winston.format.simple()),
  transports: [new winston.transports.Console()]
});
const nodeEnv = process.env.NODE_ENV;
const loggerSettings = {
  isLiveEnv: nodeEnv && (nodeEnv === 'development' || nodeEnv === 'production'),
};

let isLoggerInitialized = false;

function register(server, options) {
  if (!options.serviceName) {
    throw new Error('serviceName cannot be null');
  }
  loggerSettings.serviceName = options.serviceName;
  loggerSettings.environment = loggerSettings.isLiveEnv ? nodeEnv : 'local';
  // Adding log and meta filters
  if (options.filterLogMessage) {
    defaultLogger.filters.push(options.filterLogMessage);
  }
  if (options.filterLogMeta) {
    defaultLogger.rewriters.push(options.filterLogMeta);
  }
  loggerLevels = options.levels || loggerLevels;
  defaultLogger.setLevels(loggerLevels);
  const transports = options.transports;
  if (transports) {
    for (let i = 0; i < transports.length; i++) {
      defaultLogger.add(transports[i], null, true);
    }
  }
  if (loggerSettings.isLiveEnv) {
    const winstonCloudWatch = createWinstonCloudWatch(options);
    if (winstonCloudWatch) {
      defaultLogger.add(createWinstonCloudWatch(options));
    }
  }
  isLoggerInitialized = true;
  server.events.on('log', onServerLog);
  // this seems unnecessary since onRequestInternal also logs the same errors
  // server.events.on({ name: 'request', channels: 'error' }, onServerError);
  server.events.on({ name: 'request', channels: 'app' }, onRequestLog);
  server.events.on({ name: 'request', channels: 'internal' }, onRequestInternal);
  if (options.logAllRequests) {
    server.ext('onPreHandler', onServerRequest);
  }

  defaultLogger.on('error', onLoggerError);
}

// Handling errors that are within logger or transports
function onLoggerError(error) {
  defaultLogger.error('Error within logger module!', error);
}

// Events logged with request.log() of Hapi
function onRequestLog(request, event, tags) {
  if (tags.error) {
    const serializedLog = requestSerializer(request);
    const logMsg = `${getRequestMsg(serializedLog)} | ${getMsgFromEvent(event)}`;
    defaultLogger.error(logMsg, { requestId: serializedLog.id });
  }
}

// Log all request coming to server
function onServerRequest(request, reply) {
  // Do not log boom requests
  if (request.isBoom) {
    return reply.continue();
  }
  const serializedLog = requestSerializer(request);
  defaultLogger.info(getRequestMsg(serializedLog), { requestId: serializedLog.id });
  reply.continue();
}

function onRequestInternal(request, event, tags) {
  if (tags.error) {
    defaultLogger.error(getInternalErrorMessage(request, event, tags));
  }
}

// Events logged with server.log() and server events generated internally by Hapi
function onServerLog(event, tags) {
  if (tags.error) {
    const logMsg = typeof(event.data) === 'string' ? event.data : 'Server Error';
    if (event.tags && event.tags.length > 0) {
      return defaultLogger.error(logMsg, event.tags);
    }
    defaultLogger.error(logMsg);
  }
}

// Log all request errors (server returns 500 error code)
function onServerError(request, error) {
  if (!error) {
    return;
  }
  const serializedLog = requestSerializer(request);
  const logMsg = getRequestMsg(serializedLog);
  defaultLogger.error(logMsg, {
    errorMsg: error.message, stack: error.stack, requestId: serializedLog.id,
  });
}

function getRequestMsg(logEvent) {
  return `${logEvent.method} ${logEvent.path}`;
}

function getMsgFromEvent(event) {
  let msg = '';
  const typeOfData = typeof(event.data);
  if (typeOfData === 'string') {
    msg = event.data;
  } else if (typeOfData === 'object' && event.data.message) {
    msg = event.data.message;
    delete event.data.message;
  }
  return msg;
}

function requestSerializer(request) {
  return {
    id: request.id,
    method: request.method.toUpperCase(),
    path: request.path,
  };
}

function getInternalErrorMessage(request, event, tags) {
  let message = _.reduce(Object.keys(tags), (acc, tag) => `${acc} ${tag}`, 'Server Error:');
  const error = event.data || event;
  message += '\nmessage: ';
  if (error instanceof Error) {
    message += error.message;
  } else if (error) {
    message += JSON.stringify(error);
  }
  message += `\npath: ${request.method} ${request.path}`;
  if (request.payload) {
    try {
      message += `\npayload: ${JSON.stringify(request.payload)}`;
    } catch (e) {
      // continue regardless of error
    }
  }
  if (request.query) {
    try {
      message += `\nquery: ${JSON.stringify(request.query)}`;
    } catch (e) {
      // continue regardless of error
    }
  }
  message += '\n';
  return message;
}

function formatLogItem(item) {
  if (item.meta && Object.keys(item.meta).length > 0) {
    return `${item.level}: ${item.message} | meta: ${JSON.stringify(item.meta)}`;
  }
  return `${item.level}: ${item.message}`;
}

// Default meta
function filterLogMeta(level, msg, meta) {
  meta.service = loggerSettings.serviceName;
  meta.environment = loggerSettings.environment;
  return meta;
}

/* eslint-disable prefer-rest-params*/
function log() {
  defaultLogger.log.apply(defaultLogger, arguments);
}
/* eslint-enable prefer-rest-params*/
const hapiLogger = exports;

// Predefined transports
Object.defineProperty(hapiLogger, 'transports', {
  get: () => defaultLogger.transports,
});

// Default logger settings
Object.defineProperty(hapiLogger, 'exceptionHandlers', {
  get: () => defaultLogger.exceptionHandlers,
});

// Predefined levels
Object.defineProperty(hapiLogger, 'levels', {
  get: () => loggerLevels,
});

Object.defineProperty(hapiLogger, 'isLoggerInitialized', {
  get: () => isLoggerInitialized,
});

hapiLogger.register = register;
hapiLogger.pkg = packageJson;

// Logging function
hapiLogger.log = log;
