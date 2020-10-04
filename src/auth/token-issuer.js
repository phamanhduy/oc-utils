'use strict';

const jsonWebToken = require('jsonwebtoken');

function TokenIssuer(tokenSecret) {
  const self = this;
  self.tokenSecret = tokenSecret;

  /**
   * @param payload
   * @param _tokenSecret
   * @param expiresIn
   * @returns {*}
   */
  self.issue = (payload, _tokenSecret, expiresIn) => {
    _tokenSecret = _tokenSecret || !self.tokenSecret;
    if (!payload || !_tokenSecret) {
      throw new Error('Secret and payload must be provided');
    }
    const options = !expiresIn ? { noTimestamp: true } : { expiresIn };
    return jsonWebToken.sign(payload, _tokenSecret, options);
  };

  /**
   *
   * @param token
   * @param _tokenSecret
   * @param ignoreExpiration
   * @returns {*|PromiseLike<boolean>}
   */
  self.decode = (token, _tokenSecret, ignoreExpiration = false) => {
    try {
      return jsonWebToken.verify(token, _tokenSecret, { ignoreExpiration });
    } catch (err) {
    }
  };
}

module.exports = TokenIssuer;