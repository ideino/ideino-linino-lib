/***
 * file: gpio.js
 * author: https://github.com/quasto
 * based on: https://github.com/fivdi/onoff/blob/master/onoff.js 
 ***/

var fs = require('fs'),
    adcRootPath = '/sys/bus/iio/devices/iio:device0/';

	var StringDecoder = require('string_decoder').StringDecoder;
	var decoder = new StringDecoder('utf8');
	
	
exports.version = '0.0.1';

function Adc(pin_register, options) {
    var valuePath; // contiene il path al value della gpio
	options = options || {};
	
    this.adc = pin_register.NUM;
	this.map = pin_register.MAP;
    this.opts = {};
    this.opts.debounceTimeout = options.debounceTimeout || 0;
    this.sampling = options.sampling || 25; 
	this.resolution = options.resolution || 10;
	this.readBuffer = new Buffer(4);
    this.listeners = [];

    valuePath = adcRootPath +'in_voltage_'+this.map+'_raw'; 

    if (fs.existsSync(adcRootPath)) {
        fs.writeFileSync(adcRootPath + 'enable', '1');

        // Allow all users to read and write the GPIO value file
        //fs.chmodSync(valuePath, 0444);
    } 
	
    this.valueFd = fs.openSync(valuePath, 'r'); // Cache fd for performance.

}

exports.Adc = Adc;

Adc.prototype.watch = function(callback) {
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
					if( new_value <= (old_value - that.resolution) || 
						new_value >= (old_value + that.resolution) ){
						old_value = new_value;
						callbacks.forEach(function (callback) {
							callback(null, new_value);
						});
						
					}
				}
		},this.sampling);
	
	}
	
	
};


/**
 * Read ADC value synchronously.
 *
 * Returns - number // 0 or 1
 */
Adc.prototype.readSync = function() {
    this.readBuffer.fill(0);//pulisco il buffer
	fs.readSync(this.valueFd, this.readBuffer, 0, 4, 0);
    //return this.readBuffer[0] === one[0] ? 1 : 0;
	return parseInt(decoder.write(this.readBuffer));
	
	
};

/**
 * Get ADC options.
 *
 * Returns - object // Must not be modified
 */
Adc.prototype.options = function() {
    return this.opts;
};

/**
 * Reverse the effect of exporting the ADC to userspace. The Adc object
 * should not be used after calling this method.
 */
Adc.prototype.unexport = function(callback) {
    this.unwatchAll();
    fs.closeSync(this.valueFd);
    fs.writeFileSync(adcRootPath + 'enable', '0');
};

/*
Adc.prototype.isExported = function(){
	return fs.existsSync(this.adcPath);
}*/