/**
 * Based on: https://github.com/expressjs/morgan
 */
"use strict";
const auth = require('basic-auth')

module.exports = exports = (function () {
    "use strict";
    function initialize() {
        let simplifiers = {
            /**
             * request url
             */

            'url': function getUrlToken(req) {
                return req.originalUrl || req.url
            },

            /**
             * request method
             */

            'method': function getMethodToken(req) {
                return req.method
            },

            /**
             * response time in milliseconds
             */

            'response-time': function getResponseTimeToken(req, res, digits) {
                if (!req._startAt || !res._startAt) {
                    // missing request and/or response start time
                    return
                }

                // calculate diff
                var ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
                    (res._startAt[1] - req._startAt[1]) * 1e-6

                // return truncated value
                return ms.toFixed(digits === undefined ? 3 : digits)
            },

            /**
             * current date
             */

            'date': function getDateToken(req, res, format) {
                var date = new Date()

                switch (format || 'web') {
                    case 'iso':
                        return date.toISOString()
                    case 'web':
                        return date.toUTCString()
                }
            },

            /**
             * response status code
             */

            'status': function getStatusToken(req, res) {
                return res._header
                    ? String(res.statusCode)
                    : undefined
            },

            /**
             * normalized referrer
             */

            'referrer': function getReferrerToken(req) {
                return req.headers['referer'] || req.headers['referrer']
            },

            /**
             * remote address
             */

            'remote-addr': function getip(req) {
                return req.ip ||
                    req._remoteAddress ||
                    (req.connection && req.connection.remoteAddress) ||
                    undefined
            },

            /**
             * remote user
             */

            'remote-user': function getRemoteUserToken(req) {
                // parse basic credentials
                var credentials = auth(req)

                // return username
                return credentials
                    ? credentials.name
                    : undefined
            },

            /**
             * HTTP version
             */

            'http-version': function getHttpVersionToken(req) {
                return req.httpVersionMajor + '.' + req.httpVersionMinor
            },

            /**
             * UA string
             */

            'user-agent': function getUserAgentToken(req) {
                return req.headers['user-agent']
            },

            /**
             * request header
             */

            'req': function getRequestToken(req, res, field) {
                // get header
                var header = req.headers[field.toLowerCase()]

                return Array.isArray(header)
                    ? header.join(', ')
                    : header
            },

            /**
             * response header
             */

            'res': function getResponseHeader(req, res, field) {
                if (!res._header) {
                    return undefined
                }

                // get header
                var header = res.getHeader(field)

                return Array.isArray(header)
                    ? header.join(', ')
                    : header
            }
        }
        let formats = {};
        Object.defineProperty(this, 'simplifiers', {
            get: () => simplifiers
        })
        Object.defineProperty(this, 'formats', {
            get: () => formats
        })
        this.registerSimplifier = function registerSimplifier(name, func) {
            if (!(typeof name == 'string')) return new Error('Name have to be defined as <String>.');
            if (!(func instanceof Function)) return new Error('Func have to be a Function');
            let alreadyRegistered = name in this.simplifiers;
            if (alreadyRegistered) return new Error(`Simplifier already registered with name ${name}`);
            return this.simplifiers[name] = func;
        }
        this.registerFormat = function registerFormat(name, details) {
            if (!(typeof name == 'string')) return new Error('Name have to be defined as <String>.');
            if (!(details instanceof Array && details.length)) return new Error('Details have to be an Array<of String> with at least one member.');
            let alreadyRegistered = name in this.formats;
            if (alreadyRegistered) return new Error(`Format already registered with name ${name}`);
            let format = {};
            let _simplifiers = [];
            details.forEach((d) => {
                let extractedToken = Simplifier.extractToken(d);
                _simplifiers.push(extractedToken.key);
                format[extractedToken.key] = extractedToken;
            });
            let missingSimplifiers = _simplifiers.filter(s => !(s in this.simplifiers));
            if (missingSimplifiers.length > 0) return new Error(`Some simplifier is missing. ${missingSimplifiers.join(', ')}`);
            return this.formats[name] = format;
        }
        this.compile = function compile(format, req, res) {
            if (typeof format == 'string' || format instanceof String) {
                if (format in this.formats) format = this.formats[format];
                else return new Error(`No such format registered ${format}`);
            }
            let result = {};
            Object.keys(format).forEach(k => {
                let f = format[k];
                result[f.raw] = this.simplifiers[f.key](req, res, ...f.args) /* || null*/; // Uncomment to force keys in case their values are undefined; 
            })
            return result;
        }
        this.simplify = function simplify(token, req, res) {
            let o = Simplifier.extractToken(token);
            if (!(o.key in this.simplifiers)) return new Error(`No such simplifier '${o.key}'`);
            return this.simplifiers[o.key](req, res, ...o.args);
        }

        this.registerFormat('combined', ['remote-addr', 'remote-user', 'date[web]', 'method', 'url', 'http-version', 'status', 'res[content-length]', 'referrer', 'user-agent']);
        this.registerFormat('common', ['remote-addr', 'remote-user', 'date[web]', 'method', 'url', 'http-version', 'status', 'res[content-length]']);
        this.registerFormat('dev', ['method', 'url', 'status', 'response-time', 'res[content-length]']);
        this.registerFormat('short', ['remote-addr', 'remote-user', 'method', 'url', 'http-version', 'status', 'res[content-length]', 'response-time']);
        this.registerFormat('tiny', ['method', 'url', 'status', 'res[content-length]', 'response-time']);
        
        return this;
    }

    function Simplifier() {
        return initialize.apply(this, arguments);
    }

    Simplifier.extractToken = function extractToken(token) {
        let m = /^([\w,\d,\$,\_,\-]+)(\[(.+)\])?$/gm.exec(token);
        if (m.length < 2) return new Error(`Malformed token: ${token}`);
        return {
            raw: token,
            key: String(m[1]).toLowerCase(),
            args: (m[3] || '').split(',').map((i) => i.trim())
        }
    }

    return Simplifier;
})()