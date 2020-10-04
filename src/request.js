'use strict';

const req = require('request');
const hapiLogger = require('./logging/hapi-logger');

const Credentials = require('./auth/credentials');
const accessRoles = require('./auth/access-roles');


/**
 * Helper class facilitating making requests
 * @param config Config Configuration object
 * @param path string            Path prepended to each subsequent request
 * @constructor
 */
function Request(config, path) {
  this.path = config.get('API_PATH') + (path || '');
  this.credentials = new Credentials(config);
}

/**
 * Sends GET requests
 * @param resource
 */
Request.prototype.get = function (resource) {
  return this._send('get', resource);
};

/**
 * Sends POST request
 * @param resource
 * @param payload
 * @param multipart
 */
Request.prototype.post = function (resource, payload, multipart = false) {
  return this._send('post', resource, payload, multipart);
};

/**
 * Sends PATCH request
 * @param resource
 * @param payload
 */
Request.prototype.patch = function (resource, payload) {
  return this._send('patch', resource, payload);
};

/**
 * Sends DELETE request
 * @param resource
 * @param payload
 */
Request.prototype.delete = function (resource, payload) {
  return this._send('delete', resource, payload);
};

/**
 * Sends authorized request
 * @param method
 * @param resource
 * @param payload
 * @param multipart
 * @returns {Promise}
 * @private
 */
Request.prototype._send = function (method, resource, payload, multipart = false) {
  const options = { json: true };
  const authToken = this.credentials.getToken('superUser', accessRoles.superUser);

  if (!authToken) {
    const message = 'Missing transfer auth token';
    hapiLogger.log('error', message);
    return Promise.reject(message);
  }
  options.headers = { Authorization: `Bearer ${authToken}` };

  options.url = (this.path || '') + resource;
  if (payload) {
    if (multipart) {
      options.formData = payload;
    } else {
      options.body = payload;
    }
  }

  return new Promise((resolve, reject) => {
    req[method](options, (err, response) => (
      err || !response.statusCode.toString().startsWith(2)
        ? reject(err || response.body) : resolve(response.body)
    ));
  });
};

module.exports = Request;
