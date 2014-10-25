/***
 * @file board.js
 * @version 0.6.0
 * @author https://github.com/quasto
  ***/

/*** import ***/
var	utils = require('./utils/utils'),
	path = require('path');
	_ = require('underscore'),
	S = require('string'),
	fs = require('fs'),
	exec = require('child_process').exec,
	clone = require('clone'),
	Args  = require('args-js'),
	Gpio = require('./lib/gpio').Gpio,
	Adc = require('./lib/adc').Adc,
	Pwm = require('./lib/pwm').Pwm,
	Servo = require('./lib/servo').Servo,
    I2c = require('./lib/i2c').I2c,
    FrameBuffer = require('./lib/framebuffer').FrameBuffer,
	StringDecoder = require('string_decoder').StringDecoder,
	decoder = new StringDecoder('utf8'),
	async = require('async'),
    shell = require('shelljs'),
    chk = require('./utils/check');
	
var	logger,	//winston logger
	boardLayout;

/***
pin_register = { 
			"A0"	:	
			{
				"DEF"	: "A0",
				"TYP"	: "analog",
				"NUM"	: "139",
				"MAP"	: "A0",
				"PIN"	: [Object Adc],
                "CHK_AREAD": true
				
			},
			...
			"D2"	:	
			{
				"DEF"	: "D2",
				"TYP"	: "digital",
				"NUM"	: "117",
				"MAP"	: "SDA",
				"MOD"	: "input","output",
				"PIN"	: [Object Gpio],
                "CHK_PINMODE": true,
                "CHK_DREAD": true,
                "CHK_DWRITE": true
			},...
			"P11" :
			{
				"DEF"	: "P11",
				"TYP"	: "pwm",
				"NUM"	: "117",
				"MAP"	: "D11",
				"PIN"	: [Object Pwm]
                "CHK_PINMODE": true,
                "CHK_AWRITE": true
			}
***/
				
module.exports = Board;

/*** constructor ***/
function Board(options) {
			
    this.args_options = options || {};
    boardLayout = {};

    
    /*** Board attributes ***/
    //Board.prototype.pin = layout;
    Board.prototype.model = getBoardModel();// name of board model: Arduino Yun, Linino One etc... 
				
    //load the default options from config file
    this.options = require('./config');			
    this.options.layout = S(this.model.toLowerCase()).underscore().s; //name of board layout: arduino_yun, linino_one etc...

    utils.mergeRecursive(this.options, this.args_options);			

    //logger
    logger = utils.getLogger(this.options.logger);
    logger.debug(this.options);
    Board.prototype.logger = logger;
    
    //layout
    loadBoardLayout(this.options.layout);
    
    if( typeof(boardLayout.layout) == 'undefined' || boardLayout.layout == {} ){ 
            logger.error("Not Recognized Board Model - Layout: " + this.model);
            process.exit(1);
    }
    if( typeof(boardLayout.register) == 'undefined' || boardLayout.register == {} ){ 
            logger.error("Not Recognized Board Model - Register: " + this.model);
            process.exit(1);
    }
    if( typeof(boardLayout.timer) == 'undefined' || boardLayout.timer == {} ){ 
            logger.error("Not Recognized Board Model - Timer: " + this.model);
            process.exit(1);
    } 
    
    Board.prototype.pin = boardLayout.layout;
    Board.prototype.LOW = utils.LOW;
    Board.prototype.HIGH = utils.HIGH;
    Board.prototype.MODES = utils.MODES; 
}

