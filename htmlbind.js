//HtmlBoard

//CONST	
var	BUFFER_SIZE = 1000,			//items -> is the size of the buffer containing the write commands
	BUFFER_SPEED = 25,			//millis -> is the speed for sending requests from the buffer to the board
	READ_RETRY_SPEED = 500,		//millis -> is the speed for retry to send the read command
	PORT = 9812;

var	io = require('socket.io').listen(PORT,{log:false}), 
	utils = require('./utils/utils'),
	socket,
	writeBuffer = [];	//buffer for managing the write request sent to the board
	
io.set('transports',['xhr-polling']);
io.set('log level',1);

io.sockets.on('connection', function (client) {
	var address = client.handshake.address;
	
	socket = client;
	console.log("Html5 Client Connect from " + address.address + ":" + address.port);
	
	setInterval(function(){
		sendWriteRequest();
	},BUFFER_SPEED);
	
	
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
			//socket.emit('command', cmd); //when connection is ok, emit the request
			pushWriteRequest(cmd);
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
			}, READ_RETRY_SPEED);
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
		socket.emit('command', writeBuffer.shift());
	}
}


exports.read = read;
exports.write = write;
exports.HIGH = utils.HIGH;
exports.LOW = utils.LOW;
exports.TRUE = utils.TRUE;
exports.FALSE = utils.FALSE;
exports.PARAMS = utils.PARAMS;