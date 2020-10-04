const _ = require('lodash');
const Boom = require('@hapi/boom');

function IP() {
  const self = this;

  self.name = 'ip';
  self.register = (server) => {
    server.auth.scheme('ip', () => ({ authenticate: self.authenticate }));
  };

  /**
   * @param request
   * @param reply
   * @returns {*}
   */
  self.authenticate = (request, h) => {
    const requestIp = _.get(request, 'headers.x-forwarded-for')
      || _.get(request, 'info.remoteAddress');
    if (!requestIp) {
      throw Boom.badImplementation();
    }

    const validIPs = _.get(request, 'route.settings.plugins.authorization.validIps');
    let ips = [requestIp];
    // requestIp could be string of ips, split with colon
    if (requestIp.indexOf(',') > -1) {
      ips = requestIp.split(',');
    }
    const matchIps = _.intersection(ips, validIPs);
    if (_.isEmpty(matchIps)) {
      throw Boom.unauthorized();
    }
    return h.authenticated({ credentials: requestIp });
  };
}

module.exports = IP;
