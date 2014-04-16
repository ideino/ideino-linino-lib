/***
 * file: board.js
 * version: 0.1.0
 * author: sergio tomasello - https://github.com/quasto
 * license: mit
 ***/

//Board
var default_board_layout = "arduino_yun";	//TODO get from constructor or config file

var bridgefile = 'bridge-firmata.py',
	bridgestop = 'bridge-stop',
	//default values for bridge;
	bridge_loglevel = 'd',		//d = debug, i = info, w = warning, e = error
	bridge_loghandle = 'f',		//f = file, c = console, a = all (file + console)
	bridge_layout = 'y';		//y = arduino_yun
	
var	net = require('net'), 
	layouts = require('./utils/layout'),
	layout = layouts[default_board_layout],
	utils = require('./utils/utils'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	socket,
	logger,
	pinReg = {},		//list for storing the mode of every used pin of the board
	writeBuffer = [];	//buffer for managing the write request sent to the board
	

//CONST	
var	BUFFER_SIZE = 1000,			//items -> is the size of the buffer containing the write commands
	BUFFER_SPEED = 25,			//millis -> is the speed for sending requests from the buffer to the board
	WAIT_BRIDGE_TIME = 12000,	//millis -> is the time before start the bridge
	ENCODING = 'utf8',
	SERVER = '127.0.0.1',
	PORT = 9810;
	
var bridge = path.join(__dirname,'ext',bridgefile),
	stop = path.join(__dirname,'ext',bridgestop),
	event = new EventEmitter();

var spawn = require('child_process').spawn,
	exec = require('child_process').exec;

var CHECK_MSG = {	PIN_UNDEFINED : 	"The specified pin is undefined!",
					PIN_NOT_DIGITAL: 	"The specified pin [{0}] is not a Digital pin",
					PIN_NOT_ANALOG: 	"The specified pin [{0}] is not an Analog pin",
					PIN_NOT_VIRTUAL: 	"The specified pin [{0}] is not a Virtual pin",
					PIN_NOT_LAYOUT:		"The specified pin [{0}] is not defined in the board layout!",
					PIN_NOT_DEFINED:	"The specified pin [{0}] is not already defined! You must first, call pinMode!",
					MODE_NOT_VALID: 	"The specified mode [{0}] for pin [{1}] is not valid.",
					MODE_UNDEFINED : 	"The specified mode for pin [{0}] is undefined!"
				}
				
function connect( loglevel, callback ){
	
	/*** parameters managament ***/
	//thanks to klovadis: https://gist.github.com/klovadis/2549131
	
	// retrieve arguments as array
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
        args.push(arguments[i]);
    }
	
	callback = args.pop();
	
	//check loglevel parameters
	if (args.length > 0) loglevel = args.shift(); else loglevel = 'error';
    //check for future optional parameters
	//if (args.length > 0) optional = args.shift(); else optional = null;
	
	

	exec("sh " + stop + " " + bridgefile, function (error, stdout, stderr) {
		proc  = spawn('python',[bridge,"-log","w","-handle",bridge_loghandle,"-layout",bridge_layout]);
		
		if(bridge_loglevel == 'd' ){
			proc.stdout.on('data', function (data) {
			  logger.debug('BRIDGE STDOUT: ' + data);
			});

			proc.stderr.on('data', function (data) {
			  logger.error('BRIDGE STDERR: ' + data);
			});

			proc.on('close', function (code) {
			  logger.debug('child process exited with code ' + code);
			});
		}
		
		logger.info("Connecting to the Board...");
		setTimeout(function(){
			socket = net.connect({port:PORT, host:SERVER},function() {
				socket.setEncoding(ENCODING);
				logger.info("Board Connection Success");
				
				//sending event from buffer
				setInterval(function(){
					sendWriteRequest();
				},BUFFER_SPEED);
				callback(true);
			});
			socket.on('data', function(data) {
				//console.log(data.toString());	//message from server
				if ( data.search('}{') == -1){
					eventEmit(data);
				}
				else{
					data=data.replace(/}{/g,'}~{').split('~');
					data.forEach(function(cmditem) {
						eventEmit(cmditem);
					});
				}
			});
			socket.on('error', function (e) {
				//throw new Error("Board Connection Failure ["+e.code+"]");
				/*
				if (e.code == 'EADDRINUSE') {
					//console.log('Address in use, retrying...');
					//TODO: TROHW ERROR
				}
				*/
				logger.error("Board Connection Failure ["+e.code+"]");
				exec("sh " + stop + " " + bridgefile, function (error, stdout, stderr) {
					process.exit(1);
				});
			});
				
		},WAIT_BRIDGE_TIME);
		
		
	});
}

