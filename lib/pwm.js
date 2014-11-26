/***
 * file: pwm.js
 * author: https://github.com/quasto, https://github.com/andrea-83
 * based on: https://github.com/fivdi/onoff/blob/master/onoff.js 
 ***/

var fs = require('fs'),
    pwmRootPath = '/sys/class/pwm/pwmchip0/';
	
var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');


function Pwm(pin_register, timer) {

	this.gpio = pin_register.NUM;
	this.map = pin_register.MAP;
    this.pwmPath = pwmRootPath + this.map + '/';
	this.bit =  pin_register.BIT || 8;
	this.timer = timer;
	this.pin_register = pin_register;
    this.bufferSize=9;
	this.readBuffer = new Buffer(this.bufferSize);
	this.period = 10000000;	//settare quella presente nel file delle impostazioni (config)
    this.listeners = [];
	this.periodPath = this.pwmPath + 'period';
	this.dutycyclePath = this.pwmPath + 'duty_cycle';
	
    /**
    * Export Pwm and initialize the File Descriptor.
    */  
    this.export = function(){
        if (!fs.existsSync(this.pwmPath)) 
            fs.writeFileSync(pwmRootPath + 'export', this.gpio);
        //fixed pwm period to 10ms 
        //some pins have a max period less to 10ms
        //in this case set the period at max value supported
        if((!this.timer.SER) || this.timer.USE.length < 0 ){
            if(this.pin_register.MAX > this.period){
                fs.writeFileSync( this.periodPath, (this.period).toString() );
            }
            else{
                this.period = this.pin_register.MAX;
                fs.writeFileSync( this.periodPath, (this.period).toString() );
            }
        }
        this.valueFd = fs.openSync(this.dutycyclePath, 'r+');
        this.periodFd = fs.openSync(this.periodPath, 'r+');
        fs.writeFileSync(this.pwmPath + 'enable', '1');
    }
    
    /**
    * Unexport Pwm and close the File Descriptor.
    */  
    this.unexport = function(){
        fs.closeSync(this.valueFd);
        fs.closeSync(this.periodFd);
        fs.writeFileSync(this.pwmPath + 'enable', '0');
        if (fs.existsSync(this.pwmPath)) 
            fs.writeFileSync(pwmRootPath + 'unexport', this.gpio);  
    }
    /**
     * Write PWM value synchronously.
     *
     * @param {Number} value (0 - 100)
     */  
    this.writeSync = function(value) {

        //if servowrite or analogwitens functions use shared timer, read the period value
        if(this.timer.SHA && (this.timer.SER || this.timer.USE.length > 0)){
            value = getValues(value, fs.readFileSync(this.periodPath));
        }
        else{
            value = getValues(value, this.period);
        }
        var writeBuffer = new Buffer (value.toString());
        fs.writeSync(this.valueFd, writeBuffer, 0, writeBuffer.length, 0);
    };
    
    /**
     * Write PWM value synchronously.
     *
     * @param {Number} value (nanoseconds)
     * @param {Number} period (nanoseconds)
     *
     */   
    this.writeSyncns = function(value, period){
        //check if period is not lower to the pin resolution
        if(period < this.pin_register.RES)
            period = this.pin_register.RES;
        // check if duty cycle is greater to the period and that the period is less to the max supported value 
        if(value <= period && period <= this.pin_register.MAX){
            if(fs.readFileSync(this.dutycyclePath) < period){
                var writePeriod = new Buffer (period.toString());
                fs.writeSync(this.periodFd, writePeriod, 0, writePeriod.length, 0);
                var writeDuty = new Buffer (value.toString());
                fs.writeSync(this.valueFd, writeDuty, 0, writeDuty.length, 0);
            }
            else{
                var writeDuty = new Buffer (value.toString());
                fs.writeSync(this.valueFd, writeDuty, 0, writeDuty.length, 0);
                var writePeriod = new Buffer (period.toString());
                fs.writeSync(this.periodFd, writePeriod, 0, writePeriod.length, 0);
            }		
        }
    };
    
    /**
     * Write PWM value asynchronously.
     *
     * @param {Number} value (0 - 100)
     * @param {Function} callback ()
     */   
    this.write = function(value, callback) {
        var that = this;
        //read the period value
        if(this.timer.SHA && (this.timer.SER || this.timer.USE.length > 0)){
            fs.readFile(that.periopath, 'utf8' ,function(err, read_value){
                value = getValues(value, read_value);
                var writeBuffer = new Buffer (value.toString());
                fs.write(this.valueFd, writeBuffer, 0, writeBuffer.length, 0, callback(value));
            });
        }
        else{
            value = getValues(value, this.period);
            var writeBuffer = new Buffer (value.toString());
            fs.write(this.valueFd, writeBuffer, 0, writeBuffer.length, 0, callback(value));
        }	
    };
    
    /**
     * Write PWM value asynchronously.
     *
     * @param {Number} value (nanoseconds)
     * @param {Number} period (nanoseconds)
     * @param {Function} callback ()
     */
    this.writens = function(value,period,callback){
        var that = this;
        if(period < this.pin_register.RES)
            period = this.pin_register.RES;	
        //verify that the duty cycle is greater of the period and if the period is inferior to the max value supported
        if(value <= period && period <= this.pin_register.MAX){
            fs.readFile(this.dutycyclePath,'utf8',function(err,data){
                if(parseInt(data) < period){
                    var writePeriod = new Buffer (period.toString());
                    fs.write(that.periodFd, writePeriod, 0, writePeriod.length, 0, function(){
                        var writeBuffer = new Buffer (value.toString());
                        fs.write(that.valueFd, writeBuffer, 0, writeBuffer.length, 0, callback(value));
                    });
                }
                else{
                    var writeBuffer = new Buffer (value.toString());
                    fs.write(that.valueFd, writeBuffer, 0, writeBuffer.length, 0, function(){
                        var writePeriod = new Buffer (period.toString());
                        fs.write(that.periodFd, writePeriod, 0, writePeriod.length, 0, callback(value));
                    });
                }
            });
        }
    };
    
    /**
     * Read PWM value synchronously.
     *
     * @returns {number}  nanoseconds
     */ 
    this.readSync = function() {
        this.readBuffer.fill(0);//pulisco il buffer
        fs.readSync(this.valueFd, this.readBuffer, 0, this.bufferSize, 0);
        //return this.readBuffer[0] === one[0] ? 1 : 0;
        return parseInt(decoder.write(this.readBuffer));
    };
    
    /**
     * Get PWM options.
     *
     * @returns  {object} // Must not be modified
     */
    this.options = function() {
    return this.opts;
};

    /**
     * Get PWM value in nanoseconds.
     *
     * @returns  {number} nanoseconds
     */    
    function getValues(value, period){
        if(value < 0 ) value = 0;
        if(value > 100) value = 100;
        return Math.floor(period * value / 100);
    }
    
    this.export();
    
} 

exports.Pwm = Pwm;

exports.version = '0.0.2';
