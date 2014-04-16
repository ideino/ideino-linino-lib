/***
 * author: sergio tomasello - https://github.com/quasto
 * license: mit
 ***/

/*** import all prototype functions used in this module ***/
require('./utils/proto');
config = require('./config');

/*** configuring the logger ***/
_loggerhandlers = ['file','console','all'];
_loggerlevels = ['debug','info','warning','error'];
_loggerstatus = [true,false];

var winston = require('winston'),
	handlers = [],
	logger;

if( !_loggerhandlers.contains(config.logger.handler) )
	throw new Error("Set correctly property 'logger handler' in config file. "+_loggerhandlers);

if( !_loggerlevels.contains(config.logger.level) )
	throw new Error("Set correctly property 'logger level' in config file. "+_loggerlevels);

if( !_loggerstatus.contains(config.logger.off) )
	throw new Error("Set correctly property 'logger on' in config file. "+_loggerstatus);

var file_transport = new (winston.transports.File)({ 	silent:	config.logger.off,
														filename: __dirname+'/logs/ideino-linino-lib.log', 
														level: config.logger.level,
														maxsize: 100000,
														maxFiles: 3,
														timestamp: true});
													
var console_transport = new (winston.transports.Console)({ 	silent:	config.logger.off, 
															level: config.logger.level,
															timestamp: true});

if(config.logger.handler == 'file')
	handlers.push( file_transport );
if(config.logger.handler == 'console')
	handlers.push( console_transport );
if(config.logger.handler == 'all'){
	handlers.push( file_transport );
	handlers.push( console_transport );
}

logger = new (winston.Logger)({
	transports: handlers
  });

  
/*** starting and setting the boards ***/
var board = new require('./board');
board.setLogger(logger);
//board.setConfig(config);

//var dashboard = require('./dashboard');

var htmlboard = require('./htmlboard');
htmlboard.setBoard(board);
htmlboard.setLogger(logger);


exports.Board = board;
//exports.Dashboard = dashboard;
exports.Htmlboard = htmlboard;

/*
exports.Board = board;
exports.Htmlboard = function(){
	var htmlboard = require('./htmlboard');
	htmlboard.setBoard(board);
	htmlboard.setLogger(logger);
	return htmlboard;
};*/