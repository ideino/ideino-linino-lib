//Board
var	io = require('socket.io').listen(9812,{log:false}), 
	utils = require('./utils/utils'),
	socket;

io.set('transports',['xhr-polling']);
io.set('log level',1);

io.sockets.on('connection', function (client) {
	var address = client.handshake.address;
	
	socket = client;
	console.log("Html5 Client Connect from " + address.address + ":" + address.port);
	
	socket.on('disconnect', function () {
		console.log("Html5 Client Disconnect from " + address.address + ":" + address.port);
		socket = undefined;
	});
	
});


function write(id, param, value) {
    try {
		if(typeof(socket) != 'undefined' ){
			//when check connection is ok, emit the request
			var cmd = {command:[{cmd: 'write', id: id, param: param, value: value}]}
			socket.emit('command', cmd); //when connection is ok, emit the request 
		}
	}
	catch(err){
		console.log(err);
	}
}

function read(id, param, callback) {
	try {
		//verify socket connection, recursive way
		if(typeof(socket) == 'undefined' ){
			setTimeout(function(){
				read(id,param,callback);
			}, 500);
			return;
		}
		var cmd = {command:[{cmd: 'read', param: param, id: id}]}
		socket.emit('command', cmd, readback(id, callback)); //when connection is ok, emit the request
	}
	catch(err){
		console.log(err);
	}  
}

function readback(mpin, callback){
	if(typeof(socket) != 'undefined' ){
		socket.on('read-back-'+mpin,function(data){
			//console.log(data);
			//console.log(JSON.parse(data));
			//callback(JSON.parse(data));
			callback(data);
		});
	}
}

exports.read = read;
exports.write = write;
exports.HIGH = utils.HIGH;
exports.LOW = utils.LOW;
exports.TRUE = utils.TRUE;
exports.FALSE = utils.FALSE;
exports.PARAMS = utils.PARAMS;