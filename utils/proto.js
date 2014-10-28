//Provides compatibility shims so that legacy JavaScript engines behave as closely as possible to ECMAScript 6 (Harmony).
require('es6-shim');

String.format = function() {
  var s = arguments[0];
  for (var i = 0; i < arguments.length - 1; i++) {       
    var reg = new RegExp("\\{" + i + "\\}", "gm");             
    s = s.replace(reg, arguments[i + 1]);
  }
  return s;
}

String.prototype.removeBreakLine = function() { 
	return this.replace(/(\r\n|\n|\r)/gm," ");
}