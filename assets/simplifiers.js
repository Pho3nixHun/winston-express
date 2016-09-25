/**
 * Inspiration: https://github.com/expressjs/morgan
 */
module.exports = exports = (function () {
    "use strict";
    const auth = require('basic-auth')
    const apiCheck = require('api-check')();
    function initialize() {
        let simplifiers = {};
        let formats = {};
        /**
         * Ready only collection of simplifiers used to simplify objects.
         * @return {object} key - Name of simlplyfier, value - function
         */
        Object.defineProperty(this, 'simplifiers', {
            get: () => simplifiers
        })
        /**
         * Ready only collection of formats.
         * @return {object} key - Name of format, value - included simplifiers
         */
        Object.defineProperty(this, 'formats', {
            get: () => formats
        })
        /**
         * Register a new simplifier.
         * @param {string} name - name of the simplifier (later this name used to add it to a format)
         * @param {function} func - simplifier function. Receives req {object}, res {object} and paramArray {of string} defined in format
         * @return {object} The registered simplifier or an Error instance;
         */
        this.registerSimplifier = function registerSimplifier(name, func) {
            apiCheck.throw([
                apiCheck.string,
                apiCheck.func
            ], arguments)
            let alreadyRegistered = name in this.simplifiers;
            if (alreadyRegistered) return new Error(`Simplifier already registered with name ${name}`);
            return this.simplifiers[name] = func;
        }
        /**
         * Register a new format.
         * @param {string} name - name of the format (later this name used by compile function)
         * @param {arrayOf string} details - simplifiers one by one optionaly extended with params. ex.: simplifier[param1, param2].
         * @return {object} The registered format or an Error instance;
         */
        this.registerFormat = function registerFormat(name, details) {
            apiCheck.throw([
                apiCheck.string,
                apiCheck.arrayOf(apiCheck.string)
            ], arguments)
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
        /**
         * Compiles format.
         * @param {string or object} format - name of the registered format or the format object itself.
         * @param {object} req - request object
         * @param {object} res - response object
         * @return {object} The simplified/compiled object.
         */
        this.compile = function compile(format, req, res) {
            apiCheck.throw([
                apiCheck.oneOfType([apiCheck.string, apiCheck.object]),
                apiCheck.object,
                apiCheck.object
            ], arguments)
            if (!(apiCheck.string(format) instanceof Error)) {
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
        /**
         * Simplify one token.
         * @param {string} token - one token string to simplify. ex.: simplifier[param1, param2].
         * @param {object} req - request object
         * @param {object} res - response object
         * @return {any} The simplified/compiled value.
         */
        this.simplify = function simplify(token, req, res) {
            let o = Simplifier.extractToken(token);
            if (!(o.key in this.simplifiers)) return new Error(`No such simplifier '${o.key}'`);
            return this.simplifiers[o.key](req, res, ...o.args);
        }

        Object.keys(Simplifier.defaultSimplifiers).forEach(k => this.registerSimplifier(k, Simplifier.defaultSimplifiers[k]));
        Object.keys(Simplifier.defaultFormats).forEach(k => this.registerFormat(k, Simplifier.defaultFormats[k]));

        return this;
    }

    function Simplifier() {
        return initialize.apply(this, arguments);
    }
    /**
     * Default formats to register when creating new instance.
     */
    Simplifier.defaultFormats = {
        'combined': ['remote-addr', 'remote-user', 'date[web]', 'method', 'url', 'http-version', 'status', 'res[content-length]', 'referrer', 'user-agent'],
        'common': ['remote-addr', 'remote-user', 'date[web]', 'method', 'url', 'http-version', 'status', 'res[content-length]'],
        'dev': ['method', 'url', 'status', 'response-time', 'res[content-length]'],
        'short': ['remote-addr', 'remote-user', 'method', 'url', 'http-version', 'status', 'res[content-length]', 'response-time'],
        'tiny': ['method', 'url', 'status', 'res[content-length]', 'response-time']
    };
    /**
     * ExtractToken - Method to convert tokens into objects.
     * @param {string} token - token string to convert.
     * @return {object} raw - the token string, key - the name of simplifier, args - args passed to simplifier
     */
    Simplifier.extractToken = function extractToken(token) {
        let m = /^([\w,\d,\$,\_,\-]+)(\[(.+)\])?$/gm.exec(token);
        if (m.length < 2) return new Error(`Malformed token: ${token}`);
        return {
            raw: token,
            key: String(m[1]).toLowerCase(),
            args: m[3] ? m[3].split(',').map((i) => i.trim()) : []
        }
    }
    /**
     * Default simplifiers to register when creating new instance.
     */
    Simplifier.defaultSimplifiers = {
        /**
         * request url
         */

        'url': function getUrlToken(req) {
            return req.originalUrl || req.url;
        },

        /**
         * request method
         */

        'method': function getMethodToken(req) {
            return req.method;
        },

        /**
         * response time in milliseconds
         */

        'response-time': function getResponseTimeToken(req, res, digits) {
            if (!req._startAt || !res._startAt) {
                // missing request and/or response start time
                return;
            }

            // calculate diff
            var ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
                (res._startAt[1] - req._startAt[1]) * 1e-6;

            // return truncated value
            return ms.toFixed(digits === undefined ? 3 : digits);
        },

        /**
         * current date
         */

        'date': function getDateToken(req, res, format) {
            var date = new Date();

            switch (format || 'web') {
                case 'iso':
                    return date.toISOString();
                case 'web':
                    return date.toUTCString();
            }
        },

        /**
         * response status code
         */

        'status': function getStatusToken(req, res) {
            return res._header
                ? String(res.statusCode)
                : undefined;
        },

        /**
         * normalized referrer
         */

        'referrer': function getReferrerToken(req) {
            return req.headers['referer'] || req.headers['referrer'];
        },

        /**
         * remote address
         */

        'remote-addr': function getip(req) {
            return req.ip ||
                req._remoteAddress ||
                (req.connection && req.connection.remoteAddress) ||
                undefined;
        },

        /**
         * remote user
         */

        'remote-user': function getRemoteUserToken(req) {
            // parse basic credentials
            var credentials = auth(req);

            // return username
            return credentials
                ? credentials.name
                : undefined;
        },

        /**
         * HTTP version
         */

        'http-version': function getHttpVersionToken(req) {
            return req.httpVersionMajor + '.' + req.httpVersionMinor;
        },

        /**
         * UA string
         */

        'user-agent': function getUserAgentToken(req) {
            return req.headers['user-agent'];
        },

        /**
         * request header
         */

        'req': function getRequestToken(req, res, field) {
            // get header
            var header = req.headers[field.toLowerCase()]

            return Array.isArray(header)
                ? header.join(', ')
                : header;
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
                : header;
        }
    }

    return Simplifier;
})()