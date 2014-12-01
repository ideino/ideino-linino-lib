/***
 * file: i2c.js
 * https://github.com/quasto, https://github.com/andrea-83
 * based on: https://github.com/fivdi/onoff/blob/master/onoff.js 
 ***/

var fs = require('fs'),
    StringDecoder = require('string_decoder').StringDecoder,
    decoder = new StringDecoder('utf8');


function I2c (element, options){

    this.i2cRootPath = '/sys/bus/i2c/devices/';
	this.map = element.BUS.slice(-1)+'-00'+element.ADD.substring(2,4);          //es: address 0x60 --> map = 0-0060
    this.i2cPath = this.i2cRootPath + this.map + '/';
    this.bufferSize = 6;
    var elem_dir= fs.readdirSync(this.i2cPath);             //return an array with directory files 
    for( var x=0; x<elem_dir.length; x++){              //check iio device directory
        if(elem_dir[x].startsWith('iio:device')){  
            element.IIO = elem_dir[x];
            this.i2cPath = this.i2cRootPath + this.map + '/' + element.IIO + '/';
            break;
        }
    }
    this.opts = options;
    this.sampling = ( ( options.sampling < 500 || typeof(options.sampling) == 'undefined' ) ? undefined : options.sampling) || 500;
	this.resolution = options.resolution || 10;
    this.readBuffer = {};       //list of param readbuffer
    this.listeners = {};
    this.valueFd={};
    this.poller={};
    
    /**
    * Appends the callback function and starts polling. Callback will trigger on every change on the I2c
    * @param {String} param
    * @param {Object} options
    * @param {Function} callback(err, value)
    */   
    this.watch = function(param, options, callback) {
        
        var sampling = ( ( options.sampling < 500 || typeof(options.sampling) == 'undefined' ) ? undefined : options.sampling) || this.sampling;
        var resolution = options.resolution || this.resolution;
        if (this.listeners[param] == undefined){
            this.listeners[param] = [];
        }
        var paramPath = this.i2cPath+param;    
        if(typeof(callback) == 'function'){ 
            this.listeners[param].push(callback); 
            if(this.listeners[param].length === 1){     //poll cycle will run only the first time
                var old_value=999999999,                //initially a very big value
                    new_value=0,                        //initially 0
                    that = this;
                this.readBuffer[param] = new Buffer(this.bufferSize);
                paramReadPath(paramPath, function(fd){
                    that.poller[param] = setInterval(function(){      //poll cycle                
                        var callbacks = that.listeners[param].slice(0);
                        if(callbacks.length > 0){ 
                            that.readBuffer[param].fill(0);
                            fs.read(fd, that.readBuffer[param], 0, that.bufferSize, 0,function(){
                                new_value = parseFloat(decoder.write(that.readBuffer[param]));
                                if( new_value <= (old_value - resolution) || 
                                    new_value >= (old_value + resolution) ){
                                    old_value = new_value;
                                    callbacks.forEach(function (callback){
                                        callback(null, new_value);
                                    });
                                }
                            });
                        }
                    },sampling);
                });
            };
        };
    };

    /**
    * Read I2C asynchronously.
    * @param {String} param 
    * @param {Function} callback(err, value)
    */
    this.read = function(param, callback) {
        var paramPath = this.i2cPath+param;
        var that=this;
        if (this.readBuffer[param] === undefined){
            this.readBuffer[param] = new Buffer(this.bufferSize);
        }
        if( this.valueFd[param]===undefined){
            fs.exists(paramPath,function(data){
                fs.open(paramPath, 'r',function(err,fd){  
                    that.valueFd[param]=fd;
                    that.readBuffer[param].fill(0);
                    fs.read(that.valueFd[param], that.readBuffer[param], 0, that.bufferSize , 0,function(value){
                        callback(null, parseFloat(decoder.write(that.readBuffer[param])));
                    });  
                });
            });
        }
        else{
            that.readBuffer[param].fill(0);
            fs.read(that.valueFd[param], that.readBuffer[param], 0, that.bufferSize, 0,function(value){
                callback(null, parseFloat(decoder.write(that.readBuffer[param])));                
            }); 
        }        
    };
    /**
    * Read I2C synchronously.
    * @param {Function} param
    * @returns {Number} read value
    */
    this.readSync = function(param) {
        var paramPath = this.i2cPath+param;    //read file
        if (this.readBuffer[param] == undefined){
            this.readBuffer[param] = new Buffer(6);
        }
        if( this.valueFd[param] === undefined && fs.existsSync(paramPath))
           this.valueFd[param] = fs.openSync(paramPath, 'r'); 
        return readSync(this.valueFd[param], this.readBuffer[param], this.bufferSize);	
    };
    
    /**
    * Stop watching on the I2c.
    * @param {String} param
    */
    this.unwatch = function(param){
        if (this.listeners[param].length > 0) {
            this.listeners[param] = [];
            clearInterval(this.poller[param]);
        } 
    }
    
    function readSync(valueFd, readBuffer, bufferSize) {
        fs.readSync(valueFd, readBuffer, 0, bufferSize, 0);
        return parseFloat(decoder.write(readBuffer));	
    };

    function paramReadPath(paramPath, callback){
        fs.exists(paramPath,function(data){
            fs.open(paramPath, 'r',function(err,fd){
                callback(fd);
            });
		});
	}; 
}

exports.I2c = I2c;

exports.version = '0.0.2';







