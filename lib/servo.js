/***
 * file: servo.js
 * author: https://github.com/quasto
 * based on: https://github.com/fivdi/onoff/blob/master/onoff.js 
 ***/

var fs = require('fs'),
    pwmRootPath = '/sys/class/pwm/pwmchip0/';
	
var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');

var conf = {
	'16' : {
				'inf' 	:	560000,
				'sup'	:	2400000,
				'period':	20000000,
				'rap' 	:	((2400000-560000)/180),		//tempi in ns 
				'byte'	:	9
			}
}


exports.version = '0.0.1';

function Servo(pin_register, timer) {

	//options = options || {};
	
	this.gpio = pin_register.NUM;
	this.map = pin_register.MAP;
    this.pwmPath = pwmRootPath + this.map + '/';
    this.opts = {};
    //this.opts.debounceTimeout = options.debounceTimeout || 0;
    //this.sampling = options.sampling || 25;
	//this.resolution = options.resolution || 40;
	this.bit =  pin_register.BIT || 16;
	this.timer = timer;
	this.readBuffer = new Buffer(9);
    this.listeners = [];
	
	var periodPath = this.pwmPath + 'period';
	var dutycyclePath = this.pwmPath + 'duty_cycle';
		
	if (!fs.existsSync(this.pwmPath)) {
        
		// The pin hasn't been exported yet so export it.
		fs.writeFileSync(pwmRootPath + 'export', this.gpio);
	}
	
	if (fs.readFileSync(this.pwmPath + 'period') != conf[this.bit].period ){		
		// set period to 20 ms 
		fs.writeFileSync( periodPath, conf[this.bit].period );
	}
    
	//set the servo to 0 degrees
	var act_val= fs.readFileSync(dutycyclePath);
	fs.writeFileSync(dutycyclePath, conf[this.bit].inf);
	
	this.valueFd = fs.openSync(dutycyclePath, 'r+'); // Cache fd for performance.
	
    fs.writeFileSync(this.pwmPath + 'enable', '1');
	this.timer.SER = true;	
    // Allow all users to read and write the GPIO value file
    //fs.chmodSync(valuePath, 0666);
} 
	 
exports.Servo = Servo;
/*
Servo.prototype.watch = function(callback) {
    var events;
	this.listeners.push(callback);
	var that = this;
	var old_value, new_value;
	if(this.listeners.length == 1 ){
		new_value = that.readSync();
		//old_value = new_value;
        old_value = new_value + (that.resolution * 10) +1 ;
		var timer = setInterval(function(){
				callbacks = that.listeners.slice(0);
				if(callbacks.length > 0){
					new_value = that.readSync();
					if( new_value <= (old_value - that.resolution) || //risoluzione dell'informazione
						new_value >= (old_value + that.resolution) ){
						old_value = new_value;
						callbacks.forEach(function (callback) {
							callback(null, new_value);
						});
					}
				}
		},this.sampling);//periodo di campionamento
	}
};*/

/**
 * Write SERVO value synchronously.
 *
 * angle: number // from 0 to 180
 */
Servo.prototype.writeSync = function(angle) {	
	angle = getAngleValues(angle, conf[this.bit]);
	var writeBuffer = new Buffer (angle.toString());
	fs.writeSync(this.valueFd, writeBuffer, 0, writeBuffer.length, 0);
	
	return angle;
	
};

Servo.prototype.write = function(angle, callback) {
	angle = getAngleValues(angle, conf[this.bit]);
    var writeBuffer = new Buffer (angle.toString()); 
    fs.write(this.valueFd, writeBuffer, 0, writeBuffer.length, 0, callback(angle)); 
};

function getAngleValues(angle, param){	//convert ns in degrees
	if(angle < 0 ) angle = 0;
	if(angle > 180) angle = 180;
	return Math.floor(( angle * param.rap)+ param.inf); 
}

/**
 * Read SERVO value synchronously.
 *
 * Returns - number // from 0 to 255
 */
Servo.prototype.readSync = function() {
    this.readBuffer.fill(0);//pulisco il buffer
	fs.readSync(this.valueFd, this.readBuffer, 0, 9, 0);
    //return this.readBuffer[0] === one[0] ? 1 : 0;
	return parseInt(decoder.write(this.readBuffer));
};


/**
 * Get SERVO options.
 *
 * Returns - object // Must not be modified
 */
Servo.prototype.options = function() {
    return this.opts;
};
