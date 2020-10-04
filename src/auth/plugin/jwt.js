const _ = require('lodash');

const Boom = require('@hapi/boom');
const Request = require('../../request');
const hapiAuthJWT2 = require('hapi-auth-jwt2');
const hapiLogger = require('../../logging/hapi-logger');

const accessRoles = require('../access-roles');
const accessRolesList = _.values(accessRoles);
const Credentials = require('../credentials');

function JWT(config) {
  const self = this;
  self.request = new Request(config);
  self.credentials = new Credentials(config);

  self.name = 'jwt';
  self.register = async (server) => {
    const authStrategy = {
      key: _getKey,
      verifyOptions: { algorithms: ['HS256'] },
      validate: _validateToken,
      cookieKey: 'authToken',
    };
    server.ext('onPreHandler', self.requestValidation);
    server.ext('onPreResponse', self.responseValidation);

    await server.register(hapiAuthJWT2);
    server.auth.strategy('jwt', 'jwt', authStrategy);
    server.auth.default('jwt');
  };


  /**
   * Returns JWT secret the request token to be validated against (based on role)
   * @param credentials  Object   Decoded token payload
   * @private
   */
  async function _getKey(credentials) {
    if (!credentials) {
      return { isValid: false };
    }
    const key = self.credentials.getSecret(credentials.role, 'receive');
    if (!key) {
      const message = 'Missing receive auth token';
      hapiLogger.log('error', message);
      return { isValid: false };
    }
    return { key };
  }

  /**
   * Validates JWT token
   * @param credentials
   * @param request
   * @returns {*}
   * @private
   */
  async function _validateToken(credentials, request) {
    // Super user got full access
    if (self.isSuperUser(credentials)) {
      return { isValid: true, credentials };
    }
    const routeRoles = _.castArray(
      _.get(request, 'route.settings.plugins.authorization.role', []));
    const allowRoles = _.intersection(routeRoles, accessRolesList);
    // Validate access to the route
    if (!allowRoles.includes(credentials.role)) {
      return { isValid: false, credentials };
    }
    // Check if in blacklist
    try {
      // const blacklisted = await _isBlacklisted(credentials, request);
      // if (blacklisted) {
      //   return { isValid: false, credentials };
      // }
      if (self.isUser(credentials)) {
        // @todo Client should be identified by token and consider fetching
        const providedId = _.get(request, 'payload.userId') || _.get(request, 'params.userId');
        if (providedId && providedId !== credentials.userId) {
          return { isValid: false, credentials };
        }
      }
      if (self.isSalesPartner(credentials)) {
        // for sales partner actors, we return the whole sales partner record
        const entity = await self.request.get(`/booking/sales-partner/${credentials.userId}`);
        return { isValid: true, credentials: entity };
      }
      return { isValid: true, credentials };
    } catch (err) {
      return { isValid: false, credentials };
    }
  }

  // /**
  //  * Validate if the token or actor in black-list
  //  * @param {*} credentials
  //  * @param {*} request
  //  * @returns
  //  */
  // async function _isBlacklisted(credentials, request) {
  //   if (!self.tokenManager) {
  //     return false;
  //   }
  //   const promises = [];
  //   promises.push(self.tokenManager
  //     .isActorValidated(credentials.role, credentials.userId));
  //   const token = _getToken(request);
  //   if (token) {
  //     promises.push(self.tokenManager.isTokenValidated(token));
  //   }
  //   return Promise.all(promises)
  //     .then((results) => !_.isEmpty(_.filter(results, (item) => !item)))
  //     // for now, ignore token validation error, as we don't want to be too strict
  //     // in limiting user access
  //     .catch(() => (false));
  // }

  function _getToken(request) {
    const bearer = _.get(request, 'headers.authorization');
    if (!bearer) {
      return;
    }
    const splitBearer = bearer.split(' ');
    if (splitBearer.length !== 2) {
      return;
    }
    return splitBearer[1];
  }

  /**
   *
   * @param request
   * @param h
   */
  self.requestValidation = async (request, h) => {
    const credentials = request.auth.credentials;
    if (self.isSuperUser(credentials)) {
      return h.continue;
    }
    const validationFunc = _.get(request, 'route.settings.plugins.authorization.request');
    if (!validationFunc) {
      return h.continue;
    }
    try {
      await validationFunc(request.payload, credentials, request.params, request);
      return h.continue;
    } catch (err) {
      throw Boom.unauthorized();
    }
  };

  /**
   * @param request
   * @param h
   */
  self.responseValidation = async (request, h) => {
    const response = request.response;
    if (!response) {
      return h.continue;
    }
    const credentials = request.auth.credentials;
    if (self.isSuperUser(credentials)) {
      return h.continue;
    }
    const validationFunc = _.get(request, 'route.settings.plugins.authorization.response');
    if (!validationFunc || response.statusCode !== 200) {
      return h.continue;
    }
    const body = response.source;

    try {
      await validationFunc(body, credentials, request.params, request);
      return h.continue;
    } catch (err) {
      throw Boom.unauthorized();
    }
  };

  // Helpers
  self.isUser = (credential) => credential && accessRoles.user === credential.role;
  self.isSuperUser = (credential) => credential && accessRoles.superUser === credential.role;
  // Old sales Partner token have no role, so the workaround is to check for id length
  self.isSalesPartner = (credential) => credential &&
    (accessRoles.salesPartner === credential.role || credential.userId.length === 4);
}

module.exports = JWT;
