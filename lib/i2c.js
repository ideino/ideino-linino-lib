/***
 * file: gpio.js
 * author: https://github.com/quasto
 * based on: https://github.com/fivdi/onoff/blob/master/onoff.js 
 ***/

var fs = require('fs'),
    i2cRootPath = '/sys/bus/i2c/devices/';
	//i2cRegisterPath = '/sys/bus/i2c/devices/i2c-0/';

	var StringDecoder = require('string_decoder').StringDecoder;
	var decoder = new StringDecoder('utf8');
	
	
exports.version = '0.0.1';


function I2c (element, options){
    var valuePath; // contiene il path al value della gpio
	options = options || {};
	
	this.map = element.BUS.slice(-1)+'-00'+element.ADD.substring(2,4);          //es: address 0x60 --> map = 0-0060
    this.i2cPath = i2cRootPath + this.map + '/';
    
    var elem_dir= fs.readdirSync(this.i2cPath);             //return an array with directory files 
    for( var x=0; x<elem_dir.length; x++){
        if(elem_dir[x].startsWith('iio:device')){  
            element.IIO = elem_dir[x];
            this.i2cPath = i2cRootPath + this.map + '/' + element.IIO + '/';
            break;
        }
    }
    this.opts = {};
    //this.opts.debounceTimeout = options.debounceTimeout || 0;
    this.sampling = options.sampling || 500; 
	this.resolution = options.resolution || 10;
	this.readBuffer = new Buffer(8);
    //this.listeners= [];
    this.listeners = {};
    this.valueFd={};
}

exports.I2c = I2c;


I2c.prototype.watch = function(param, options, callback) {
    this.sampling = options.sampling || this.sampling;
    this.resolution = options.resolution || this.resolution;
	
    //this.listeners.push(callback);
    if(typeof(this.listeners[param]) == 'undefined')
        this.listeners[param] = [];
    this.listeners[param].push(callback);
	
    var that = this;
    var paramPath = this.i2cPath+param;    //read file
    
    if( this.valueFd[param] === undefined && fs.existsSync(paramPath))
       this.valueFd[param] = fs.openSync(paramPath, 'r');        //open stream buffer       
    
    var old_value, new_value;
	//if(this.listeners.length == 1 ){ 
    if(this.listeners[param].length == 1 ){ 
        new_value = readSync(this.valueFd[param], this.readBuffer );
		//old_value = new_value;
        old_value = new_value + (that.resolution * 10) +1 ;
        //console.log(this.sampling);
		var timer = setInterval(function(){
				callbacks = that.listeners[param].slice(0);
				if(callbacks.length > 0){
					new_value = readSync(that.valueFd[param], that.readBuffer );
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
 * Read I2C value synchronously.
 *
 */


I2c.prototype.readSync = function(param) {
    var paramPath = this.i2cPath+param;    //read file
    if( this.valueFd[param] === undefined && fs.existsSync(paramPath))
       this.valueFd[param] = fs.openSync(paramPath, 'r');        //open stream buffer  
    return readSync(this.valueFd[param], this.readBuffer);	
};

function readSync(valueFd, readBuffer) {
	fs.readSync(valueFd, readBuffer, 0, 8, 0);
    return parseFloat(decoder.write(readBuffer));	
};




