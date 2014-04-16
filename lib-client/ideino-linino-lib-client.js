var socket,
	port = '9812',
	isConnected=false,
	layout;

function connect(host)
{
	var url = 'http://' + host + ':' + port;
	socket = io.connect(url,{ rememberTransport: false, transports: ['xhr-polling']});
	
	socket.on('connect', function(){
		console.log("Connected");
		isConnected = socket.socket.connected;
		getLayout();
		socket.on('disconnect', function(){
			console.log("Disconnect ");
			isConnected = socket.socket.connected;
		});
	});
	socket.on('command', function(msg){
		Object.keys(msg.command).forEach(function(key) {
			var command = msg.command[key];
			if(command.cmd == 'read')
			{
				var response = eval( "document.getElementById('"+command.id+"')."+command.param );
				var json_response = {value: response};
				socket.emit('read-back-'+command.id, json_response);
			}
			else if(command.cmd == 'write')
				eval( "try{ document.getElementById('"+command.id+"')."+command.param+" = "+command.value +"}catch(error){ console.log(error);} ");
		});
	});
	socket.on('write', function(msg){
		Object.keys(msg.command).forEach(function(key) {
			var command = msg.command[key];
			if(command.cmd == 'write')
				document.getElementById(command.id).value = command.value;
		});
	});
}



function digitalRead(pin, callback)
{
	if(isConnected)
	{
		var tPin = testPin(layout, pin);
		if(typeof tPin !== 'undefined')
		{
			var json_message = { command :[{func:"dr", pin:tPin}]};
			socket.emit('command',json_message);
			socket.removeAllListeners('read-back-'+tPin);
			socket.on('read-back-'+tPin, function(data){
				callback(data);
			});

		}
	}
	else
		console.log('No connection revealed');
}

function digitalWrite(pin, value)
{
	if(isConnected)
	{
		var tPin = testPin(layout,pin);
		if(typeof tPin !== 'undefined')
		{		
			var json_message = { command :[{func:"dw", pin:tPin, value:value}]};
			socket.emit('command',json_message);
		}
	}
	else
		console.log('No connection revealed');
}

 function analogRead(pin, callback)
{
	if(isConnected)
	{
		var tPin = testPin(layout,pin);
		if(typeof tPin !== 'undefined')
		{		
			var json_message = { command :[{func:"ar", pin:tPin}]};
			socket.emit('command',json_message);
			socket.removeAllListeners('read-back-'+tPin);
			socket.on('read-back-'+tPin, function(data){
				callback(data);
			});
		}
	}
	else
		console.log('No connection revealed');
}

function analogWrite(pin, value)
{
	if(isConnected)
	{
		var tPin = testPin(layout,pin);
		if(typeof tPin !== 'undefined')
		{		
			var json_message = { command :[{func:"aw",pin:tPin, value: value}]};
			socket.emit('command',json_message);
		}
	}
	else
		console.log('No connection revealed');
}

function servoWrite(pin, angle)
{
	if(isConnected)
	{
		var tPin = testPin(layout,pin);
		var tAngle = isNaN(angle); 
		if(typeof tPin !== 'undefined')
		{		
			if(!tAngle)
			{
				var json_message = { command :[{func:"sw",pin:tPin, value: angle}]};
				socket.emit('command',json_message);
			}
			else
				console.log('Error found in angle value');
		}
	}
	else
		console.log('No connection revealed');
}

function virtualRead(pin)
{
	if(isConnected)
	{
		var tPin = testPin(layout,pin);
		if(typeof tPin !== 'undefined')
		{		
			var json_message = { command :[{func:"vr", pin:tPin}]};
			socket.emit('command',json_message);
			socket.removeAllListeners('read-back-'+tPin);
			socket.on('read-back-'+tPin, function(data){
				callback(data);
			});
		}
	}
	else
		console.log('No connection revealed');
}

function virtualWrite(pin, value)
{
	if(isConnected)
	{
		var tPin = testPin(layout,pin);
		var tValue = isNaN(value); 
		if(typeof tPin !== 'undefined')
		{		
			if(!tAngle)
			{
				var json_message = { command :[{func:"vw",pin:tPin, value: tValue}]};
				socket.emit('command',json_message);
			}
			else
				console.log('Error found in insert value');
		}
	}
	else
		console.log('No connection revealed');
}



function pinMode(pin, mode)
{
	if(isConnected)
	{
		var tPin = testPin(layout, pin);
		var tMode = testMode(mode);
		if(typeof tPin !== 'undefined' && typeof tMode !== 'undefined')
		{		
			var json_message = {command : [{func: "pm",pin: tPin, mode: tMode}] };
			socket.emit('command',json_message);
		}
	}
	else
		console.log('No connection revealed');
}

function getLayout()
{
	if(isConnected)
	{
		socket.emit('info', { info : "layout"});
		socket.on('info-back-layout', function(data){
			layout = data.value;
		});
	}
	else
		console.log('No connection revealed');
}

function testMode(mode)
{
	mode = mode.toUpperCase();
	
	if(mode == 'INPUT' || mode == 'OUTPUT' || mode == 'PWM' || mode == 'SERVO' )
		return mode;
	else
	{
		console.log('Wrong pin mode');
		return ;
	}
}

function testPin(obj, val)
{
	val = val.toUpperCase();
    for(var prop in obj) 
	{
        if(obj.hasOwnProperty(prop) && obj[prop].hasOwnProperty(val)) 
		{
			return val;   
        }
    }
	return false;
}


function writeData(id, param, value){
	
	if(isConnected)
	{	var json_message = {id:	id, 
							param:	param, 
							value:	value
							};
		socket.emit('read-back-'+id, json_message);
	}
}
