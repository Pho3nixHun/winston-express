
module.exports = exports = (function () {
    "use strict";
    const fs = require('fs');
    const path = require('path');
    const onFinished = require('on-finished');
    const onHeaders = require('on-headers');
    const winston = require('winston');
    const extend = require('xtend');
    const Simplifier = require('./assets/simplifiers');
    const statuscodeMap = require('./assets/httpStatuscodeMap.json');
    const apiCheck = require('api-check')();
    let defaults = winstonExpress.defaults = {
        accessLevel: 'info',
        accessFileName: 'access.log',
        errorLevel: 'error',
        errorFileName: 'error.log',
        logFolder: path.join(__dirname, 'logs'),
        maxFileSize: 5242880, //5MB
        maxFiles: 5,
        json: true,
        console: true,
        consoleLevel: 'debug',
        consoleColor: true,
        consoleJson: false,
        suppressExceptions: true,
        format: 'combined'
    };
    let optionsShape = winstonExpress.apiCheck = [
        apiCheck.shape({
            accessLevel: apiCheck.oneOf(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).optional,
            accessFileName: apiCheck.string.optional,
            errorLevel: apiCheck.oneOf(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).optional,
            errorFileName: apiCheck.string.optional,
            logFolder: apiCheck.string.optional,
            maxFileSize: apiCheck.number.optional,
            maxFiles: apiCheck.number.optional,
            json: apiCheck.bool.optional,
            console: apiCheck.bool.optional,
            consoleLevel: apiCheck.oneOf(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).optional,
            consoleColor: apiCheck.bool.optional,
            consoleJson: apiCheck.bool.optional,
            suppressExceptions: apiCheck.bool.optional,
            format: apiCheck.oneOfType([apiCheck.string, apiCheck.arrayOf(apiCheck.string)]).optional
        })
    ]
    function winstonExpress(options) {
        apiCheck.throw(winstonExpress.apiCheck, arguments);
        let _o = extend(winstonExpress.defaults, options)
        fs.existsSync(_o.logFolder) || fs.mkdirSync(_o.logFolder); // Create log folder if not exists
        let format;
        const simplifier = new Simplifier();
        if (!(apiCheck.arrayOf(apiCheck.string)(_o.format) instanceof Error)) {
            format = 'winston-express';
            simplifier.registerFormat(format, _o.format);
        } else {
            format = _o.format
        };

        const transports = [
            new (winston.transports.File)({
                name: 'access',
                level: _o.accessLevel,
                filename: path.join(_o.logFolder, _o.accessFileName),
                handleExceptions: _o.suppressExceptions,
                json: _o.json,
                maxsize: _o.maxFileSize,
                maxFiles: _o.maxFiles,
                colorize: false
            }),
            new (winston.transports.File)({
                name: 'error',
                level: 'error',
                filename: './logs/error.log',
                handleExceptions: true,
                json: true,
                maxsize: 5242880, //5MB
                maxFiles: 5,
                colorize: false
            })
        ];
        if (_o.console) transports.push(
            new (winston.transports.Console)({
                name: 'console',
                level: _o.consoleLevel,
                handleExceptions: _o.suppressExceptions,
                json: _o.consoleJson,
                colorize: _o.consoleColor
            })
        )
        const logger = new winston.Logger({
            transports: transports
        })

        var winstonExpressMiddleware = function winstonExpressMiddleware(req, res, next) {
            req._startAt = undefined
            req._startTime = undefined
            req._remoteAddress = Simplifier.defaultSimplifiers['remote-addr'](req);
            res._startAt = undefined
            res._startTime = undefined
            // record request start
            recordStartTime.call(req);
            onHeaders(res, recordStartTime);
            onFinished(res, logRequest);
            function logRequest(){
                let code = statuscodeMap[res.statusCode] || 'error';
                let details = simplifier.compile(format, req, res);
                logger[code](details);
            }
            function recordStartTime () {
                this._startAt = process.hrtime()
                this._startTime = new Date()
            }
            next();
        }
        winstonExpressMiddleware.logger = logger;

        return winstonExpressMiddleware;
    }
    return winstonExpress;
})() 