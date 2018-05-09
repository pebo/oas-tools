#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');
var path = require('path');
var jsyaml = require('js-yaml');
var ZSchema = require('z-schema');
var validator = new ZSchema({
  ignoreUnresolvableReferences: true
});
var utils = require("../src/lib/utils.js");
var config = require('../src/configurations'),
  logger = config.logger;
var shell = require('shelljs');
var zipdir = require('zip-dir');
var touch = require("touch");
var beautify = require('js-beautify').js;

var schemaV3 = fs.readFileSync(path.join(__dirname, './schemas/openapi-3.0.json'), 'utf8');
schemaV3 = JSON.parse(schemaV3);

/**
 * Generates a valid value for package.json's name property: TODO: Improve this!
 *    -All lowercase
 *    -One word, no spaces
 *    -Dashes and underscores allowed.
 * @param {object} title - Value of oasDoc.info.title.
 */
function getValidName(title) {
  var valid_name = /^[0-9a-z]+[0-9a-z-_]+$/;
  var newStr = "";
  for (var i = 0; i < title.length; i++) {
    if (title[i] == title[i].toUpperCase()) {
      newStr = newStr + title[i].toLowerCase();
    } else {
      newStr = newStr + title[i];
    }
  }
  title = newStr;
  if (title.match(valid_name)) {
    logger.debug("Title property of oasDoc's info section is a valid value for package name:" + title);
    return title;
  } else {
    var generated_name = title.replace(/[^0-9a-z-_]/g, "");
    logger.debug("Title property of oasDoc's info section doesn't have a valid value for package name. Generated: " + generated_name);
    return generated_name;
  }
}


program
  .arguments('<file>')
  .action(function(file) {
    try {
      var spec = fs.readFileSync(path.join(__dirname, file), 'utf8');
      var oasDoc = jsyaml.safeLoad(spec);
      logger.info('Input oas-doc %s: %s', file, oasDoc);
      validator.validate(oasDoc, schemaV3, function(err, valid) {
        if (err) {
          logger.error('oasDoc is not valid: ' + JSON.stringify(err));
          process.exit();
        } else {
          shell.exec('mkdir nodejs-server-generated');
          shell.cd('nodejs-server-generated');
          shell.cp('../auxiliary/README.md', './README.md');

          shell.exec('mkdir .oas-generator && echo 1.0.0 > .oas-generator/VERSION');

          shell.exec('mkdir api');
          shell.cp('../' + file, './api/oas-doc.yaml');

          shell.exec('mkdir utils');
          shell.cp('../auxiliary/writer.js', './utils/writer.js');

          shell.exec('mkdir controllers');
          var paths = oasDoc.paths;
          var opId;
          var controllerName;
          var controller_files = [];
          for (path in paths) {
            for (var method in paths[path]) {
              if (paths[path][method].operationId != undefined) {
                opId = utils.normalize(paths[path][method].operationId);
              } else {
                opId = utils.normalize(utils.generateOperationId(method, path));
                logger.debug("Oas-doc does not have opearationId property for " + method.toUpperCase() + " - " + path + " -> operationId name autogenerated: " + opId);
              }
              if (paths[path][method]['x-router-controller'] != undefined) { 
                controllerName = paths[path][method]['x-router-controller'];
              }else if (paths[path][method]['x-swagger-router-controller'] != undefined) {
                controllerName = paths[path][method]['x-swagger-router-controller'];
              }
              else {
                controllerName = utils.getBasePath(utils.getExpressVersion(path)) + "Controller";
                logger.debug("Oas-doc does not have routing property for " + method.toUpperCase() + " - " + path + " -> controller name autogenerated: " + utils.normalize_controllerName(controllerName));
              }
              controllerName = utils.normalize_controllerName(controllerName);
              logger.debug("Write: " + opId);
              if (!controller_files.includes(controllerName)) {
                controller_files.push(controllerName);
                controller_files.push(controllerName + "Service");
                var header = "'use strict' \n\nvar " + controllerName + " = require('./" + controllerName + "Service');\n\n";
                fs.appendFileSync(__dirname + '/nodejs-server-generated/controllers/' + controllerName + ".js", header);
                fs.appendFileSync(__dirname + '/nodejs-server-generated/controllers/' + controllerName + "Service.js", "'use strict'\n\n");
              }
              var function_string = "module.exports." + opId + " = function " + opId + " (req, res, next) {\n" + controllerName + "." + opId + "(req.swagger.params, res, next);\n};\n\n";
              var function_string_service = "module.exports." + opId + " = function " + opId + " (req, res, next) {\nres.send({message: 'This is the raw controller for " + opId + "' });\n};\n\n";
              fs.appendFileSync(__dirname + '/nodejs-server-generated/controllers/' + controllerName + ".js", function_string);
              fs.appendFileSync(__dirname + '/nodejs-server-generated/controllers/' + controllerName + "Service.js", function_string_service);
            }
          }

          for (var i = 0; i < controller_files.length; i++) {
            logger.debug("Beautify file " + controller_files[i]);
            var data = fs.readFileSync(__dirname + '/nodejs-server-generated/controllers/' + controller_files[i] + ".js", 'utf8');
            fs.writeFileSync(__dirname + '/nodejs-server-generated/controllers/' + controller_files[i] + ".js", beautify(data, {
              indent_size: 2,
              space_in_empty_paren: true
            }));
          }

          touch.sync('.oas-generator-ignore');
          shell.cp('../auxiliary/index.js', './index.js');

          var package_raw = {
            "name": getValidName(oasDoc.info.title),
            "version": "1.0.0",
            "description": "No description provided (generated by OAS Codegen)",
            "main": "index.js",
            "scripts": {
              "prestart": "npm install",
              "start": "node index.js"
            },
            "keywords": [
              "OAI"
            ],
            "license": "Unlicense",
            "private": true,
            "dependencies": {
              "express": "^4.16.3",
              "js-yaml": "^3.3.0"
              //TODO: should have here oas-tools "oas-tools": "1.0.0"
            }
          };

          fs.appendFileSync(__dirname + '/nodejs-server-generated/' + 'package.json', JSON.stringify(package_raw));

          shell.cd('..');

          zipdir('./nodejs-server-generated', {
            saveTo: 'nodejs-server-generated.zip'
          }, function(err, buffer) {
            if (err) {
              logger.error('Compressor error: ', err);
            } else {
              logger.debug('---< NodeJS project ZIP generated! >---');
              //shell.rm('-r', 'nodejs-server-generated');
            }
          });
        }
      });
    } catch (err) {
      logger.error(err);
    }
  })
  .parse(process.argv);
