var socket,
	port = '9812';

function connection(host)
{
	var url = 'http://' + host + ':' + port;
	socket = io.connect(url,{ rememberTransport: false, transports: ['xhr-polling']});
	
	socket.on('connection', function(socket){
		var address = socket.handshake.address;
		alert("Connected with " + address.address);
		socket.on('disconnect', function(){
			alert("Disconnect from " + address.address + ":" + address.port);
		});
	});
	socket.on('command', function(msg){
		Object.keys(msg.command).forEach(function(key) {
			var command = msg.command[key];
			if(command.cmd == 'read')
			{
				var response = eval( "document.getElementById('"+command.id+"')."+command.param );
				var json_response = JSON.parse('{"value":"'+response+'"}');
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

function writeData(id, param, value){
	json_message = JSON.parse('{"id":"'+id+'", "param":"'+param+'", "value":"'+value+'"}');
	if(socket.socket.connected)
	{
		socket.emit('read-back-'+id, json_message);
	}
}




// read 
// [ IN PANCHINA ]
function readOnSocket(id)
{
	var json_message = JSON.parse('{ "command" :[{"cmd":"read", "id":"'+id+'"}]}');
	if(socket.socket.connected)
	{
		socket.emit('read', json_message);
		//on read-back
		socket.on('read-back-'+id, function(msg){
																 //corretto? che tipo di messaggio mi ritorna
				document.getElementById("label2").value = msg;	 //IPOTESI : solo valore
		});
	}
}

