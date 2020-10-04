'use strict';

const redis = require('redis');
const bluebird = require('bluebird');
const hapiLogger = require('./logging/hapi-logger');
bluebird.promisifyAll(redis);

/**
 * Redis helper allows use callback or promise from redis lib
 * Promise function have format *Sync, fx: getAsync, setAsync..
 * @param redisEndPoint fx 127.0.0.1
 * @constructor
 */
class Redis {
  constructor(redisEndPoint) {
    const redisUrl = `redis://${redisEndPoint}`;
    this.client = redis.createClient(redisUrl, { prefix: 'oc:' });
    this.client.on('error', (error) => {
      hapiLogger.log('error', 'Redis server error!', { error, redisUrl });
    });
  }
  get redisClient() {
    return this.client;
  }
  getUnionSet(setKeyList) {
    return new Promise((resolve, reject) => {
      this.client.sunion(setKeyList, (error, redisData) => {
        if (error) {
          return reject(error);
        }
        resolve(redisData);
      });
    });
  }
  getIntersectionSet(setKeyList) {
    return new Promise((resolve, reject) => {
      this.client.sinter(setKeyList, (error, redisData) => {
        if (error) {
          return reject(error);
        }
        resolve(redisData);
      });
    });
  }
  getDataFromSet(redisSetKeyList) {
    return new Promise((resolve, reject) => {
      const isInputArray = Array.isArray(redisSetKeyList);
      const multiClient = this.client.multi();
      if (isInputArray) {
        redisSetKeyList.map((redisSetKey) => {
          multiClient.smembers(redisSetKey);
          return redisSetKey;
        });
      } else {
        multiClient.smembers(redisSetKeyList);
      }
      multiClient.exec((error, redisDataList) => {
        if (error) {
          return reject(error);
        }
        const result = isInputArray ? redisDataList : redisDataList[0];
        resolve(result);
      });
    });
  }
  getDataFromSortedSetByDate(redisSetKey, min, max) {
    return new Promise((resolve, reject) => {
      min = (min || min === 0) ? min : '-inf';
      max = (max || max === 0) ? max : '+inf';
      const args = [redisSetKey, min, max];
      this.client.zrangebyscore(args, (err, redisData) => {
        if (err) {
          return reject(err);
        }
        resolve(redisData);
      });
    });
  }
  getDataFromSortedSet(redisSetKey) {
    return new Promise((resolve, reject) => {
      this.client.zrange(redisSetKey, 0, -1, (err, redisData) => {
        if (err) {
          return reject(err);
        }
        resolve(redisData);
      });
    });
  }
}

module.exports = Redis;
