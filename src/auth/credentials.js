'use strict';

const _ = require('lodash');
const TokenIssuer = require('./token-issuer');
const tokenIssuer = new TokenIssuer();

const accessRoles = require('./access-roles');

function Credentials(config) {
  const self = this;
  self.cache = {};

  _setSecrets(config);
  function _setSecrets() {
    self.cache = {};
    self.secrets = config.get('secrets');
  }

  /**
   *
   * @param userId
   * @param role
   * @param payload
   * @param expiresAt
   * @returns {*}
   */
  this.getToken = (userId, role, payload, expiresAt) => {
    payload = _.merge({ userId, role }, payload);
    if (self.cache[userId]) {
      return self.cache[userId];
    }
    const token = tokenIssuer.issue(payload, self.getSecret(role), expiresAt);
    if (!expiresAt) {
      self.cache[userId] = token;
    }
    return token;
  };

  /**
   *
   * @param role
   * @param direction
   * @returns {*}
   */
  this.getSecret = (role, direction = 'transfer') => {
    const token = _.get(self.secrets, role);
    return _.get(token, direction, token);
  };
}


module.exports = Credentials;
