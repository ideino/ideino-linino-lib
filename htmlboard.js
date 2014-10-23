/***
 * file: htmlboard.js
 * version: 0.5.0
 * authors: https://github.com/quasto
 * license: mit
 ***/

/*** import ***/ 
var	io,// = require('socket.io').listen(PORT,{log:false}), 
	utils = require('./utils/utils');//,
	//layouts = require('./utils/layout');

var	socket,
	writeBuffer = [],	//buffer for managing the write request sent to the board
	readPins = [], 		//array of pin which has called with a "read"(digital, analog or virtual) from the client (js)
	readCtrls = [],		//array which contains the "read" called from the server
	board,
	layout,
	logger;	

/*** constants ***/
var	BUFFER_SIZE = 1000,			//items -> is the size of the buffer containing the write commands
	BUFFER_SPEED = 25,			//millis -> is the speed for sending requests from the buffer to the board
	READ_RETRY_SPEED = 500,		//millis -> is the speed for retry to send the read command
	PORT = 9812;	
	

module.exports = Htmlboard;

/*** constructor ***/
function Htmlboard(options, brd) {	
	
	if(typeof(brd) != 'undefined' && brd instanceof require('./board.js') ){
	
		board = brd;
		//load the default options from config file
		var file_options = require('./config');
		
		//user can specifies overwrite options in the costructor
		this._options = utils.mergeRecursive(file_options, options);
		//console.log(this._options.layout)
		layout = require('./utils/layouts/'+ this._options.layout).layout;//layouts[this._options.layout];
		//setting the logger;
		logger = utils.getLogger(this._options.logger);
		
		io = require('socket.io').listen(PORT,{log:false}), 
		
		io.sockets.on('connection', function (client) {
			var address = client.handshake.address;
			
			if(typeof(socket) != 'undefined') 
				socket.disconnect('last win');
			
			socket = client;
			logger.info("HtmlBoard Client Connect from " + address.address + ":" + address.port);
			
			setInterval(function(){
				sendWriteRequest();
			},BUFFER_SPEED);

			readCtrls.forEach(function(ctrl) {
                //socket.emit('command', ctrl.cmd, readback(ctrl.id+"-"+ctrl.param, ctrl.callback));
                readback(ctrl.id+"-"+ctrl.param, ctrl.callback);
			});
            
			socket.on('disconnect', function () {
				logger.info("HtmlBoard Client Disconnect from " + address.address + ":" + address.port);
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
	}	
}

/***
*	Function used in node app to interact with html component
*/
Htmlboard.prototype.write = function(id, param, value) { 
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
Htmlboard.prototype.read = function(id, param, callback) {
	var that = this;
	try {
		//verify socket connection, recursive way
		if(typeof(socket) == 'undefined' ){
			setTimeout(function(){
				that.read(id,param,callback);
			}, READ_RETRY_SPEED);
			return;
		}
		
        var ctrl = {};
        ctrl.id = id;
        ctrl.param = param;
        ctrl.cmd = {command:[{cmd: 'read', param: param, id: id}]};
        ctrl.callback = callback;
		
        socket.emit('command', ctrl.cmd, readback(id+'-'+param, ctrl.callback)); //when connection is ok, emit the request
	    readCtrls.push(ctrl);
    }
	catch(err){
		logger.error("HTML BOARD READ ERROR - " +err.message);
	}  
}

/***
*	Interface to the Board
*/
function boardDigitalRead(pin){
	if(typeof(board) != 'undefined' && readPins.indexOf(pin) == -1 ){
		board.digitalRead(pin,function(value){
			if(typeof(socket) != 'undefined')
				socket.emit('read-back-'+pin, {cmd: "read-back", pin: pin, value: value});
		});
		readPins.push(pin);
	}
}
function boardAnalogRead(pin){
	if(typeof(board) != 'undefined' && readPins.indexOf(pin) == -1 ){
		board.analogRead(pin,function(value){
			if(typeof(socket) != 'undefined')
				socket.emit('read-back-'+pin, {cmd: "read-back", pin: pin, value: value});
		});
		readPins.push(pin);
	}
}
function boardVirtualRead(pin,value){
	if(typeof(board) != 'undefined' && readPins.indexOf(pin) == -1 ){
		board.virtualRead(pin,function(value){
			if(typeof(socket) != 'undefined')
				socket.emit('read-back-'+pin, {cmd: "read-back", pin: pin, value: value});
		});
	}
}
function boardDigitalWrite(pin,value){
	if(typeof(board) != 'undefined'){
		board.digitalWrite(pin, parseInt(value));
	}
}
function boardAnalogWrite(pin,value){
	if(typeof(board) != 'undefined'){
		board.analogWrite(pin, parseInt(value));
	}
}
function boardPinMode(pin, mode){
	if(typeof(board) != 'undefined'){
		board.pinMode(pin, mode);
	}
}
function boardTone(pin, frequency, duration){
	if(typeof(board) != 'undefined'){
		board.tone(pin,  parseFloat(frequency), parseInt(duration));
	}
}
function boardNoTone(pin){
	if(typeof(board) != 'undefined'){
		board.noTone(pin);
	}
}
function boardAnalogWritens(pin, value, period){
	if(typeof(board) != 'undefined'){
		board.analogWritens(pin, parseFloat(value), parseFloat(period) );
	}
}
function boardServoWrite(pin,value){
	if(typeof(board) != 'undefined'){
		board.servoWrite(pin, parseInt(value));
	}
}
function boardVirtualWrite(pin,value){
	if(typeof(board) != 'undefined'){
		board.virtualWrite(pin, parseInt(value));
	}
}
function boardBlink(duration, frequency, pin){
	if(typeof(board) != 'undefined'){
		board.blink(parseInt(duration),parseInt(frequency), pin );
        
        
	}
}
function boardGetLayout(){
	if(typeof(board) != 'undefined'){
		if(typeof(socket) != 'undefined')
			socket.emit('info-back-layout', {info: "layout-back", value: board.pin});
	}
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
        case "tn":
            boardTone(c.command[0].pin, c.command[0].frequency, c.command[0].duration);
        break; 
        case "ntn":
            boardNoTone(c.command[0].pin);
        break; 
        case "awn":
            boardAnalogWritens(c.command[0].pin, c.command[0].value, c.command[0].period);
        break;
        case "bl":
            boardBlink(c.command[0].delay, c.command[0].duration, c.command[0].pin);
        break;            
	}
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

var readback = function(mpin, callback){
	if(typeof(socket) != 'undefined' ){
		socket.on('read-back-'+mpin,function(data){
			callback(data);
		});
	}
}