/*** PUBLIC ***/  
/*** Board functions ***/
Board.prototype.connect = function(callback){
	var that = this;
    logger.info("Connecting to the Board "+ this.model +"...");
    
    async.series({
        //STEP 1: connects the linino shields
        one: function(cbkSeries){
                //loop the shields to connect to
                async.each(boardLayout.shields,
                    function(shieldModel, cbkEach){
                         registerShield(shieldModel, function(err){
                            if(!err){
                                //connect the shield (merging the layout, instance the devices
                                connectShield(shieldModel, that.options, function(err) {
                                    if(!err){
                                        logger.debug("Linino Shields "+shieldModel+" Loaded");
                                        cbkEach();
                                    }
                                });
                            }
                        });
                    },
                    function(err) {                   
                        if(err) {
                            logger.error("Error during shields loading: "+  err.message);
                            }
                        else {
                            logger.debug(boardLayout.layout);
                            //
                            cbkSeries();
                            }
                    });
        },
        //STEP 2: now reset the pwm pin (if present). disable/unexport pwm, beacouse if were enabled in a prevoius execution, they can no longer be used
        two: function(cbkSeries){
                var pin_pwm = _.filter(boardLayout.register, function(pin){ return pin.TYP == 'pwm'});
                async.each( pin_pwm, 
                function(value,cbkEach){
                    if( fs.existsSync('/sys/class/pwm/pwmchip0/'+value.MAP) ){
                        fs.writeFileSync('/sys/class/pwm/pwmchip0/'+value.MAP+'/enable', '0');
                        fs.writeFileSync('/sys/class/pwm/pwmchip0/'+value.MAP+'/duty_cycle', '500');
                        fs.writeFileSync('/sys/class/pwm/pwmchip0/'+value.MAP+'/period', '500');
                    }
                    cbkEach();
                },
                function(err){
                    if(err) {
                        logger.error("Error during pwm reset: "+  err.message);
                        } 
                    else {
                        logger.debug("LininoIO pwm reset completed");
                        //cbkSeries("LininoIO pwm reset completed");
                        cbkSeries();
                    }
                });    
        },
        three: function(cbkSeries){
                //loop the shields to connect to
                async.each(boardLayout.i2c_tmp,
                    function(i2cDevice, cbkEach){
                         registerI2c(i2cDevice, function(err){
                            if(!err){
                                //connect the shield (merging the layout, instance the devices
                                connectI2c(i2cDevice, that.options, function(err) {
                                    if(!err){
                                        logger.debug("I2c device "+i2cDevice.name+" Loaded");
                                        cbkEach();
                                    }
                                });
                            }
                        });
                    },
                    function(err) {                   
                        if(err) {
                            logger.error("Error during i2c loading: "+  err.message);
                            }
                        else {
                            logger.debug(boardLayout.layout);
                            cbkSeries();
                            }
                    });
        },
        four: function(cbkSeries){
                    chk.setBoardLayout(boardLayout);
                    chk.setLogger(logger);
                    delete (boardLayout.i2c_tmp);    //remove temporary i2c device information
                    cbkSeries();
        }
    },
    function(err, results) {
        if(err){
            logger.error("BOARD CONNECTION ERROR: "+ err);
            process.exit(1);
        }
        else{
            that.blink(50, 1500,'D13'/*,true*/);
            setInterval(function(){},60 * 1000)
            logger.info("Board Connection Success.");
            callback();
        }

    });
   //console.log(boardLayout); 
}
Board.prototype.blink = function(){
	var args = Args([
			{ delay:   	Args.INT 		| Args.Required },
			{ duration:	Args.INT 		| Args.Required },
			{ led: 		Args.STRING 	| Args.Optional, _default : 'D13' }
		], arguments);

	var that = this;
	this.pinMode(args.led, utils.MODES.OUTPUT);
	
	var t = utils.LOW,
	interval = setInterval( function(){
		that.digitalWrite(args.led, t); 
		t = t == utils.LOW ? utils.HIGH : utils.LOW;
	}, args.delay);
	
	setTimeout(function(){
		clearInterval(interval);
		that.digitalWrite(args.led, utils.LOW);
		/*if(args.release){
			register[args.led].PIN.unexport(function(){
				delete register[args.led].PIN;
			});
		}*/
	},args.duration);
	
}
Board.prototype.pinMode = function() {
	try {
		var args = Args([
			{pin: 		Args.STRING | Args.Required },
			{mode:		Args.STRING | Args.Required },
			{pullup:	Args.BOOL 	| Args.Optional, _default : false },
		], arguments);
	
        args.pin = chk.lookUpPin(args.pin);
		var check = chk.pinMode(args.pin, args.mode, boardLayout);
		if(check instanceof Error)
			throw check;
        else{
            switch(args.mode.toLowerCase()) {
                //INPUT (DIGITAL)
                case 'input':
                    if(args.pullup){//PULL-UP ENABLED
                        boardLayout.register[args.pin].PIN = new Gpio(boardLayout.register[args.pin],'out','both');
                        boardLayout.register[args.pin].PIN.writeSync(1);
                        boardLayout.register[args.pin].PIN.setDirection('in');
                        boardLayout.register[args.pin].MOD = args.mode;
                    }
                    else{//PULL-UP DISABLED : default
                        boardLayout.register[args.pin].PIN = new Gpio(boardLayout.register[args.pin],'in','both');
                        boardLayout.register[args.pin].MOD = args.mode;
                    }
                    break;
                //OUTPUT (DIGITAL)
                case 'output':
                    boardLayout.register[args.pin].PIN = new Gpio(boardLayout.register[args.pin],'out','both');
                    boardLayout.register[args.pin].MOD = args.mode;
                    break;
                //PWM
                case 'pwm':
                    boardLayout.register[args.pin].PIN = new Pwm(boardLayout.register[args.pin], boardLayout.timer[boardLayout.register[args.pin].TIM]);
                    boardLayout.register[args.pin].MOD = args.mode;
                    break;
                //SERVO
                case 'servo':
                    boardLayout.register[args.pin].PIN = new Servo(boardLayout.register[args.pin],boardLayout.timer[boardLayout.register[args.pin].TIM]);
                    boardLayout.register[args.pin].MOD = args.mode;
                    break;
            }
        }
		
	}
	catch(err){
		logger.error("BOARD PIN MODE ERROR - " + err.message);
		process.exit(1);
	}
}
Board.prototype.digitalWrite = function() {
    try {
		var args = Args([
					{ pin: 		Args.STRING 	| Args.Required },
					{ value:   	Args.INT 		| Args.Required },
					{ callback:	Args.FUNCTION 	| Args.Optional }
				], arguments);
	
        args.pin = chk.lookUpPin(args.pin, boardLayout.layout);
		var check = chk.digitalWrite(args.pin, boardLayout);
		if(check instanceof Error){
			throw check;
		}
		else{
			if(args.value>1) args.value = 1;
			if(args.value<0) args.value = 0;
			
			if( typeof(args.callback) == 'function' ){
				boardLayout.register[args.pin].PIN.write( args.value, function(val){
					args.callback(val);						
				});
			}
			else{
				boardLayout.register[args.pin].PIN.writeSync(args.value);
				return args.value;
			}
			
		}
	}
	catch(err){
		logger.error("BOARD DIGITAL WRITE ERROR - " + err.message);
	}
}
Board.prototype.digitalRead = function() {
	try {
		var args = Args([
					{pin: 		Args.STRING | Args.Required },
					{callback:	Args.FUNCTION | Args.Optional}
				], arguments);
	    
        args.pin = chk.lookUpPin(args.pin, boardLayout.layout);
		var check = chk.digitalRead(args.pin, boardLayout);
		if(check instanceof Error){
			throw check;
		}
		else{
			if(typeof(args.callback) != 'undefined'){
				boardLayout.register[args.pin].PIN.watch(function(err, val){
							if(err) { throw err; }
							else {args.callback(val);}
				});
			}
			else{
				return boardLayout.register[args.pin].PIN.readSync();
			}
		}
	}
	catch(err){
		logger.error("BOARD DIGITAL READ ERROR - " + err.message);
	}  
}
Board.prototype.analogWrite = function() {

    try {
		var args = Args([
						{ pin: 		Args.STRING 	| Args.Required },
						{ value:   	Args.FLOAT 		| Args.Required },
						{ callback:	Args.FUNCTION 	| Args.Optional }
					], arguments);
			
        args.pin = chk.lookUpPin(args.pin, boardLayout.layout);
        var check = chk.analogWrite(args.pin, boardLayout);
        if(check instanceof Error){
            throw check;
        }
        
        else{
            if( typeof(args.callback) == 'function' ){
                boardLayout.register[args.pin].PIN.write( args.value, function(val){
                    args.callback(val);						
                });
            }
            else{
                boardLayout.register[args.pin].PIN.writeSync(args.value);
                return args.value;
            }
        }
	}
	catch(err){
		logger.error("BOARD ANALOG WRITE ERROR - " + err.message);
	}
}
Board.prototype.analogWritens = function() {
    try {
		var args = Args([
						{ pin: 		Args.STRING 	| Args.Required },
						{ value:   	Args.FLOAT 		| Args.Required },
						{ period:   Args.FLOAT 		| Args.Optional, _default : this.options.period },						
						{ callback:	Args.FUNCTION 	| Args.Optional }
					], arguments);
			
            args.pin = chk.lookUpPin(args.pin, boardLayout.layout);
			var check = chk.analogWritens(args.pin);
			if(check instanceof Error){
				throw check;
			}
			else{
				if( typeof(args.callback) == 'function' ){
					boardLayout.register[args.pin].PIN.writens( Math.floor(args.value), Math.floor(args.period), function(val){
						args.callback(val);						
					});
				}
				else{
					boardLayout.register[args.pin].PIN.writeSyncns(Math.floor(args.value),Math.floor(args.period));
					return args.value;
				}
			}
	}
	catch(err){
		logger.error("BOARD ANALOG WRITE NS ERROR - " + err.message);
	}
}
Board.prototype.analogRead = function() {
    try {		
		var args = Args([
							{pin: 		Args.STRING | Args.Required },
							{options:   Args.OBJECT | Args.Optional, _default : {} },
							{callback:	Args.FUNCTION | Args.Optional}
						], arguments);
		
        args.pin = chk.lookUpPin(args.pin, boardLayout.layout);
		var check = chk.analogRead(args.pin, boardLayout);
		if(check instanceof Error){
			throw check;
		}
		else{
			if(typeof(boardLayout.register[args.pin].PIN) == 'undefined' || typeof(boardLayout.register[args.pin].PIN) == {} ){
				var opts = clone(this.options); //faccio un clone delle opzioni generali ricavate nella connect
				utils.mergeRecursive(opts, args.options); 
				
				boardLayout.register[args.pin].PIN = new Adc(boardLayout.register[args.pin], opts);
			}
			if(typeof(args.callback) != 'undefined'){
				boardLayout.register[args.pin].PIN.watch(function(err, val){
							if(err) { throw err; }
							else {args.callback(val);}
				});
			}
			else{
				return boardLayout.register[args.pin].PIN.readSync();
			}
		}
	}
	catch(err){
		logger.error("BOARD ANALOG READ ERROR - " + err.message);
	}
}
Board.prototype.i2cRead = function() {
    try {		
		var args = Args([
                            {pin: 		Args.STRING | Args.Required },
                            {field: 	Args.STRING | Args.Required },
                            {options:   Args.OBJECT | Args.Optional, _default : {} },
                            {callback:	Args.FUNCTION | Args.Optional}
                        ], arguments);

        args.pin = chk.lookUpPin(args.pin, boardLayout.layout);
        var check = chk.i2cRead(args.pin, boardLayout);
        if(check instanceof Error){
			throw check;
		}
		else{
            //utils.mergeRecursive(boardLayout.register[args.pin].PIN, args.options); //upload options
            
            if(typeof(args.callback) != 'undefined'){
                var opts = clone(this.options); //faccio un clone delle opzioni generali ricavate nella connect
				utils.mergeRecursive(opts, args.options); 
                
                boardLayout.register[args.pin].PIN.watch(args.field, opts, function(err,val){
                    if(err) { throw err; }
                    else {args.callback(val);}
                });
            }
            else{
                return boardLayout.register[args.pin].PIN.readSync(args.field);
            }
        }
    }
	catch(err){
		logger.error("BOARD I2C READ ERROR - " + err.message);
	}
}
Board.prototype.servoWrite = function(){
    try {
		var args = Args([
						{ pin: 		Args.STRING 	| Args.Required },
						{ angle:   	Args.INT 		| Args.Required },
						{ callback:	Args.FUNCTION 	| Args.Optional }
					], arguments);
					
		args.pin = chk.lookUpPin(args.pin, boardLayout.layout);
		var check = chk.servoWrite(args.pin, boardLayout);
		if(check instanceof Error){
			throw check;
		}
		else{
			
			if( typeof(args.callback) == 'function' ){
				boardLayout.register[args.pin].PIN.write( args.angle, function(val){
					args.callback(angle);						
				});
			}
			else{
				boardLayout.register[args.pin].PIN.writeSync(args.angle);
				return args.angle;
			}
		}
	}
	catch(err){
		logger.error("BOARD SERVO WRITE ERROR - " + err.message);
	}
}
Board.prototype.map = function() {
    try{
		var args = Args([
			{ value: 		Args.INT 	| Args.Required },
			{ fromLow:   	Args.INT 	| Args.Required },
			{ fromHigh:		Args.INT 	| Args.Required },
			{ toLow:   		Args.INT 	| Args.Required },
			{ toHigh:		Args.INT 	| Args.Required }
		], arguments);
		
		return Math.floor((args.value - args.fromLow) * (args.toHigh - args.toLow) / (args.fromHigh - args.fromLow) + args.toLow);
	}
	catch(err){
		logger.error("BOARD MAP ERROR - " + err.message);
	}
}
Board.prototype.tone = function() {
    try{
		var args = Args([
			{ pin: 			Args.STRING 	| Args.Required },
			{ frequency:	Args.FLOAT 		| Args.Required },
			{ duration:		Args.INT 		| Args.Optional, _default : 0 }
		], arguments);

		var that = this;
		period = Math.floor(1/args.frequency*1e9);		//convert frequency in period
		var check = that.analogWritens(args.pin, period/2, period);
		if(check instanceof Error){
			throw check;
		}
		if(args.duration > 0){		
			setTimeout(function(){
				var check = that.noTone(args.pin);
				if(check instanceof Error){
					throw check;
				}
			},args.duration);
		}
		return true;
	}
	catch(err){
		logger.error("BOARD TONE ERROR - " + err.message);
	}
}
Board.prototype.noTone = function() {
    try {
		var args = Args([
						{ pin: 			Args.STRING 	| Args.Required },
					], arguments);
		
		var check = this.analogWritens(args.pin, boardLayout.register[args.pin].RES, boardLayout.register[args.pin].MAX);
		if(check instanceof Error){
			throw check;
		}			
		return true;
	}
	catch(err){
		logger.error("BOARD TONE ERROR - " + err.message);
	}
}
Board.prototype.display = function(pin, context, canvas){

    try {
            /*var args = Args([
                            {   pin: 	    Args.STRING 	| Args.Required },
                            {   context: 	Args.OBJECT 	| Args.Required },
                            {   canvas:     Args.OBJECT 	| Args.Required }
                            ], arguments);*/
        //TODO call check display
        boardLayout.register[pin].PIN.writeSync(context, canvas);
        }
        catch(err){
            logger.error("BOARD DISPLAY ERROR - " + err.message);
        }
    }