/***
* Board functions
***/
function pinMode(pin, mode) {
	try {
		checkPinMode(pin,mode,function(err){
			if(err){
				throw err;
			}
			else{
				var cmd = JSON.stringify({command:[{cmd: 'mode', pin: pin, mode: mode.toLowerCase()}]});
				socket.write(cmd,ENCODING,function(){
					pinReg[pin] = mode;
					logger.debug("pin " + pin + " is set to " + mode + " mode.");
				});
			}
		});
	}
	catch(err){
		logger.error("BOARD PIN MODE ERROR - " + err.message);
		exec("sh " + stop + " " + bridgefile, function (error, stdout, stderr) {
			process.exit(1);
		});		
	}
}
function digitalWrite(pin, value) {
    try {
		process.nextTick(function(){
			checkDigitalWrite(pin, function(err){
				if(err){
					logger.error(err.message);
				}else{
					var cmd = JSON.stringify({ command:[ {cmd: 'write', pin: pin, value: value } ]});
					pushWriteRequest(cmd);
				}
			});		
		});
	}
	catch(err){
		logger.error("BOARD DIGITAL WRITE ERROR - " + err.message);
	}
}
function analogWrite(pin, value) {
    try {
		process.nextTick(function(){
			checkAnalogWrite(pin, function(err){
				if(err){
					logger.error(err.message);
				}else{
					if(value>=1024) value = 1024;
					if(value<=0) value = 0;
					value = Math.round(value/1024 * 10000) / 10000; //trunc 4 decimal digits
					var cmd = JSON.stringify({ command:[ {cmd: 'write', pin: pin, value: value } ]});
					//socket.write(cmd,ENCODING); //when connection is ok, emit the request
					pushWriteRequest(cmd);
				}
			});
		});
	}
	catch(err){
		logger.error("BOARD ANALOG WRITE ERROR - " + err.message);
	}
}
function digitalRead(pin, callback) {
	try {
		process.nextTick(function(){
			checkDigitalRead(pin,function(err){
				if(err){
					logger.error(err.message);
				}
				else{
					var cmd = JSON.stringify({command:[{cmd: 'read', pin: pin}]});
					socket.write(cmd,ENCODING,readback(pin, callback)); //when connection is ok, emit the request
				}
			});
		});
	}
	catch(err){
		logger.error("BOARD DIGITAL READ ERROR - " + err.message);
	}  
}
function analogRead(pin, callback) {
    try {
		process.nextTick(function(){
			checkAnalogRead(pin,function(err){
				if(err){
					logger.error(err.message);
				}
				else{
					var cmd = JSON.stringify({command:[{cmd: 'read', pin: pin}]});
					socket.write(cmd,'utf8',readback(pin, callback)); //when connection is ok, emit the request
				}
			});
		});
	}
	catch(err){
		logger.error("BOARD ANALOG READ ERROR - " + err.message);
	}
}
function servoWrite(pin, angle){
    try {
		process.nextTick(function(){
			checkServoWrite(pin,function(err){
				if(err){
					logger.error(err.message);
				}
				else{
					var cmd = JSON.stringify({command:[{cmd: 'write', pin: pin, value: angle}]});
					//socket.write(cmd,'utf8'); //when connection is ok, emit the request
					pushWriteRequest(cmd);
				}
			});
		});
	}
	catch(err){
		logger.error("BOARD SERVO WRITE ERROR - " + err.message);
	}
}

