//Board
var server = 'localhost',
	port = 9810,
	bridgefile = 'bridge-firmata.py';

var	io = require('socket.io').listen(port), 
	layout = require('./utils/layout').arduino_yun,
	utils = require('./utils/utils'),
	path = require('path'),
	socket;

var bridge = path.join(__dirname,'ext',bridgefile);
	
io.set('transports',['xhr-polling']);
io.set('log level',1);

//var top = "`top -n 1 | grep bridge-firmata.py | awk {\'print $1\'}`";
var spawn = require('child_process').spawn,
	exec = require('child_process').exec;
    //kill = spawn('kill',['-9 `top -n 1 | grep bridge-firmata.py | awk {\'print $1\'}`']);
	
var	kill = exec("kill -9 `top -n 1 | grep proj | awk {'print $1'}`",
	function (error, stdout, stderr) {
		proc  = spawn('python',[bridge]);
		
		proc.stdout.on('data', function (data) {
			console.log('stdout: ' + data);
		});

		proc.stderr.on('data', function (data) {
			console.log('stderr: ' + data);
		});
	});
	
	
io.sockets.on('connection', function (client) {
	var address = client.handshake.address;
	
	socket = client;
	console.log("Client Connect from " + address.address + ":" + address.port);
	
	socket.on('disconnect', function () {
		console.log("Client Disconnect from " + address.address + ":" + address.port);
		socket = undefined;
	});
	
	
	
});

function pinMode(pin, mode) {
	try {
		//verify socket connection, recursive way
		if(typeof(socket) == 'undefined'){
			setTimeout(function(){
					pinMode(pin, mode);
				}, 50);
			return;
		}
		var mpin = getPin(layout,pin,'digital');
		//when check connection is ok, emit the request
		var cmd = {command:[{cmd: 'mode', pin: mpin, mode: mode}]}
		console.log(JSON.stringify(cmd));
		socket.emit('command', cmd); //when connection is ok, emit the request 
	}
	catch(err){
		console.log(err);
	}
};

function digitalWrite(pin, value) {
    try {
		if(typeof(socket) != 'undefined' ){
			var mpin = getPin(layout,pin,'digital');
			//when check connection is ok, emit the request
			var cmd = {command:[{cmd: 'write', pin: mpin, value: value}]}
			console.log("vado con la write: "+ cmd);
			socket.emit('command', cmd); //when connection is ok, emit the request 
		}
	}
	catch(err){
		console.log(err);
	}
}

function analogWrite(pin, value) {
    try {
		if(typeof(socket) == 'undefined' ){
			var mpin = getPin(layout,pin,'analog');
			var cmd = {command:[{cmd: 'write', pin: mpin, value: value}]}
			socket.emit('command', cmd); //when connection is ok, emit the request
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
			}, 50);
			return;
		}
		var mpin = getPin(layout,pin,'digital');
		var cmd = {command:[{cmd: 'read', pin: mpin}]}
		socket.emit('command', cmd, readback(mpin, callback)); //when connection is ok, emit the request
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
				}, 50);
			return;
		}
		var mpin = getPin(layout,pin,'analog');
		var cmd = {command:[{cmd: 'read', pin: mpin}]}
		socket.emit('command', cmd, readback(mpin, callback)); //when connection is ok, emit the request
	}
	catch(err){
		console.log(err);
	}
}

//read callback
function readback(mpin, callback){
	if(typeof(socket) != 'undefined' ){
		socket.on('read-back-'+mpin,function(data){
			callback(JSON.parse(data));
		});
	}
}

function getPin(boardlayout, pinnumber, requestmode){
	if(typeof(boardlayout) != 'undefined' && typeof(pinnumber) != 'undefined'){
		//check if pin is disabled
		if( !boardlayout.disabled.contains(pinnumber) ){
			//check if mode is analog
			if(requestmode == 'analog'){
				if(boardlayout.analog.contains(pinnumber) ){
					return 'A'+pinnumber;
				}else{
					throw new Error("Pin " + pinnumber + " is not an analog pin!");
				}
			
			//else its digital
			}else{
				if(boardlayout.digital.contains(pinnumber) ){
					return 'D'+pinnumber;
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

exports.pinMode = pinMode;
exports.digitalRead = digitalRead;
exports.analogRead = analogRead;
exports.digitalWrite = digitalWrite;
exports.analogWrite = analogWrite;
exports.MODES = utils.MODES;
exports.HIGH = utils.HIGH;
exports.LOW = utils.LOW;

Array.prototype.contains = function(obj) {
    var i = this.length;
    while (i--) {
        if (this[i] === obj) {
            return true;
        }
    }
    return false;
}