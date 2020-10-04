'use strict';

const Auth = {};

Auth.accessRoles = require('./access-roles');
Auth.Credentials = require('./credentials');
Auth.TokenIssuer = require('./token-issuer');

Auth.plugin = {};
Auth.plugin.IP = require('./plugin/ip');
Auth.plugin.JWT = require('./plugin/jwt');

module.exports = Auth;
