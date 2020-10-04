'use strict';

const Redis = require('../redis');
const ACTOR_KEY = 'token:blacklist:actor:';
const TOKEN_KEY = 'token:blacklist:token:';

class TokenManager {
  constructor(config) {
    if (!TokenManager.instance) {
      TokenManager.instance = new Manager(config);
    }
  }

  getInstance() {
    return TokenManager.instance;
  }
}

function Manager(config) {
  const self = this;
  config = config || {};
  self.redisClient = undefined;
  self.enabled = !!config.enabled;

  function _getClient() {
    if (!self.enabled) {
      // dummy object
      return {};
    }
    if (!self.redisClient) {
      self.redisClient = new Redis(config.get('redisEndPoint')).redisClient;
      // if there's a problem with the redis server,
      // we don't want it to prevent normal users from logging in.
      // to re-enable token validation restart the service
      self.redisClient.on('error', () => {
        self.enabled = false;
        self.redisClient.end(true);
        self.redisClient = null;
      });
      if (config.db !== undefined) {
        self.redisClient.select(config.db);
      }
    }
    return self.redisClient;
  }

  this.valid = (token) => (
    new Promise((resolve, reject) => {
      if (!self.enabled) {
        return resolve();
      }
      if (!token) {
        return reject();
      }
      const key = `${TOKEN_KEY}${token}`;
      return _getClient().del(key, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    })
  );

  this.invalidate = (token, expireIn) => (
    new Promise((resolve, reject) => {
      if (!self.enabled) {
        return resolve();
      }
      if (!token) {
        return reject();
      }
      const key = `${TOKEN_KEY}${token}`;
      if (expireIn !== undefined) {
        return _getClient().set(key, 1, 'EX', expireIn, (err) => {
          if (err) {
            return reject(err);
          }
          return resolve();
        });
      }
      _getClient().set(key, 1, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    })
  );

  this.validActor = (role, id) => (
    new Promise((resolve, reject) => {
      if (!self.enabled) {
        return resolve();
      }
      if (!role || !id) {
        return reject();
      }
      const key = `${ACTOR_KEY}${role}:${id}`;
      return _getClient().del(key, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    })
  );

  this.invalidateActor = (role, id, expireIn) => (
    new Promise((resolve, reject) => {
      if (!self.enabled) {
        return resolve();
      }
      if (!role || !id) {
        return reject();
      }
      const key = `${ACTOR_KEY}${role}:${id}`;
      if (expireIn !== undefined) {
        return _getClient().set(key, 1, 'EX', expireIn, (err) => {
          if (err) {
            return reject(err);
          }
          return resolve();
        });
      }
      _getClient().set(key, 1, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    })
  );

  /**
   * check if an actor (User/Collaborator/SalesPartner/Admin) is in blacklist
   * @param {*} role Role of the actor (credential part)
   * @param {*} id id of the actor (credential part)
   */
  this.isActorValidated = (role, id) => {
    const actorKey = `${ACTOR_KEY}${role}:${id}`;
    return new Promise((resolve, reject) => {
      if (!self.enabled) {
        return resolve(true);
      }
      try {
        _getClient().get(actorKey, (err, result) => {
          if (err) {
            return reject(err);
          }
          return resolve(!result);
        });
      } catch (e) {
        return reject(e);
      }
    });
  };


  this.isTokenValidated = (token) => {
    const key = `${TOKEN_KEY}${token}`;
    return new Promise((resolve, reject) => {
      if (!self.enabled) {
        return resolve(true);
      }
      try {
        _getClient().get(key, (err, result) => {
          if (err) {
            return reject(err);
          }
          return resolve(!result);
        });
      } catch (e) {
        return reject(e);
      }
    });
  };
}

module.exports = TokenManager;
