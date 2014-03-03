//Board
var server = '127.0.0.1',
	port = 9810,
	bridgefile = 'bridge-firmata.py',
	bridgestop = 'bridge-stop';

var	net = require('net'), 
	layout = require('./utils/layout').arduino_yun,
	utils = require('./utils/utils'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	socket;

var bridge = path.join(__dirname,'ext',bridgefile),
	stop = path.join(__dirname,'ext',bridgestop),
	event = new EventEmitter();

var spawn = require('child_process').spawn,
	exec = require('child_process').exec;
	exec("sh " + stop + " python", function (error, stdout, stderr) {
			proc  = spawn('python',[bridge]);
			
			proc.stdout.on('data', function (data) {
			  console.log('stdout: ' + data);
			});

			proc.stderr.on('data', function (data) {
			  console.log('stderr: ' + data);
			});

			proc.on('close', function (code) {
			  console.log('child process exited with code ' + code);
			});
			
	});
	
net.createServer(function(client) {
    socket = client;
	console.log("Bridge Client Connect from " + client.remoteAddress + ":" + client.remotePort);
	client.on('data', function(data) {
        eventEmit(data);
    });
   
    client.on('close', function(data) {
		console.log("Bridge Client Disconnect from " + client.remoteAddress + ":" + client.remotePort);
		socket = undefined;
    });
	
}).listen(port, function() { //'listening' listener
	console.log('Bridge Server: ON');
	
}).on('error', function (e) {
	if (e.code == 'EADDRINUSE') {
		console.log('Address in use, retrying...');
		//TROHW ERROR
	}
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
		var cmd = JSON.stringify({command:[{cmd: 'mode', pin: mpin, mode: mode}]});
		socket.write(cmd); //when connection is ok, emit the request 
		
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
			var cmd = JSON.stringify({command:[{cmd: 'write', pin: mpin, value: value}]});
			socket.write(cmd,'utf8'); //when connection is ok, emit the request 
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
			var cmd = JSON.stringify({command:[{cmd: 'write', pin: mpin, value: value}]});
			socket.write(cmd,'utf8'); //when connection is ok, emit the request
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
		var cmd = JSON.stringify({command:[{cmd: 'read', pin: mpin}]});
		//socket.emit('command', cmd, readback(mpin, callback)); //when connection is ok, emit the request
		socket.write(cmd,'utf8',readback(mpin, callback)); //when connection is ok, emit the request
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
		var cmd = JSON.stringify({command:[{cmd: 'read', pin: mpin}]});
		socket.write(cmd,'utf8',readback(mpin, callback)); //when connection is ok, emit the request
	}
	catch(err){
		console.log(err);
	}
}

function eventEmit(data){
	if(	typeof(data) != 'undefined'){
		datajson = JSON.parse(data);
		if( typeof(datajson.cmd) != 'undefined' && 
			datajson.cmd == 'read-back'){
			event.emit('read-back-'+datajson.pin, data);
		}
	}
}

//read callback
function readback(mpin, callback){
	if(typeof(socket) != 'undefined' ){
		event.on('read-back-'+mpin,function(data){
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