'use strict';

const express = require('express');
const winstonExpress = require('./winston-express')({
  accessLevel: 'verbose',
  accessFileName: 'doodly.log',
  errorLevel: 'warn',
  errorFileName: 'diidly.log',
  logFolder: './logs',
  maxFileSize: 5242880, //5MB
  maxFiles: 5,
  json: true,
  console: true,
  consoleLevel: 'debug',
  consoleColor: true,
  consoleJson: false,
  suppressExceptions: true,
  format: 'combined'
});
const logger = winstonExpress.logger;

const app = express();
app.use(winstonExpress);

app.get('/server-error', function(req, res, next){
  res.status(500).end('Ooops...');
})
app.get('/client-error', function(req, res, next){
  res.status(404).end('Have you tried at / ?');
})
app.get('/unusual-code', function(req, res, next){
  res.status(305).end('I see you...');
})
app.get('/invalid-code', function(req, res, next){
  res.status(999).end('Sprechen sie jiberish?');
})
app.get('/', function(req, res, next){
  let remoteAddr = (function getip(req) {
    return req.ip ||
        req._remoteAddress ||
        (req.connection && req.connection.remoteAddress) ||
        undefined;
  })(req);
  logger.debug('Hello from', remoteAddr);
  res.status(200).end('<h3>Here is a cool picture:</h3> <img src=http://source.unsplash.com/random alt="random pic from unsplash" />');
})

app.listen(8000, ()=>{
  console.log('Listening on port 8000')
})