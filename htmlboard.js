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

var board,
	logger;
	
io.set('transports',['xhr-polling']);
io.set('log level',1);

io.sockets.on('connection', function (client) {
	var address = client.handshake.address;
	
	socket = client;
	logger.info("HtmlBoard Client Connect from " + address.address + ":" + address.port);
	
	setInterval(function(){
		sendWriteRequest();
	},BUFFER_SPEED);
		
	socket.on('disconnect', function () {
		logger.info("HtmlBoard Client Disconnect from " + address.address + ":" + address.port);
		socket = undefined;
	});
	
	socket.on('command',function(data){
		logger.debug("Received command from HtmlBoard Client: "+JSON.stringify(data));
		parseCommand(data);
	});
	
	socket.on('info',function(data){
		logger.debug("Received info request from HtmlBoard Client: "+JSON.stringify(data));
		parseInfoRequest(data);
	});
});

/***
*	Function used in node app to interact with html component
*/
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
		logger.error("HTML BOARD WRITE ERROR - " +err.message);
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
		logger.error("HTML BOARD READ ERROR - " +err.message);
	}  
}

/***
*	Interface to the Board
*/
function boardDigitalRead(pin){
	if(typeof(board) != 'undefined' ){
		board.digitalRead(pin,function(data){
			if(typeof(socket) != 'undefined')
				socket.emit('read-back-'+pin, {cmd: "read-back", pin: pin, value: data.value});
		});
	}
}
function boardAnalogRead(pin){
	if(typeof(board) != 'undefined'){
		board.analogRead(pin,function(data){
			if(typeof(socket) != 'undefined')
				socket.emit('read-back-'+pin, {cmd: "read-back", pin: pin, value: data.value});
		});
	}
}
function boardVirtualRead(pin,value){
	if(typeof(board) != 'undefined'){
		board.virtualRead(pin,function(data){
			if(typeof(socket) != 'undefined')
				socket.emit('read-back-'+pin, {cmd: "read-back", pin: pin, value: data.value});
		});
	}
}

function boardDigitalWrite(pin,value){
	if(typeof(board) != 'undefined'){
		board.digitalWrite(pin,value);
	}
}
function boardAnalogWrite(pin,value){
	if(typeof(board) != 'undefined'){
		board.analogWrite(pin,value);
	}
}
function boardPinMode(pin, mode){
	if(typeof(board) != 'undefined'){
		board.pinMode(pin,mode);
	}
}
function boardServoWrite(pin,value){
	if(typeof(board) != 'undefined'){
		board.servoWrite(pin, value);
	}
}
function boardVirtualWrite(pin,value){
	if(typeof(board) != 'undefined'){
		board.virtualWrite(pin, value);
	}
}

function boardGetLayout(){
	if(typeof(board) != 'undefined'){
		if(typeof(socket) != 'undefined')
			socket.emit('info-back-layout', {info: "layout-back", value: board.pin});
	}
}
/***
* Set Functions
***/
//set the board object
function setBoard(b){
	board = b;
}
//set the logger object
function setLogger(l){
	logger = l;
}


/***
* System Functions
***/
//parse the command from the client-html
//example json command -> { command : [{ func : "dw", pin : "D13", value : 1 }]}
function parseCommand(c){
	switch(c.command[0].func.toLowerCase()){
		case "pm":
			boardPinMode(c.command[0].pin, c.command[0].mode);
		break;
		case "dw":
			boardDigitalWrite(c.command[0].pin, c.command[0].value);
		break;
		case "dr":
			boardDigitalRead(c.command[0].pin);
		break;
		case "aw":
			boardAnalogWrite(c.command[0].pin, c.command[0].value);
		break;
		case "ar":
			boardAnalogRead(c.command[0].pin);
		break;
		case "sw":
			boardServoWrite(c.command[0].pin, c.command[0].value);
		break;
		case "vr":
			boardAnalogRead(c.command[0].pin);
		break;
		case "vw":
			boardServoWrite(c.command[0].pin, c.command[0].value);
		break;	
	}
	/*
	switch(c.command[0].cmd.toLowerCase()){
		case "mode":
			boardPinMode(c.command[0].pin, c.command[0].mode);
		break;
		case "write":
			if( c.command[0].pin.toLowerCase().startsWith('d') )
				boardDigitalWrite(c.command[0].pin, c.command[0].value);
			else
				boardAnalogWrite(c.command[0].pin, c.command[0].value);
				
		break;
		case "read":
			if( c.command[0].pin.toLowerCase().startsWith('d') )
				boardDigitalRead(c.command[0].pin);
			else
				boardAnalogRead(c.command[0].pin);
		break;
	}
	*/
}

//parse the info request from the client-html
//example json info request -> { info : "layout"}
function parseInfoRequest(i){
	switch(i.info.toLowerCase()){
		case "layout":
			boardGetLayout();
		break;
		case "pin_status":
			boardDigitalWrite(c.command[0].pin, c.command[0].value);
		break;	
	}

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
		socket.emit('command', writeBuffer.shift());
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

exports.setBoard = setBoard;
exports.setLogger = setLogger;
exports.read = read;
exports.write = write;
exports.HIGH = utils.HIGH;
exports.LOW = utils.LOW;
exports.TRUE = utils.TRUE;
exports.FALSE = utils.FALSE;
exports.PARAMS = utils.PARAMS;