/*** System functions ***/
//return the name of the current board: Arduino Yun, Linino One
function getBoardModel(){
	// Run the command in a subshell
	var p = exec("awk '/machine/ {print $3,$4}' /proc/cpuinfo" + " 2>&1 1>output && echo done! > done");
	// Block the event loop until the command has executed.
	while (!fs.existsSync('done')) {
	// Do nothing
	}		 
	// Read the output
	var output = decoder.write( fs.readFileSync('output') );
	 
	// Delete temporary files.
	fs.unlinkSync('output');
	fs.unlinkSync('done');
	 
	return S(output).trim().s;	
}
//load in the boardLayout object the configuration of the board via config file 
function loadBoardLayout(boardModel){
    boardLayout = require('./utils/layouts/'+boardModel);
    boardLayout.shields = [];
    boardLayout.i2c_tmp = [];
    boardLayout.register.CHK = {};
}

//return an array of the shields that can be registered 
function getLininoShieldsAvailable(){
    var shields = [];
    if(fs.existsSync('/sys/devices/mcuio/shield_list')){
        var str = shell.cat('/sys/devices/mcuio/shield_list');
        shields = S(S(str).trim().s).parseCSV('\n',"");
        shields.forEach(function(val,ind){  
            val = S(val).replaceAll('*','').s;   //remove special chars if exists
            shields[ind] = S(val).trim().s;             //trim entire string
        });  
    }
    return shields;
}
//return an array of the registered shields
function getLininoShieldsRegistered(){
    var shields = [];
    if(fs.existsSync('/sys/devices/mcuio/shield_list')){
        var str = shell.cat('/sys/devices/mcuio/shield_list');
        var _shields = S(S(str).trim().s).parseCSV('\n',"");
        _shields.forEach(function(val,ind){  
            if(S(val).contains('*')){
                val = S(val).replaceAll('*','').s;
                val = S(val).trim().s;
                shields.push(val);
            }
        });  
    }
    return shields;
}
//return true if the shield can be registered
function isShieldAvailable(shieldModel){
    var shields = getLininoShieldsAvailable();
    if(shields.indexOf(shieldModel) >= 0){
        return true;   
    }
    else{
        return false;   
    }
}
//return true if the shield is registered
function isShieldRegistered(shieldModel){
    var shields = getLininoShieldsRegistered();
    if(shields.indexOf(shieldModel) >= 0){
        return true;   
    }
    else{
        return false;   
    }
}
function isI2cRegistered(addr){
    var directory = addr[0]+'-00'+addr.substring(2,4);
    if(fs.existsSync('/sys/bus/i2c/devices/'+directory)){
        return true;   
    }
    else{
        return false;   
    }
}
/*** Linino Shields Functions ***/
function registerShield(model, callback){
    var opts = {aysnc: true, silent: true};
    if(!isShieldRegistered(model)){
        logger.debug("Registering Linino Shield " + model);
        exec('echo ' + model + ' > /sys/devices/mcuio/shield_register',
          function (error, stdout, stderr) {
            if (error !== null) {
                callback(error);
            }
            else{
                setTimeout(function(){callback(null)},5000);
            }
        });
    }
    else
    {
        logger.debug("Linino Shield " + model + " already registered");
        callback(null);
    }
}
function unregisterShield( model, callback){
    if(isShieldRegistered(model)){
        logger.debug("Unregistering Linino Shield " + model);
        exec('echo ' + model + ' > /sys/devices/mcuio/shield_unregister',
          function (error, stdout, stderr) {
            if (error !== null) {
                callback(error);
            }
            else{
                setTimeout(function(){callback(null)},5000);
            }
        });
    }
    else
    {
        logger.debug("Linino Shield " + model + " already unregistered");
        callback(null);
    } 
}
function registerI2c( i2c_device, callback){
    if(!isI2cRegistered(i2c_device.addr)){
        logger.debug("Registering I2c device " + i2c_device.name);
        exec('echo '+i2c_device.driver+' '+i2c_device.addr+ ' > /sys/bus/i2c/devices/'+i2c_device.bus+'/new_device',
          function (error, stdout, stderr) {
            if (error !== null) {
                callback(error);
            }
            else{
                setTimeout(function(){callback(null)},5000);
            }
        });
    }
    else
    {
        logger.debug("I2c device address " + i2c_device.addr + " already registered");
        callback(null);
    }
}
function connectShield(shieldModel, opts, callback){
    try{
        var shieldLayout = require('./utils/layouts/'+shieldModel);

        //LAYOUT and TIMER
        //update layout and timer (merge between board and shield)
        boardLayout.layout = utils.mergeRecursive(boardLayout.layout, shieldLayout.layout);
        boardLayout.timer = utils.mergeRecursive(boardLayout.timer, shieldLayout.timer);

        //DISABLED PIN:
        boardLayout.disabled = _.union(boardLayout.disabled, shieldLayout.disabled);

        //REGISTER
        //get register from the layout file of the shield, excluding i2c and framebuffer
        var shieldRegister = {};
        shieldRegister = _.reject(shieldLayout.register,function(obj){ 
                                                                return (obj.TYP == 'i2c' || obj.TYP == 'fb')
                                                            });
        shieldRegister.forEach(function(element){
            //adding register element of the layout shield to the layout board
            boardLayout.register[element.DEF] = element;
        });

        //get register from the layout file of the shield, only i2c;
        shieldRegister = {};
        shieldRegister = _.filter(shieldLayout.register,function(obj){ return obj.TYP == 'i2c'});
        shieldRegister.forEach(function(element) {
            //adding register element of the layout shield to the layout board, and create an i2c instance
            boardLayout.register[element.DEF] = element;
            boardLayout.register[element.DEF].PIN = new I2c(element,clone(opts));
        });  

        shieldRegister = {};
        shieldRegister = _.filter(shieldLayout.register,function(obj){ return obj.TYP == 'fb'});
        shieldRegister.forEach(function(element) {
            //adding register element of the layout shield to the layout board, and create a framebuffer instance
            boardLayout.register[element.DEF] = element;
            boardLayout.register[element.DEF].PIN = new FrameBuffer(element, {});
        }); 


        callback(null);
    }
    catch(err){
        callback(new Error("SHIELD CONNECT ERROR: " + err.message));   
    }
}
function connectI2c(i2c_device, opts, callback){
    try{
        if(!(boardLayout.layout.hasOwnProperty('i2c'))){
            boardLayout.layout['i2c'] = {};
        }
        if(!(boardLayout.layout.i2c.hasOwnProperty(i2c_device.bus))){
            boardLayout.layout.i2c[i2c_device.bus]={}
        }
        //key insert in register board layout    
        if(!(boardLayout.register.hasOwnProperty(i2c_device.name))){
            boardLayout.layout.i2c[i2c_device.bus][i2c_device.name]=i2c_device.name;
            boardLayout.register[i2c_device.name] = {}; 
            boardLayout.register[i2c_device.name].DEF= i2c_device.name;
            boardLayout.register[i2c_device.name].BUS= i2c_device.bus;
            boardLayout.register[i2c_device.name].TYP= 'i2c';
            boardLayout.register[i2c_device.name].DRV= i2c_device.driver;
            boardLayout.register[i2c_device.name].ADD= i2c_device.addr;
            boardLayout.register[i2c_device.name].PIN = new I2c(boardLayout.register[i2c_device.name], opts);        
        }
        callback(null); 
    }
    catch(err){
        console.log(err.message);
        callback(new Error("I2C DEVICE CONNECT ERROR: " + err.message));   
    }

}
//add to the boardLayout object the layout of the selected linino shield
Board.prototype.addShield = function(shieldModel){
    //1.1 - check if exist layout
    if(fs.existsSync( path.join(__dirname,'./utils/layouts/' + shieldModel + '.json') )){
        if( isShieldAvailable(shieldModel) ){
            boardLayout.shields.push(shieldModel);
        }
        else{
            logger.error("ADD SHIELD ERROR: shield "+ shieldModel + " is not compatible. ");  
            throw new Error("ADD SHIELD ERROR: layout file does not exist for shield "+ shieldModel +".");  
        }
    }
    else{
        logger.error("ADD SHIELD ERROR: layout file does not exist for shield "+ shieldModel);
        throw new Error("ADD SHIELD ERROR: layout file does not exist for shield "+ shieldModel);
    }
    
}
Board.prototype.addI2c = function(name, driver, addr, bus){
  
        //check ?
        boardLayout['i2c_tmp'].push({name: name.toUpperCase(), driver: driver, addr: addr, bus: 'i2c-'+bus});      
     
}