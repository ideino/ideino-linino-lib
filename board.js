//Board
var bridgefile = 'bridge-firmata.py',
	bridgestop = 'bridge-stop',
	bridge_loglevel = 'd',		//d = debug, i = info, w = warning, e = error
	bridge_loghandle = 'f',		//f = file, c = console, a = all (file + console)
	bridge_layout = 'y';		//y = arduino_yun
	
var	net = require('net'), 
	layout = require('./utils/layout').arduino_yun, //layout = require('./utils/layout')['arduino_yun'];
	utils = require('./utils/utils'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	socket,
	pinReg = {},		//list for storing the mode of every used pin of the board
	writeBuffer = [];	//buffer for managing the write request sent to the board
	

//CONST	
var	BUFFER_SIZE = 1000,			//items -> is the size of the buffer containing the write commands
	BUFFER_SPEED = 25,			//millis -> is the speed for sending requests from the buffer to the board
	READ_RETRY_SPEED = 1800,	//millis -> is the speed for retry to send the read command
	MODE_RETRY_SPEED = 50,		//millis -> is the speed for retry to send the pin mode command
	WAIT_BRIDGE_TIME = 10000,
	ENCODING = 'utf8'
	SERVER = '127.0.0.1',
	PORT = 9810;
	
var bridge = path.join(__dirname,'ext',bridgefile),
	stop = path.join(__dirname,'ext',bridgestop),
	event = new EventEmitter();

var spawn = require('child_process').spawn,

exec = require('child_process').exec;
exec("sh " + stop + " " + bridge, function (error, stdout, stderr) {
	proc  = spawn('python',[bridge,"-log","d","-handle","f","-layout","y"]);
	
	if(bridge_loglevel == 'd' ){
		proc.stdout.on('data', function (data) {
		  console.log('stdout: ' + data);
		});

		proc.stderr.on('data', function (data) {
		  console.log('stderr: ' + data);
		});

		proc.on('close', function (code) {
		  console.log('child process exited with code ' + code);
		});
	}
	setTimeout(function(){
		socket = net.connect({port:PORT, host:SERVER},function() {
			socket.setEncoding(ENCODING);
			console.log("Bridge Connection Success");
			//sending event from buffer
			setInterval(function(){
				sendWriteRequest();
			},BUFFER_SPEED);
			
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
			//throw new Error("Bridge Connection Failure ["+e.code+"]");
			/*
			if (e.code == 'EADDRINUSE') {
				//console.log('Address in use, retrying...');
				//TODO: TROHW ERROR
			}
			*/
			console.log("Bridge Connection Failure ["+e.code+"]");
			process.exit(1);
		});
			
	},WAIT_BRIDGE_TIME);
	
	
});

/***
* Board functions
***/
function pinMode(pin, mode) {
	try {
		//verify socket connection, recursive way
		setTimeout(function(){
			if(typeof(socket) == 'undefined'){
				setTimeout(function(){
						pinMode(pin, mode);
					}, MODE_RETRY_SPEED);
				return;
			}
			if( checkPinMode(pin, mode) ){
				//var mpin = getPin(layout,pin,'digital',mode);
				//when check connection is ok, emit the request
				var cmd = JSON.stringify({command:[{cmd: 'mode', pin: pin, mode: mode}]});
				socket.write(cmd,ENCODING,function(){
					pinReg[pin] = mode;
					console.log(JSON.stringify(pinReg));
				});
				
			}
			else{
				throw new Error("Can not call pinMode for Pin " + pin + "!");
			}
		}, MODE_RETRY_SPEED);	
	}
	catch(err){
		console.log(err);
	}
};
function digitalWrite(pin, value) {
    try {
		if(typeof(socket) != 'undefined' ){
		/*if(typeof(socket) == 'undefined'){
			setTimeout(function(){
					digitalWrite(pin, value);
				}, 50);
			return;
		}*/
			if(checkDigitalWrite(pin)){
				//var mpin = getPin(layout,pin,'digital','');
				//when check connection is ok, emit the request
				var cmd = JSON.stringify({ command:[ {cmd: 'write', pin: pin, value: value } ]});
				//socket.write(cmd,ENCODING); //when connection is ok, emit the request 
				pushWriteRequest(cmd);
			}
			else{
				throw new Error("Can not call digitalWrite for Pin " + pin + "!");
			}
		}		
	}
	catch(err){
		console.log(err);
	}
}
function analogWrite(pin, value) {
    try {
		if(typeof(socket) != 'undefined' ){
			if(checkAnalogWrite(pin)){
				//var mpin = getPin(layout,pin,'analog','');
				
				if(value>=1024) value = 1024;
				if(value<=0) value = 0;
				value = Math.round(value/1024 * 10000) / 10000; //trunc 4 decimal digits
				var cmd = JSON.stringify({ command:[ {cmd: 'write', pin: pin, value: value } ]});
				//socket.write(cmd,ENCODING); //when connection is ok, emit the request
				pushWriteRequest(cmd);
			}
			else{
				throw new Error("Can not call analogWrite for Pin " + pin + "!");
			}
		}
	}
	catch(err){
		console.log(err);
	}
}
function digitalRead(pin, callback) {
	try {
		setTimeout(function(){
			//verify socket connection, recursive way
			if(typeof(socket) == 'undefined' ){
				setTimeout(function(){
					digitalRead(pin,callback);
				}, READ_RETRY_SPEED/2);
				return;
			}
			if(checkDigitalRead(pin)){
				//var mpin = getPin(layout,pin,'digital','');
				var cmd = JSON.stringify({command:[{cmd: 'read', pin: pin}]});
				socket.write(cmd,ENCODING,readback(pin, callback)); //when connection is ok, emit the request
			}
			else{
				throw new Error("Can not call digitalRead for Pin " + pin + "!");
			}
		}, READ_RETRY_SPEED/2);	
	}
	catch(err){
		console.log(err);
	}  
}
function analogRead(pin, callback) {
    try {
		setTimeout(function(){
		//verify socket connection, recursive way
			if(typeof(socket) == 'undefined' ){
				setTimeout(function(){
					analogRead(pin,callback);
				}, READ_RETRY_SPEED/2);
				return;
			}
			if(checkAnalogRead(pin)){
				//var mpin = getPin(layout,pin,'analog','');
				var cmd = JSON.stringify({command:[{cmd: 'read', pin: pin}]});
				socket.write(cmd,'utf8',readback(pin, callback)); //when connection is ok, emit the request
			}
			else{
				throw new Error("Can not call analogRead for Pin " + pin + "!");
			}
		}, READ_RETRY_SPEED/2);
	}
	catch(err){
		console.log(err);
	}
}
function servoWrite(pin, angle){
    try {
		if(typeof(socket) != 'undefined' ){
			if(checkServoWrite(pin)){
				//var mpin = getPin(layout,pin,'digital',utils.MODES.servo);
				var cmd = JSON.stringify({command:[{cmd: 'write', pin: pin, value: angle}]});
				//socket.write(cmd,'utf8'); //when connection is ok, emit the request
				pushWriteRequest(cmd);
			}
			else{
				throw new Error("Can not call servoWrite for Pin " + pin + "!");
			}
		}
	}
	catch(err){
		console.log(err);
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
			console.log(err);
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
/*
function getPin(boardlayout, pinnumber, ad ,requestmode){
	if(typeof(boardlayout) != 'undefined' && typeof(pinnumber) != 'undefined'){
		//check if pin is disabled
		if( !boardlayout.disabled.contains(pinnumber) ){
			//check if mode is analog
			if(ad == 'analog'){
				if(boardlayout.analog.contains(pinnumber) ){
					return 'A'+pinnumber;
				}else{
					throw new Error("Pin " + pinnumber + " is not an analog pin!");
				}
			
			//else its digital
			}else{
				if(boardlayout.digital.contains(pinnumber) ){
					if(requestmode == 'pwm'){
						if(boardlayout.pwm.contains(pinnumber) ){
							return 'D'+pinnumber+'P';
						}else{
							throw new Error("Pin " + pinnumber + " is not a pwm pin!");
						}
					}else{
						if(requestmode == 'servo'){
							if(boardlayout.digital.contains(pinnumber) ){
								return 'D'+pinnumber+'S';
							}else{
								throw new Error("Pin " + pinnumber + " is not a servo pin!");
							}
						}else{
							return 'D'+pinnumber;
						}
					}
				}else{
					throw new Error("Pin " + pinnumber + " is not a digital pin!");
				}
			}
			
		}else{
			throw new Error("Pin " + pinnumber + " is disabled!");
		}
		
	}else{
		throw new Error("Undefined board type or pin number!");
	}
}
*/

/***
* Check functions
***/
function checkPinMode(pinnumber,mode){console.log(mode);
	if(	typeof(pinnumber) != 'undefined'&& 
		pinnumber.startsWith('D') 		&& 
		typeof(mode) != 'undefined' 	&& 
			(	mode == utils.MODES.OUTPUT	|| 
				mode == utils.MODES.INPUT 	||
				mode == utils.MODES.PWM 	|| 
				mode == utils.MODES.SERVO	) ){
		
		return true;
	}
	else{
		return false
	}

}
function checkDigitalWrite(pinnumber){	
	if(	typeof(pinnumber) != 'undefined' && 
		pinnumber.startsWith('D') && 
		typeof(pinReg[pinnumber]) != 'undefined'  && 
		pinReg[pinnumber].toLowerCase() == utils.MODES.OUTPUT ){
		
		return true;
	}
	else{
		return false
	}
}
function checkDigitalRead(pinnumber){
	if(	typeof(pinnumber) != 'undefined' && 
		pinnumber.startsWith('D') && 
		typeof(pinReg[pinnumber]) != 'undefined' && 
			(	pinReg[pinnumber].toLowerCase() == utils.MODES.OUTPUT || 
				pinReg[pinnumber].toLowerCase() == utils.MODES.INPUT ||
				pinReg[pinnumber].toLowerCase() == utils.MODES.PWM) ){
		
		return true;
	}
	else{
		return false
	}
}
function checkAnalogWrite(pinnumber){	
	if(	typeof(pinnumber) != 'undefined' && 
		pinnumber.startsWith('D') && 
		typeof(pinReg[pinnumber]) != 'undefined' && 
		pinReg[pinnumber].toLowerCase() == utils.MODES.PWM ){
		
		return true;
	}
	else{
		return false
	}
}
function checkAnalogRead(pinnumber){
	if(	typeof(pinnumber) != 'undefined' && 
		pinnumber.startsWith('A') ){//&& 
		//typeof(pinReg[pinnumber]) != 'undefined' && 
		//pinReg[pinnumber].toLowerCase() == 'input' ){
		
		return true;
	}
	else{
		return false
	}
}
function checkServoWrite(pinnumber){	
	if(	typeof(pinnumber) != 'undefined' && 
		pinnumber.startsWith('D') &&
		//pinnumber.endsWith('S') &&
		typeof(pinReg[pinnumber]) != 'undefined' && 
		pinReg[pinnumber].toLowerCase() == utils.MODES.SERVO ){
		
		return true;
	}
	else{
		return false
	}
}

/***
* Prototype functions
***/
Array.prototype.contains = function(obj) {
    var i = this.length;
    while (i--) {
        if (this[i] === obj) {
            return true;
        }
    }
    return false;
}
String.prototype.startsWith = function (str){
	return this.slice(0, str.length) == str;
}
String.prototype.endsWith = function (str){
	return this.slice(-str.length) == str;
}

/***
* System Functions
***/
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

/***
* Exports
***/
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