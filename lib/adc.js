/***
 * file: adc.js
 * author: https://github.com/quasto, https://github.com/andrea-83
 * based on: https://github.com/fivdi/onoff/blob/master/onoff.js 
 ***/

var fs = require('fs'),
    StringDecoder = require('string_decoder').StringDecoder,
    decoder = new StringDecoder('utf8');

/**
* TODO: constructor description
*/
function Adc(pin_register, options) {

    this.pin = pin_register.NUM;
    this.map = pin_register.MAP;
    this.opts = options;
    this.sampling = options.sampling || 25;
    this.resolution = options.resolution || 10;
 
    this.adcRootPath = '/sys/bus/iio/devices/iio:device0/';
    this.valuePath = this.adcRootPath + 'in_voltage_' + this.map + '_raw';
    this.bufferSize = 4;
    this.readBuffer = new Buffer(this.bufferSize);
    this.listeners = [];
    this.poller;
    /**
    * Appends the callback function and starts polling. Callback will trigger on every change od the Adc
    * @param {Function} callback(err, value)
    */
    this.watch = function(callback){
        if(typeof(callback) == 'function'){
            this.listeners.push(callback);
            if(this.listeners.length === 1) { //poll cycle will run only the first time
                var old_value = 999999999,  //initially a very big value
                    new_value = 0,          //initially 0
                    that = this;
                this.poller = setInterval(function(){ //poll cycle
                    that.readBuffer.fill(0);
                    var callbacks = that.listeners.slice(0);
                    fs.read(that.valueFd, that.readBuffer, 0, that.bufferSize, 0, function(){
                        new_value = parseInt(decoder.write( that.readBuffer ));
                        if( new_value <= (old_value - that.resolution) || //the first time 'if' is verified becouse old_value is bigger than new_value
                            new_value >= (old_value + that.resolution) ){
                            old_value = new_value;
                            callbacks.forEach(function (callback) {
                                callback(null, new_value);
                                });
                            }
                        });
                }, this.sampling);
                }
            }
        }
    /**
    * Stop watching for hardware interrupts on the Adc.
    */
    this.unwatch = function(){
        if (this.listeners.length > 0) {
            this.listeners = [];
            clearInterval(this.poller);
        } 
    }
    
    /**
    * Export Adc and initialize the File Descriptor.
    */
    this.export = function(){
        if (fs.existsSync(this.adcRootPath)) {
            fs.writeFileSync(this.adcRootPath + 'enable', '1');

            // Allow all users to read and write the GPIO value file
            //fs.chmodSync(valuePath, 0444);
            this.valueFd = fs.openSync(this.valuePath, 'r'); // Cache fd for performance.
        }
    }
    
    /**
    * Reverse the effect of exporting the ADC to userspace. The Adc object
    * should not be used after calling this method.
    */
    this.unexport = function(){
        this.unwatch();
        fs.closeSync(this.valueFd);
        fs.writeFileSync(this.adcRootPath + 'enable', '0');
    }
    
    /**
    * Read Adc value synchronously.
    * @returns {number} 0 - 1023
    */
    this.readSync = function(){
        this.readBuffer.fill(0);//pulisco il buffer
        fs.readSync(this.valueFd, this.readBuffer, 0, this.bufferSize, 0);
        return parseInt(decoder.write(this.readBuffer));	
    }
    /**
    * Read ADC value asynchronously.
    * @param {Function}  callback(err, value)
    */
    this.read = function(callback){
        var that = this;
        fs.read(this.valueFd, this.readBuffer, 0, this.bufferSize, 0, function(){
           callback(null, parseInt(decoder.write(that.readBuffer)));
        });
    };
    //export the adc on creation
    this.export();
}

exports.Adc = Adc;

/**
 * @property {string}  version - Version of the Adc Class.
 */
Adc.prototype.version = '0.0.2';
/**
 * Get ADC options.
 *
 * @returns  {object} // Must not be modified
 */
Adc.prototype.options = function() {
    return this.opts;
};