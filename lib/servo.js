/***
 * file: servo.js
 * author: https://github.com/quasto, https://github.com/andrea-83
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


function Servo(pin_register, timer) {

	this.gpio = pin_register.NUM;
	this.map = pin_register.MAP;
    this.pwmPath = pwmRootPath + this.map + '/';
    this.opts = {};
	this.bit =  pin_register.BIT || 16;
	this.timer = timer;
    this.bufferSize=9;
	this.readBuffer = new Buffer(this.bufferSize);
    this.listeners = [];
	this.periodPath = this.pwmPath + 'period';
	this.dutycyclePath = this.pwmPath + 'duty_cycle';
    
    /**
    * Export Servo, set period to 20ms, initial angle to 0 and initialize the File Descriptor.
    */
	
    this.export=function(){
        if (!fs.existsSync(this.pwmPath))   // The pin hasn't been exported yet so export it. 
            fs.writeFileSync(pwmRootPath + 'export', this.gpio);
        if (fs.readFileSync(this.periodPath) != conf[this.bit].period )	
            fs.writeFileSync( this.periodPath, conf[this.bit].period ); 	// set period to 20 ms 	
        fs.writeFileSync(this.dutycyclePath, conf[this.bit].inf);   //set the servo to 0 degrees
        this.valueFd = fs.openSync(this.dutycyclePath, 'r+');      // Cache fd for performance.

       // fs.writeFileSync(this.pwmPath + 'enable', '1');     //enable PWM pin
        this.timer.SER = true;	                            //shared timer
    }
    
    
    /**
    * Disable and Unexport servo
    * 
    */
    this.unexport = function(){
        
        fs.closeSync(this.valueFd);
        fs.writeFileSync(this.pwmPath + 'enable', '0');
        if (fs.existsSync(this.pwmPath)) {        
            // The pin hasn't been exported yet so export it.
            fs.writeFileSync(pwmRootPath + 'unexport', this.gpio);
        }
    }
    /**
     * Write SERVO value synchronously.
     *
     * @param {Number} angle ( 0 -180)
     */
    this.writeSync = function(angle) {	
        angle = getAngleValues(angle, conf[this.bit]);
	fs.writeFileSync(this.pwmPath + 'enable', '1');
	fs.writeSync(this.valueFd, angle, 0, angle.length, 0);
	sleep(500);
	fs.writeFileSync(this.pwmPath + 'enable', '0');
    };
    
    /**
     * Write SERVO value asynchronously.
     *
     * @param {Number} angle ( 0 -180)
     * @param {Function} callback ()
     */
    this.write = function(angle, callback) {
        angle = getAngleValues(angle, conf[this.bit]);
        fs.write(this.valueFd, angle, 0, angle.length, 0, callback(angle)); 
    };

    /**
     * Read SERVO value synchronously.
     *
     * @returns {number} - duty in ns
     */
    this.readSync = function() {
        this.readBuffer.fill(0);//pulisco il buffer
        fs.readSync(this.valueFd, this.readBuffer, 0, this.bufferSize, 0);
        return parseInt(decoder.write(this.readBuffer));
    };


    /**
     * Get SERVO options.
     *
     * @returns  {object} // Must not be modified
     */
    this.options = function() {
        return this.opts;
    };
    
    /**
     *  Get Angle in nanosecond 
     *
     *  @returns {number} - duty_cycle in nanoseconds
     */    
    function getAngleValues(angle, param){	//convert degrees in ns
        if(angle < 0 ) angle = 0;
        if(angle > 180) angle = 180;
        return Math.floor(( angle * param.rap)+ param.inf); 
    };

    /**
     *  Sleep in millisecond 
     *
     *  
     */
	function sleep( sleepDuration ){
    		var now = new Date().getTime();
    		while(new Date().getTime() < now + sleepDuration){ /* do nothing */ } 
	}
    
    this.export();

} 
	 
exports.Servo = Servo;

exports.version = '0.0.2';

