var path = require('path'),
	fs = require('fs'),
	winston = require('winston'),
	_ = require('underscore');

var modes = { 
				INPUT : 'input', 
				OUTPUT : 'output', 
				PWM: 'pwm', 
				SERVO: 'servo'
			};

/*** get and config the logger ***/			
var getLogger = function(logger_config){
	var _loggerhandlers = ['file', 'console', 'all'];
	_loggerlevels = ['debug', 'info', 'warn', 'error'];
	_loggerstatus = [true, false];
	
	var	handlers = [],
		_logdir = path.join(__dirname,'..','logs');
		
	if( !_.contains(_loggerhandlers,logger_config.handler) )
		throw new Error("Set correctly property 'logger handler' in config file. "+_loggerhandlers);

	if( !_.contains(_loggerlevels,logger_config.level) )
		throw new Error("Set correctly property 'logger level' in config file. "+_loggerlevels);

	if( !_.contains(_loggerstatus,logger_config.off) )
		throw new Error("Set correctly property 'logger on' in config file. "+_loggerstatus);

	if( !fs.existsSync(_logdir) ){
		fs.mkdirSync(_logdir);
	}	

	var file_transport = new (winston.transports.File)({ 	silent:	logger_config.off,
															filename: path.join(_logdir,'ideino-linino-lib.log'), 
															level: logger_config.level,
															maxsize: 100000,
															maxFiles: 3,
															timestamp: true});
														
	var console_transport = new (winston.transports.Console)({ 	silent:	logger_config.off, 
																level: logger_config.level,
																timestamp: true});

	if(logger_config.handler == 'file')
		handlers.push( file_transport );
	if(logger_config.handler == 'console')
		handlers.push( console_transport );
	if(logger_config.handler == 'all'){
		handlers.push( file_transport );
		handlers.push( console_transport );
	}

	return new (winston.Logger)({
		transports: handlers
	});
}
/*** recursively merge properties of two objects ***/
var mergeRecursive = function(obj1, obj2) {
  for (var p in obj2) {
    try {
      // Property in destination object set; update its value.
      if ( obj2[p].constructor==Object ) {
        obj1[p] = mergeRecursive(obj1[p], obj2[p]);
      } 
	  else {
        obj1[p] = obj2[p];
      }
    } catch(e) {
      // Property in destination object not set; create it and set its value.
      obj1[p] = obj2[p];
    }
  }
  return obj1;
}
/*** verify if an object contains this value ***/
var contains = function(obj, val){
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop) && obj[prop] === val) {
            return true;   
        }
    }
    return false;
}

exports.MODES = modes;
exports.HIGH = 1;
exports.LOW = 0;
exports.getLogger = getLogger;
exports.mergeRecursive = mergeRecursive;
exports.contains = contains;