/***
* Virtual Board functions
***/ 
function virtualWrite(virtualpin, value){
	try {
		checkVirtualWrite(pin,function(err){
			if(err){
				logger.error(err.message);
			}
			else{
				var cmd = JSON.stringify({ command:[ {cmd: 'virtualwrite', pin: virtualpin, value: value } ]});
				pushWriteRequest(cmd);
			}
		});
				
	}
	catch(err){
		logger.error(err);
	}
}
function virtualRead(virtualpin, calback){
	try {
		checkVirtualRead(pin,function(err){
			if(err){
				logger.error(err.message);
			}
			else{
				var cmd = JSON.stringify({command:[{cmd: 'vread', pin: virtualpin}]});
				socket.write(cmd,ENCODING,readback(pin, callback)); //when connection is ok, emit the request
			}
		});
	}
	catch(err){
		logger.error(err.message);
	} 
}

/***
* Lib functions
***/
function eventEmit(data){
	if(	typeof(data) != 'undefined'){
		try{
			datajson = JSON.parse(data);
			if( typeof(datajson.cmd) != 'undefined' && 
				datajson.cmd == 'read-back'){
				event.emit('read-back-'+datajson.pin, data);
			}
		}
		catch(err){
			logger.error("BOARD EVENT EMIT ERROR - " + err.message);
		}
	}
}
function readback(mpin, callback){
	if(typeof(socket) != 'undefined' ){
		event.on('read-back-'+mpin,function(data){
			callback(JSON.parse(data));
		});
	}
}

