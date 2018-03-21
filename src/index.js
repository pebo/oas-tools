/*!
OAS-tools module 0.0.0, built on: 2017-03-30
Copyright (C) 2017 Ignacio Peluaga Lozada (ISA Group)
https://github.com/ignpelloz
https://github.com/isa-group/project-oas-tools

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.*/

'use strict';

var _ = require('lodash-compat');
var fs = require('fs');
var path = require('path');
var jsyaml = require('js-yaml');
var config = require('./configurations'),
  logger = config.logger;
var ZSchema = require("z-schema");
var deref = require('json-schema-deref');
var validator = new ZSchema({
  ignoreUnresolvableReferences: true
});
var controllers;
var customConfigurations = false;

/**
 * Function to set configurations. Initializes local variables that then will be used in the callback inside initializeMiddleware function.
 *@param {object} options - Parameter containing controllers location, enable logs, and strict checks. It can be a STRING or an OBJECT.
 */
var configure = function configure(options) {

  console.log("------------llamada a initializeMiddleware");

  config.setConfigurations(options);

};

/**
 * Transforms yamle's spec path format to Express format.
 *@param {object} path - Path to transform.
 */
function transformToExpress(path) {
  var res = "";
  for (var c in path) {
    if (path[c] == '{') {
      res = res + ':';
    } else if (path[c] == '}') {
      res = res + '';
    } else {
      res = res + path[c];
    }
  }
  return res;
}

/**
 * Function to initialize middlewares
 *@param {object} options - Parameter containing controllers location, Specification file, and others.
 *@param {function} callback - Function that initializes middlewares one by one in the index.js file.
 */
var initializeMiddleware = function initializeMiddleware(oasDoc, app, callback) {


  if (_.isUndefined(oasDoc)) {
    throw new Error('oasDoc is required');
  } else if (!_.isPlainObject(oasDoc)) {
    throw new TypeError('oasDoc must be an object');
  }

  if (_.isUndefined(callback)) {
    throw new Error('callback is required');
  } else if (!_.isFunction(callback)) {
    throw new TypeError('callback must be a function');
  }

  var schemaV3 = fs.readFileSync(path.join(__dirname, './schemas/openapi-3.0.json'), 'utf8');
  schemaV3 = JSON.parse(schemaV3);

  validator.validate(oasDoc, schemaV3, function (err, valid) {
    if (err) {
      logger.error("Error: " + JSON.stringify(err));
      //throw new Error('oasDoc is not valid: ');
    } else {
      logger.info("Valid specification file");
    }
  });

  //dereference original specification file
  deref(oasDoc, function (err, fullSchema) {
    logger.info("Specification file dereferenced");
    oasDoc = fullSchema;
  });

  //ESTO SOBRA SI ESTÁ LO DE ARRIBA?
  var OASRouterMid = function () {
    var OASRouter = require('./middleware/oas-router');
    return OASRouter.call(undefined, config.controllers); // ROUTER NEEDS JUST CONTROLLERS
  };
  var OASValidatorMid = function () {
    var OASValidator = require('./middleware/oas-validator');
    return OASValidator.call(undefined, oasDoc); // VALIDATOR NEEDS JUST SPEC-FILE
  };


  var paths = oasDoc.paths;
  for (path in paths) {
    for (var method in paths[path]) {
      var expressPath = transformToExpress(path);
      switch (method) {
        case 'get':
          app.get(expressPath, OASValidatorMid()); //Remember how I used this in SOS! app.get(BASE_API_PATH + "/elections-voting-stats/:province", function(request, response) { ... });
          break;
        case 'post':
          app.post(expressPath, OASValidatorMid());
          break;
        case 'put':
          app.put(expressPath, OASValidatorMid());
          break;
        default:
          app.delete(expressPath, OASValidatorMid());
          break;
      }
    }
  }

  if (config.validator == true) {
    app.use(OASValidatorMid());
  }
  if (config.router == true) {
    app.use(OASRouterMid());
  }

  callback();
};

module.exports = {
  initializeMiddleware: initializeMiddleware,
  configure: configure,
};
