//Board
var server = '127.0.0.1',
	port = 9810,
	bridgefile = 'bridge-firmata.py',
	bridgestop = 'bridge-stop',
	debug = false;
	
var	net = require('net'), 
	layout = require('./utils/layout').arduino_yun, //layout = require('./utils/layout')['arduino_yun'];
	utils = require('./utils/utils'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	socket,
	pinReg = {};	

var bridge = path.join(__dirname,'ext',bridgefile),
	stop = path.join(__dirname,'ext',bridgestop),
	event = new EventEmitter();

var spawn = require('child_process').spawn,

exec = require('child_process').exec;

exec("sh " + stop + " python", function (error, stdout, stderr) {
	proc  = spawn('python',[bridge]);
	
	if(debug){
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
		socket = net.connect({port:port, host:server},function(qlcosa) {
			socket.setEncoding("utf8");
			console.log("Bridge Connection Success");
			
		});
		socket.on('data', function(data) {
			//console.log(data.toString());	//message from server
			eventEmit(data);
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
			
	},10000);
	
	
});

/***
* Board functions
***/
function pinMode(pin, mode) {
	try {
		//verify socket connection, recursive way
		
		if(typeof(socket) == 'undefined'){
			setTimeout(function(){
					pinMode(pin, mode);
				}, 50);
			return;
		}
		if( checkPinMode(pin, mode) ){
			//var mpin = getPin(layout,pin,'digital',mode);
			//when check connection is ok, emit the request
			var cmd = JSON.stringify({command:[{cmd: 'mode', pin: pin, mode: mode}]});
			socket.write(cmd,'utf8',function(){
				pinReg[pin] = mode;
				console.log(JSON.stringify(pinReg));
			});
			
		}
		else{
			throw new Error("Can not call pinMode for Pin " + pin + "!");
		}
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
				var cmd = JSON.stringify({command:[{cmd: 'write', pin: pin, value: value}]});
				socket.write(cmd,'utf8'); //when connection is ok, emit the request 
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
				var cmd = JSON.stringify({command:[{cmd: 'write', pin: pin, value: value}]});
				socket.write(cmd,'utf8'); //when connection is ok, emit the request
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
		//verify socket connection, recursive way
		if(typeof(socket) == 'undefined' ){
			setTimeout(function(){
				digitalRead(pin,callback);
			}, 500);
			return;
		}
		if(checkDigitalRead(pin)){
			//var mpin = getPin(layout,pin,'digital','');
			var cmd = JSON.stringify({command:[{cmd: 'read', pin: pin}]});
			socket.write(cmd,'utf8',readback(pin, callback)); //when connection is ok, emit the request
		}
		else{
			throw new Error("Can not call digitalRead for Pin " + pin + "!");
		}
	}
	catch(err){
		console.log(err);
	}  
}
function analogRead(pin, callback) {
    try {
		//verify socket connection, recursive way
		if(typeof(socket) == 'undefined' ){
			setTimeout(function(){
					analogRead(pin,callback);
				}, 500);
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
				socket.write(cmd,'utf8'); //when connection is ok, emit the request
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
		datajson = JSON.parse(data);
		if( typeof(datajson.cmd) != 'undefined' && 
			datajson.cmd == 'read-back'){
			event.emit('read-back-'+datajson.pin, data);
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
function checkPinMode(pinnumber,mode){
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