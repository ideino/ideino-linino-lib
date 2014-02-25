//Board
var	io = require('socket.io').listen(9811), 
	utils = require('./utils/utils'),
	socket;

io.set('transports',['xhr-polling','websocket']);
io.set('log level',1);





io.sockets.on('connection', function (client) {
	var address = client.handshake.address;
	
	client.on('join',function(name){
		socket = client;
		console.log("Client Connected from " + address.address + ":" + address.port);
	});
	
	client.on('disconnect', function () {
		console.log("Client Disconnect from " + address.address + ":" + address.port);
		socket = undefined;
	});
	
});




function write(id, value) {
    try {
		if(typeof(socket) != 'undefined' ){
			//when check connection is ok, emit the request
			var cmd = {command:[{cmd: 'write', id: id, value: value}]}
			socket.emit('command', cmd); //when connection is ok, emit the request 
		}
	}
	catch(err){
		console.log(err);
	}
}

function read(id, callback) {
	try {
		//verify socket connection, recursive way
		if(typeof(socket) == 'undefined' ){
			setTimeout(function(){
				digitalRead(pin,callback);
			}, 50);
			return;
		}
		var cmd = {command:[{cmd: 'read', pin: id}]}
		socket.emit('command', cmd, readback(id, callback)); //when connection is ok, emit the request
	}
	catch(err){
		console.log(err);
	}  
}

function readback(mpin, callback){
	if(typeof(socket) != 'undefined' ){
		socket.on('read-back-'+mpin,function(data){
			callback(JSON.parse(data));
		});
	}
}

exports.read = read;
exports.write = write;
exports.HIGH = utils.HIGH;
exports.LOW = utils.LOW;