/***
* Check functions
***/
function checkPinMode(pinnumber,mode, callback){
	if( typeof(pinnumber) == 'undefined'){
		callback( new Error(CHECK_MSG.PIN_UNDEFINED) );return false;
	}
	if( !pinnumber.toLowerCase().startsWith('d')){ 
		callback( new Error(String.format(CHECK_MSG.PIN_NOT_DIGITAL,pinnumber)) );return false
	}
	if( !contains(layout.digital, pinnumber) ){
		callback( new Error(String.format(CHECK_MSG.PIN_NOT_LAYOUT,pinnumber)) );return false;
	}
	if( typeof(mode) == 'undefined'){
		callback(new Error(String.format(CHECK_MSG.MODE_UNDEFINED,pinnumber)) );return false;
	}
	if(	mode.toLowerCase() != utils.MODES.OUTPUT.toLowerCase()	&& 
		mode.toLowerCase() != utils.MODES.INPUT.toLowerCase() 	&&
		mode.toLowerCase() != utils.MODES.PWM.toLowerCase() 	&& 
		mode.toLowerCase() != utils.MODES.SERVO.toLowerCase()	){
		callback(new Error(String.format(CHECK_MSG.MODE_NOT_VALID, mode, pinnumber) + " Allowed modes are: "+ utils.MODES.OUTPUT +", "+ utils.MODES.INPUT + ", "+ utils.MODES.PWM + ", "+ utils.MODES.SERVO ));return false;
	}
	
	callback(null);
	return true;

}
function checkDigitalWrite(pinnumber, callback){	
	if( typeof(pinnumber) == 'undefined'){
		callback( new Error( CHECK_MSG.PIN_UNDEFINED ) );return false;
	}
	if( !pinnumber.toLowerCase().startsWith('d')){ 
		callback( new Error( String.format(CHECK_MSG.PIN_NOT_DIGITAL, pinnumber) ) );return false;
	}
	if(typeof(pinReg[pinnumber]) == 'undefined'){
		callback( new Error( String.format(CHECK_MSG.PIN_NOT_DEFINED, pinnumber) ) );return false;
	}
	if( !contains(layout.digital, pinnumber) ){
		callback( new Error(String.format(CHECK_MSG.PIN_NOT_LAYOUT, pinnumber) ) );return false;
	}
	if(pinReg[pinnumber].toLowerCase() != utils.MODES.OUTPUT.toLowerCase() ){
		callback(new Error( String.format(CHECK_MSG.MODE_NOT_VALID, pinReg[pinnumber].toLowerCase(), pinnumber) + " Allowed modes are: "+ utils.MODES.OUTPUT));return false;
	}
	
	callback(null);
	return true;
}
function checkDigitalRead(pinnumber, callback){
	if( typeof(pinnumber) == 'undefined'){
		callback( new Error( CHECK_MSG.PIN_UNDEFINED ) );return false;
	}
	if( !pinnumber.toLowerCase().startsWith('d')){ 
		callback( new Error( String.format(CHECK_MSG.PIN_NOT_DIGITAL, pinnumber) ) );return false;
	}
	if(typeof(pinReg[pinnumber]) == 'undefined'){
		callback( new Error( String.format(CHECK_MSG.PIN_NOT_DEFINED, pinnumber) ) );return false;
	}
	if( !contains(layout.digital, pinnumber) ){
		callback( new Error(String.format(CHECK_MSG.PIN_NOT_LAYOUT, pinnumber) ) );return false;
	}
	if(	pinReg[pinnumber].toLowerCase() != utils.MODES.OUTPUT.toLowerCase()	&& 
		pinReg[pinnumber].toLowerCase() != utils.MODES.INPUT.toLowerCase() 	&&
		pinReg[pinnumber].toLowerCase() != utils.MODES.PWM.toLowerCase() ){
		callback(new Error(String.format(CHECK_MSG.MODE_NOT_VALID, pinReg[pinnumber].toLowerCase(), pinnumber) + " Allowed modes are: "+ utils.MODES.OUTPUT +", "+ utils.MODES.INPUT + ", "+ utils.MODES.PWM ));return false;
	}
	
	callback(null);
	return true;
}
function checkAnalogWrite(pinnumber,callback){	
	if( typeof(pinnumber) == 'undefined'){
		callback( new Error( CHECK_MSG.PIN_UNDEFINED ) );return false;
	}
	if( !pinnumber.toLowerCase().startsWith('d')){ 
		callback( new Error( String.format(CHECK_MSG.PIN_NOT_DIGITAL, pinnumber) ) );return false;
	}
	if(typeof(pinReg[pinnumber]) == 'undefined'){
		callback( new Error( String.format(CHECK_MSG.PIN_NOT_DEFINED, pinnumber) ) );return false;
	}
	if( !contains(layout.pwm, pinnumber) ){
		callback( new Error(String.format(CHECK_MSG.PIN_NOT_LAYOUT, pinnumber) ) );return false;
	}
	if(pinReg[pinnumber].toLowerCase() != utils.MODES.PWM.toLowerCase() ){
		callback(new Error( String.format(CHECK_MSG.MODE_NOT_VALID, pinReg[pinnumber].toLowerCase(), pinnumber) + " Allowed modes are: "+ utils.MODES.PWM));return false;
	}
	
	callback(null);
	return true;

}
function checkAnalogRead(pinnumber,callback){
	if( typeof(pinnumber) == 'undefined'){
		callback( new Error( CHECK_MSG.PIN_UNDEFINED ) );return false;
	}
	if( !pinnumber.toLowerCase().startsWith('a')){ 
		callback( new Error( String.format( CHECK_MSG.PIN_NOT_ANALOG, pinnumber ) ) );return false;
	}
	/* analog pin are in input mode (default), non verifico il pin mode
	if(typeof(pinReg[pinnumber]) == 'undefined'){
		callback( new Error( String.format(CHECK_MSG.PIN_NOT_DEFINED, pinnumber) ) );return false;
	}
	*/
	if( !contains(layout.analog, pinnumber) ){
		callback( new Error(String.format(CHECK_MSG.PIN_NOT_LAYOUT, pinnumber) ) );return false;
	}
	callback(null);
	return true;
}
function checkServoWrite(pinnumber,callback){	
	if( typeof(pinnumber) == 'undefined'){
		callback( new Error( CHECK_MSG.PIN_UNDEFINED ) );return false;
	}
	if( !pinnumber.toLowerCase().startsWith('d')){ 
		callback( new Error( String.format( CHECK_MSG.PIN_NOT_DIGITAL, pinnumber ) ) );return false;
	}
	if(typeof(pinReg[pinnumber]) == 'undefined'){
		callback( new Error( String.format(CHECK_MSG.PIN_NOT_DEFINED, pinnumber) ) );return false;
	}
	if( !contains(layout.servo, pinnumber) ){
		callback( new Error(String.format(CHECK_MSG.PIN_NOT_LAYOUT, pinnumber) ) );return false;
	}
	if(pinReg[pinnumber].toLowerCase() != utils.MODES.SERVO.toLowerCase() ){
		callback(new Error( String.format(CHECK_MSG.MODE_NOT_VALID, pinReg[pinnumber].toLowerCase(), pinnumber) + " Allowed modes are: "+ utils.MODES.SERVO));return false;
	}
	
	callback(null);
	return true;
}
function checkVirtualWrite(pinnumber, callback){	
	if( typeof(pinnumber) == 'undefined'){
		callback( new Error( CHECK_MSG.PIN_UNDEFINED ) );return false;
	}
	if( !pinnumber.toLowerCase().startsWith('v')){ 
		callback( new Error( String.format( CHECK_MSG.PIN_NOT_VIRTUAL, pinnumber ) ) );return false;
	}
	callback(null);
	return true;
}
function checkVirtualRead(pinnumber){	
	if( typeof(pinnumber) == 'undefined'){
		callback( new Error( CHECK_MSG.PIN_UNDEFINED ) );return false;
	}
	if( !pinnumber.toLowerCase().startsWith('v')){ 
		callback( new Error( String.format( CHECK_MSG.PIN_NOT_VIRTUAL, pinnumber ) ) );return false;
	}
	callback(null);
	return true;
}

