'use strict';

/**
 * Removes parameters from the requested path and returns the base path.
 * @param {string} reqRoutePath - Value or req.route.path (express version).
 */
var getBasePath = function(reqRoutePath) {
  var basePath = "";
  var first = true;
  var path_array = reqRoutePath.split('/');
  for (var i = 0; i < path_array.length; i++) {
    //if (path_array[i].charAt(0) !== ':' && first == true && path_array[i].charAt(0) !== '') { // TODO: compare to '' or ' '?
    if (path_array[i].charAt(0) !== ':' && first == true && path_array[i].charAt(0) !== '') {
      basePath += path_array[i];
      first = false;
    } else if (path_array[i].charAt(0) !== ':') {
      basePath += path_array[i].charAt(0).toUpperCase() + path_array[i].slice(1, path_array[i].length);
    }
  }
  return basePath;
}

/** TODO: for paths like /2.0/votos/{talkId}/ swagger creates 2_0votosTalkId que no es válido! qué debe hacer oas-tools?
 * Generates an operationId according to the method and path requested the same way swagger-codegen does it.
 * @param {string} method - Requested method.
 * @param {string} path - Requested path as shown in the oas doc.
 */
var generateOperationId = function(method, path) {
  var output = "";
  var path = path.split('/');
  for (var i = 1; i < path.length; i++) {
    var chunck = path[i].replace(/[{}]/g, '');
    output += chunck.charAt(0).toUpperCase() + chunck.slice(1, chunck.length);
  }
  output += method.toUpperCase();
  return output.charAt(0).toLowerCase() + output.slice(1, output.length);
}

/**
 * OperationId can have values which are not accepted as function names. This function generates a valid name
 * @param {object} operationId - OpreationId of a given path-method pair.
 */
var normalize = function(operationId) {
  if (operationId == undefined) {
    return undefined;
  } else {
    var validOpId = "";
    for (var i = 0; i < operationId.length; i++) {
      if (operationId[i] == '-' || operationId[i] == ' ' || operationId[i] == '.') {
        validOpId += "";
        validOpId += operationId[i + 1].toUpperCase();
        i = i + 1;
      } else {
        validOpId += operationId[i];
      }
    }
    return validOpId;
  }
}

/**
 * The generated controller name is done using the path or the router property and these can have characters which are
 * allowed for variable names. As services must be required in controller files these names must be normalized.
 * @param {string} controllerName - Name of controller, either autogenerated or specified using router property.
 */
var normalize_controllerName = function(controllerName) {
  return controllerName.replace(/^[^a-zA-Z]*/, '').replace(/[^a-zA-Z0-9]*/g, '');
}

/**
 * Converts a oas-doc type path into an epxress one.
 * @param {string} oasPath - Path as shown in the oas-doc.
 */
var getExpressVersion = function(oasPath) {
  return oasPath.replace(/{/g, ':').replace(/}/g, '');
}

module.exports = {
  getBasePath: getBasePath,
  generateOperationId: generateOperationId,
  normalize: normalize,
  normalize_controllerName: normalize_controllerName,
  getExpressVersion: getExpressVersion
};
