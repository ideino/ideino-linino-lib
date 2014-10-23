/***
 * file: gpio.js
 * author: https://github.com/quasto
 * based on: https://github.com/fivdi/onoff/blob/master/onoff.js 
 ***/

var fs = require('fs'),
    pwmRootPath = '/sys/class/pwm/pwmchip0/';
	
var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');

exports.version = '0.0.1';

function Pwm(pin_register, timer) {

	this.gpio = pin_register.NUM;
	this.map = pin_register.MAP;
    this.pwmPath = pwmRootPath + this.map + '/';
	this.bit =  pin_register.BIT || 8;
	this.timer = timer;
	this.pin_register = pin_register;
	this.readBuffer = new Buffer(9);
	this.period = 10000000;	//settare quella presente nel file delle impostazioni (config)
    this.listeners = [];
	this.periodPath = this.pwmPath + 'period';
	
	//options = options || {};
	//this.opts = {};
    //this.opts.debounceTimeout = options.debounceTimeout || 0;
    //this.sampling = options.sampling || 25;
	//this.resolution = options.resolution || 40;
	
	var dutycyclePath = this.pwmPath + 'duty_cycle';
	
	if (!fs.existsSync(this.pwmPath)) {
        
		fs.writeFileSync(pwmRootPath + 'export', this.gpio);
	}
	
	//i fixed pwm period to 10ms 
	//some pin have a max period inferior to 10ms
	//in this case set the period at the max value supported

	if((!this.timer.SER) || this.timer.USE.length < 0 ){
		if(pin_register.MAX > this.period){
			fs.writeFileSync( this.periodPath, this.period );
		}
		else{
			this.period = pin_register.MAX;
			fs.writeFileSync( this.periodPath, this.period );
		}
	}
		
	this.valueFd = fs.openSync(dutycyclePath, 'r+');
    
    this.periodFd = fs.openSync(this.periodPath, 'r+');
	
	fs.writeFileSync(this.pwmPath + 'enable', '1');
		
    // Allow all users to read and write the GPIO value file
    fs.chmodSync(dutycyclePath, 0666);
		
		
} 

exports.Pwm = Pwm;


function getValues(value, period){
	if(value < 0 ) value = 0;
	if(value > 100) value = 100;
	return Math.floor(period * value / 100);
}

/*
Pwm.prototype.watch = function(callback) {
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
 * Write PWM value synchronously.
 *
 * value: number // from 0 to 100
 */
Pwm.prototype.writeSync = function(value) {

	//if servowrite or analogwitens functions use shared timer, read the period value
	if(this.timer.SHA && (this.timer.SER || this.timer.USE.length > 0)){
		value = getValues(value, fs.readFileSync(this.periodPath));
	}
	else{
        value = getValues(value, this.period);
	}
	var writeBuffer = new Buffer (value.toString());
	fs.writeSync(this.valueFd, writeBuffer, 0, writeBuffer.length, 0);
	return value;

};
Pwm.prototype.writeSyncns = function(value, period){
    //check if period is not lower to the pin resolution
	if(period < this.pin_register.RES)
        period = this.pin_register.RES;
	// check if duty cycle is greater to the period and that the period is less to the max supported value 
	if(value <= period && period <= this.pin_register.MAX){
		if(fs.readFileSync(this.pwmPath + 'duty_cycle') < period){
			var writePeriod = new Buffer (period.toString());
			fs.writeSync(this.periodFd, writePeriod, 0, writePeriod.length, 0);
			var writeBuffer = new Buffer (value.toString());
			fs.writeSync(this.valueFd, writeBuffer, 0, writeBuffer.length, 0);
		}
		else{
			var writeBuffer = new Buffer (value.toString());
			fs.writeSync(this.valueFd, writeBuffer, 0, writeBuffer.length, 0);
            var writePeriod = new Buffer (period.toString());
            fs.writeSync(this.periodFd, writePeriod, 0, writePeriod.length, 0);
		}		
	}
	return value;
}

Pwm.prototype.write = function(value, callback) {
	
	//read the period value
 	if(this.timer.SHA && (this.timer.SER || this.timer.USE.length > 0)){
		value = getValues(value, fs.readFileSync(this.periopath));
	}
	else{
		value = getValues(value, this.period);
	}	
	var writeBuffer = new Buffer (value.toString());
	fs.write(this.valueFd, writeBuffer, 0, writeBuffer.length, 0, callback(value));

};
 
Pwm.prototype.writens = function(value,period,callback){
		//quanto è onerosa questa operazione ?
	if(period < this.pin_register.RES)
        period = this.pin_register.RES;	
	//verify that the duty cycle is greater of the period and if the period is inferior to the max value supported
	if(value <= period && period <= this.pin_register.MAX){
		//i cannot writer a duty cycle greater than the period
		if(fs.readFileSync(this.pwmPath + 'duty_cycle') < period){
			var writePeriod = new Buffer (period.toString());
			fs.writeSync(this.periodFd, writePeriod, 0, writePeriod.length, 0, callback(value));
			var writeBuffer = new Buffer (value.toString());
			fs.writeSync(this.valueFd, writeBuffer, 0, writeBuffer.length, 0, callback(value));
		}
		else{
			var writeBuffer = new Buffer (value.toString());
			fs.writeSync(this.valueFd, writeBuffer, 0, writeBuffer.length, 0, callback(value));
			var writePeriod = new Buffer (period.toString());
			fs.writeSync(this.periodFd, writePeriod, 0, writePeriod.length, 0, callback(value));
		}		
	}
}


/**
 * Read PWM value synchronously.
 *
 * Returns - number //
 */
Pwm.prototype.readSync = function() {
    this.readBuffer.fill(0);//pulisco il buffer
	fs.readSync(this.valueFd, this.readBuffer, 0, 9, 0);
    //return this.readBuffer[0] === one[0] ? 1 : 0;
	return parseInt(decoder.write(this.readBuffer));
};

//TODO: read async


/**
 * Get PWM options.
 *
 * Returns - object // Must not be modified
 */
Pwm.prototype.options = function() {
    return this.opts;
};

/**
 * Reverse the effect of exporting the PWM to userspace. The Adc object
 * should not be used after calling this method.
 */
/*
Pwm.prototype.unexport = function(callback) {
    this.unwatchAll();
    fs.closeSync(this.valueFd);
    fs.writeFileSync(adcEnablingPath + 'enable', '0');
};
*/
/*
Pwm.prototype.isExported = function(){
	return fs.existsSync(this.adcPath);
}
*/