/***
* System Functions
***/
function setLogger(l){
	logger = l;
}
function setConfig(c){
	config = c;
	//TODO: manca la gestione del layout al momento è fisso arduino_yun
	bridge_loglevel = config.logger.level[0];	'd',	//d = debug, i = info, w = warning, e = error
	bridge_loghandle = config.logger.handler[0];		//f = file, c = console, a = all (file + console)
	bridge_layout = 'y';								//y = arduino_yun
}

//push write command for bridge inside a buffer
function pushWriteRequest(cmd){
	if(writeBuffer.length < BUFFER_SIZE){
		writeBuffer.push(cmd);
	}
}

//get the command from the buffer and send it to the bridge
function sendWriteRequest(){
	if(typeof(socket) != 'undefined' && writeBuffer.length > 0){
		socket.write(writeBuffer.shift(), ENCODING);
	}
}

//verify if an object contains this value
function contains(obj, val){
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop) && obj[prop] === val) {
            return true;   
        }
    }
    return false;
}


/***
* Exports
***/
exports.connect = connect;
exports.setLogger = setLogger;
exports.setConfig = setConfig;
exports.pinMode = pinMode;
exports.digitalRead = digitalRead;
exports.analogRead = analogRead;
exports.digitalWrite = digitalWrite;
exports.analogWrite = analogWrite;
exports.servoWrite = servoWrite;
exports.MODES = utils.MODES;
exports.HIGH = utils.HIGH;
exports.LOW = utils.LOW;
exports.pin = layout;//sarebbe meglio passare il tipo di layout nel costruttore Board e dinamicamente caricare il layout.