#Ideino-linino-lib

## Installation

Take a look [here](http://wiki.linino.org/doku.php?id=wiki:nodejscript) on the Linino wiki to perform  the installation of Node.js.

To use linino-lib, you need to upgrade your Linino OS version to XXX or higher and install the corresponding mcu firmware. You will find the firmware in `/etc/linino/` folder.

Once you have browsed it via SSH connection, install it with the `run-avrdude` tool :

    > cd /etc/linino/
    > run-avrdude bathos-mcuio.hex
    ....
    > reboot

## How to use linino-lib
### Getting started  

Firstly, start your javascript code by importing the linino-lib :

    var linino = require('ideino-linino-lib');

To access the input and output pins of your board, use the following :

    var board = new linino.Board();

To interact with a web object create an **Htmlboard** object:

    var html = new linino.Htmlboard();

Before accessing the input and output pins, you have to make a connection to the board itself. The **callback** function is triggered whenever the board is successfully connected and then your code will be able to interact with the I/O pins.

	board.connect(function(){
		//your code here!
	});

### Board
#### Properties and Functions 
The board object has these main properties :

 - **HIGH**: is the high signal level for digital pins.
 - **LOW**: is the low signal level for digital pins.
 - **MODES**: contains the operating mode of a pin
    - **.OUTPUT** is the output operating mode of a digital pin.
    - **.INPUT**  is the input operating mode of a digital pin (analog are in input mode by default).
    - **.PWM** is the pwm operating mode of a digital pin. 
    - **.SERVO** is the servo operating mode of a digital pin.
 - **pin**: contains all the available pins of the board, grouped by typology :
    - **.digital** 
    - **.analog**
    - **.pwm**
    - **.servo**
 - **logger**: is the log object used by the library with _info_, _debug_ and _error_ level, console and file appender (see advanced configuration)
 - **model**: is the model name of the board

The board object has these embedded functions :

 - **[`addShield`](#addshield-shieldmodel)**: add a Linino Shield to the board.
 - **[`addI2c`](#addi2c-devicename-driver-address-bus)**: add a I2c device to the board.
 - **[`connect`](#connect-callback)**: connect to the board and initialize it.
 - **[`pinMode`](#pinmode-pin-mode-pull-up)**: set pin mode, used for digital pin only.
 - **[`digitalWrite`](#digitalwrite-pin-value-callback)**: send HIGH or LOW level signal to a digital pin.
 - **[`digitalRead`](#digitalread-pin-callback)**: get signal level of the specified digital pin.
 - **[`analogWrite`](#analogwrite-pin-value-callback)**: send a value output to specified pwm pin.
 - **[`analogWritens`](#analogwritens-pin-value-callback)**: send a value output to specified pwm pin.
 - **[`analogRead`](#analogread-pin-options-callback)**: get value from analog input pin.
 - **[`servoWrite`](#servowrite-pin-angle-callback)**: send degrees value to specified pwm pin.
 - **[`map`](#map-value-fromlow-fromhigh-tolow-tohigh)**: Maps an integer value from one range to another.
 - **[`tone`](#tone-pin-frequency-duration-callback)**: send tone output to specified pwm pin. 
 - **[`noTone`](#notone-pin-callback)**: send tone pause output to specified pwm pin.
 - **[`i2cRead`](#i2cread-name-field-options-callback)**: get value from the sensors on the i2c bus.

##### **addShield (shieldModel)**
If you want to connect a Linino Shield (ie: Lucky shield or DigitalIO shield), you must call the `addShield` function after the `board` creation and before of the `connect` function. The `addShield` function require `shieldModel` as parameter:
- lucky for the Lucky Shield.
- digitalio for the DigitalIO Shield.

    var linino = require('ideino-linino-lib'),
    	board = new linino.Board(),
        
        //add lucky shield
        board.addShield('lucky');
    
    board.connect(function(){
    	//your code here!
    });
    
For the complete list of the name of the i2c device see the [`Linino Shield`](#lucky-shield)chapter

##### **addI2c (deviceName, driver, address, bus)**
If you want to connect a I2c device (ie: humidity sensor with sht21 driver ), you must call the `addI2c` function after the `board` creation and before of the `connect` function. The `addI2c` require `deviceName`, `driver`,`address` and `bus` as parameters.


    var linino = require('ideino-linino-lib'),
    	board = new linino.Board(),
        
        //add I2c device
		board.addI2c('HUM', 'sht21', '0x40', 0);
    
    board.connect(function(){
    	//your code here!
    });
    
For the complete list of i2c device driver see the [`xxx`](#xxx)chapter

##### **connect (callback)**
It is the first function you must call before start working with your board. You will usually write your code inside the `callback` function that will be triggered once the board it's ready to be used : 

    var linino = require('ideino-linino-lib'),
    	board = new linino.Board();
    
    board.connect(function(){
    	//your code here!
    });


##### **pinMode (pin, mode, [pull-up])**
With pinMode you can set the operating mode of a **digital pin** : _pwm_, _input_ or _output_. Example :
    
    var linino = require('ideino-linino-lib'),
    	board = new linino.Board(),
    	led = board.pin.digital.D13;
    
    board.connect(function(){
    	board.pinMode(led, board.MODES.OUTPUT);	
    });	

The `pull-up` parameter allows you to enable pull-up to the specified **input pin**. It's an optional parameter and is set _false_ by default:

    board.pinMode(board.pin.digital.D5, board.MODES.INPUT, true);	
    
##### **digitalWrite (pin, value, [callback])**
digitalWrite allow you to set HIGH or LOW signal level to the digital output pins :
	
	var linino = require('ideino-linino-lib'),
		board = new linino.Board(),
		led = board.pin.digital.D13;
	
	board.connect(function(){
		board.pinMode(led, board.MODES.OUTPUT);
		board.digitalWrite(led, board.HIGH);
	});	
	
##### **digitalRead (pin, [callback])**
used for reading the values from a generic digital pin. The callback function is triggered whenever the signal level on the specified pin is changed :
	
	var linino = require('ideino-linino-lib'),
		board = new linino.Board(),
		button = board.pin.digital.D10;
	
	board.connect(function(){
		board.pinMode(button, board.MODES.INPUT);
		board.digitalRead(button, function(value){
			if(value == board.HIGH)
				console.log("button pressed");
			else
				console.log("button released");
		});
	});		

##### **analogWrite (pin, value, [callback])**
if a digital pin is set to pwm mode, you can write an nbit value (0-100) to it.
	
	var linino = require('ideino-linino-lib'),
		board = new linino.Board(),
		led = board.pin.pwm.P11;
	
	board.connect(function(){
		board.pinMode(led, board.MODES.PWM);
		board.analogWrite(led, 100);
	});	
	
##### **analogWritens (pin, value, period, [callback])**
This function allow you to write a nanoseconds value to specified pwm pin.
In `value` parameter you can set a dutycycle for the specified **pwm pin**.
See the range of the dutycycle in the supported [Board Layout](#board-layout)
	
	var linino = require('ideino-linino-lib'),
		board = new linino.Board(),
		led = board.pin.pwm.11;
	
	board.connect(function(){
		board.pinMode(led, board.MODES.PWM);
		board.analogWritens(led, 10000000, 20000000);
	});	
	
The `period` parameter allows you to set a period for the specified **pwm pin**. It's an optional parameter and is 10000000 default. Sometimes some PWM pin have a fixed period which can not be changed.

##### **analogRead (pin, [options], [callback])**
As the digitalRead function, it is used to reading the analog pins values. 

As the previous case, the `callback` function is triggered whenever the the signal level on the specified `pin` change. `

The `options` argument is not mandatory, but if specified you can set the sampling period and the resolution of the signal level for a generic `pin`. 

By default the sampling period and the resolution are specified in the configuration file `config.json` and are the same for all the analog pins. See the [Advanced configuration](#advanced-configuration) paragraph for more details on how to use this options.
	
	var linino = require('ideino-linino-lib'),
		board = new linino.Board(),
		temp = board.pin.analog.A0;
	
	board.connect(function(){
		board.analogRead(temp, function(value){
			console.log('value: ' + value);
		});
	});	
	
##### **servoWrite (pin, angle, [callback])**
This function allow you to write an degrees value between 0-180 on pwm pin specified.
It work on pwm pin D5,D9,D10,D11.

	var linino = require('ideino-linino-lib'),
		board = new linino.Board(),
		stepper = board.pin.servo.S5;
	
	board.connect(function(){	
		board.pinMode(stepper, board.MODES.SERVO);
		//set stepper angle to 180 degree.
		board.servoWrite(stepper, 180);
	});	

##### **tone (pin, frequency, duration, [callback])**
if a digital pin is set to pwm mode, you can write a tone to it.
The `frequency` parameter allows you to set the frequency of tone you want send to the specified **pwm pin**.

	
	var linino = require('ideino-linino-lib'),
		board = new linino.Board(),
		buzzer = board.pin.pwm.11;
	
	board.connect(function(){
		board.pinMode(buzzer, board.MODES.PWM);
		//in this case we send a 41Hz frequency sound to 'buzzer' pin for 120ms
		board.tone(buzzer, 41, 120);
	});	
	
The `duration` parameter allows you to set a duration time in milliseconds to the tone value. It's an optional parameter and is 1 default.

##### **noTone (pin, [callback])**
it send a 'no sound' signal to specidied **pwm pin**.

	var linino = require('ideino-linino-lib'),
	    board = new linino.Board(),
	    buzzer = board.pin.pwm.11;
	 
	    board.connect(function(){
		  board.pinMode(buzzer, board.MODES.PWM);
		  board.noTone(buzzer);
	});
	
##### **blink (delay, duration, led)**
This function allows you to send `HIGH` and `LOW` signal levels, with the specified `delay` and for the specified `duration` value, to the specified digital `pin`:
	
	var linino = require('ideino-linino-lib'),
		board = new linino.Board(),
		led = board.pin.digital.D13;
	
	board.connect(function(){
		board.pinMode(led, board.MODES.OUTPUT);
		//blink led 13, every 100 millis for 10 seconds.
		board.blink(500, 10 * 1000, led);
	});	

	
##### **map (value, fromLow, fromHigh, toLow, toHigh)**
Maps an integer value from one range to another (starting range [fromLow-toLow], final range [fromHigh-toHigh]). Return value is a float. 	
	
	var linino = require('ideino-linino-lib'),
		board = new linino.Board();
 
		board.connect(function(){
		//map value 80 from 0-100 to 0-5. Result is 4
			var val = board.map(80, 0, 100, 0, 5)
		});
	
##### **i2cRead (name, field [,options] [,callback])**
i2cRead function is used to read data from a lot of sensor on the i2c bus. All the sensors in Linino Shield are connected through an i2c bus. Other external sensor connected by i2c can be read with the `i2cRead` function, but need to be added before with the `addI2c` function (**TODO**). To read data through i2c bus, specify at least the following parameters:
- name: is the alias of the i2c device
- field: is one of available field of the i2c device 

    var linino = require('ideino-linino-lib'),
    	board = new linino.Board(),
        
        //add lucky shield
        board.addShield('lucky');
    
    board.connect(function(){
    	
        //read in_magn_x_raw from the Magnetometer sensor of the Lucky Shield
        board.i2cRead('MAG','in_magn_x_raw', function(value){
            console.log("X: " + value);
        });
    });
    
For the complete list of the name of the i2c device see the [`Linino Shield`](#lucky-shield)chapter

#### Pins
pins configuration is automatically loaded from the layout file, and then they are available in the `board.pin` object. You can access them in different ways, for example consider the digital pin 13 :

     1. board.pin.digital.D13;
     2. board.pin.digital['D13'];
     3. board.pin.digital[13];
     4. board.pin.digital['13'];
     
if you prefer you can use directlay the name of the pin. All the names are listed in the supported [Board Layout](#board-layout) and [Linino Shield](#linino-shields).

    //using directly the name of the pin and mode 
    board.pinMode('D12','input');
    

#### Advanced configuration
*linino-lib* has many advanced configurations which are loaded through a configuration file `config.json`:

    { 	
    	"logger": 	{ 
    					"off":		false,
    					"level":	"info",
    					"handler":	"all"
    				},
    	"resolution":	15,
    	"sampling":		25
    }

you can edit it if you want always use your personal settings, otherwise you can set your custom parameters when invoking the `Board` constructor. In this case it's very important to maintain the same structure of the configuration file. 
	
#### Setting and using the Logger
The library use a logger utility based on the *winston* module. The logger has three logging levels: _debug_, _info_ and _error_, and two appenders: _console_ and _file_. There are three arguments available for the logger:

 - **off** : if `true` the logger is disabled, if `false` (default) the logger is enabled.
 - **level** : is the logger level. As explained above the possible levels are: `info` (default), `debug` and `error`.
 - **handler** : is the appender of the logger. You can set `file` for writing your log on a file (inside the logs directory of linino-lib) or you can set it to `console` if you just want the log on the Ideino console (or system console, if you run it manually). Finally, if you want both the logger appenders, you can specify `all` (default).
	
if you want to switch from _info_  to _debug_ level and viceversa during the development, without changing the configuration files, you can set the logging level in the `Board` constructor, for example :

    var linino = require('ideino-linino-lib'),
    	board = new linino.Board( {logger: {level: 'debug'}} );
	
if you also want to disable the file appender :

	board = new linino.Board( {logger: {level: 'debug', handler: 'console'}} );

After the board has reached the connection status, the `Board` object gives you the chance to declare a *logger* object so, instead of using console.log(), you can leverage the `board.logger` callback. For example:

    var linino = require('ideino-linino-lib'),
    	board = new linino.Board({logger:{level: 'debug', handler: 'console'}}),
    	button = board.pin.digital.D10;
	
	board.connect(function(){
		board.digitalRead(button, function(value){
			if(value == board.HIGH)
				board.logger.debug('button pressed');
			else
				board.logger.debug('button released');
		});
	});	
#### Setting the analog parameters
In the configuration file there are two parameters called `sampling` and `resolution` that are usually associated with the analog pins. We use them to configure the reading of the analog values from the pins. 

**The first one** is used to set the sampling period of the analog values and represents the delay in milliseconds of the polling cycle. **The second one** triggers the signal value change to the user's callback and so represents the smallest change that will be triggered ever. These two parameters can be set, as well as in the configuration file, even in the `Board` constructor or in the `Board` `analogRead` function.

Setting sampling and resolution in the `Board` constructor is quite simple and you can do it as before for the `logger` properties. For example, if you don't need to check immediately the change of temperature detected by a sensor, you can set the `sampling` period to 30 seconds:

    board = new linino.Board( {sampling: 30000} );

Or if you don't need extreme accuracy, you can set the `resolution` to 50, whereas the values varies between 0 and 1023.

	board = new linino.Board( {resolution: 50} );

When you set `resolution` and `sampling` properties through the `Board` constructor, they usually become the default properties for all the used analog pins 

In case you needed an analog pin working with different properties than the other analog ones, you can directly set its `resolution` and `sampling` in the `analogRead` `Board` function for that one :

	board.connect(function(){
		var options = {resolution: 30, sampling: 1000};
        		
		board.analogRead(temp, options, function(value){
			board.logger.info('value: ' + value);
		});
	});	
	
	
	
	
### Htmlboard ###
**//TODO**

### Board Layout
Below the layout of the pin for the supported boards:

#### Linino One
- digital pins: 
    - D2: digital i/o #2
    - D3: digital i/o #3
    - D4: digital i/o #4
    - D5: digital i/o #5
    - D6: digital i/o #6
    - D7: digital i/o #7
    - D8: digital i/o #8
    - D9: digital i/o #9
    - D10: digital i/o #10
    - D11: digital i/o #11
    - D12: digital i/o #12
    - D13: digital i/o #13
- analog pins:
    - A0: analog input #1
    - A1: analog input #2
    - A2: analog input #3
    - A3: analog input #4
    - A4: analog input #5
    - A5: analog input #6
- pwm pins:
    - P3: pwm on digital pin #3 - dutycycle range: 0-4000000 (fixed period)
	- P5: pwm on digital pin #5 - dutycycle range: 0-32768000
    - P6: pwm on digital pin #6 - dutycycle range: 0-16384000
    - P9: pwm on digital pin #9 - dutycycle range: 0-32768000
    - P10: pwm on digital pin #10 - dutycycle range: 0-32768000
    - P11: pwm on digital pin #11 - dutycycle range: 0-32768000
- servo pins:
    - S3: servo on digital pin #3 (as pwm P3)
    - S5: servo on digital pin #5 (as pwm P5)
    - S6: servo on digital pin #6 (as pwm P6)
    - S9: servo on digital pin #9 (as pwm P9)
    - S10: servo on digital pin #10 (as pwm P10)
    - S11: servo on digital pin #11 (as pwm P11)    

#### Arduino Yùn
The same as [Linino One](#linino-one).

### Linino Shields
To use one of the Linino Shields you must to add it before connect to the board, as explained in the [`addShield`](#addshield-shieldmodel) function. All the sensors and components in the Linino Shields is connected to the board by an i2c bus, all the digital input output devices, are available as standard digital  pin through the [`digitalWrite`](#digitalwrite-pin-value-callback) and [`digitalRead`](#digitalread-pin-callback) functions, but you need to know the name of the pin you want to use. This name depends on the shield connected. Same is true for the other type of devices in the i2c bus

#### Lucky Shield
- shieldModel: lucky
- digital pins: 
    - BTN1: button #1
    - BTN2: button #2 
    - JOYU: joystick up
    - JOYD: joystick down
    - JOYR: joystick right
    - JOYL: joystick left
    - JOYC: joystick central button
    - LED1: led #1
    - LED2: led #2
    - LED3: led #3
    - LED4: led #4 
    - PIR: pir sensor
    - REL1: relay #1
    - REL2: relay #2 
- i2c devices: 
    - ACC: Accelerometer
	    - in_accel_scale
	    - in_accel_x_calibbias
	    - in_accel_y_calibbias
	    - in_accel_z_calibbias
	    - in_accel_x_raw
	    - in_accel_y_raw
	    - in_accel_z_raw
	    - in_accel_sampling_frequency
	- MAG: Magnetometer
	    - in_magn_x_raw
	    - in_magn_y_raw
	    - in_magn_z_raw
	    - in_magn_x_calibbias
	    - in_magn_y_calibbias
	    - in_magn_z_calibbias
	    - in_magn_scale
	    - in_temp_scale 
	    - in_temp_raw
	    - in_magn_sampling_frequency
	    - in_sampling_frequency_available
	- ALT: Pressure / Altimeter - Temperature
	    - in_pressure_scale
	    - in_pressure_raw
	    - in_temp_raw
	    - in_temp_scale
	- HUM: Humidity - Temperature
	    - temp1_input
	    - humidity1_input 
	- Frame Buffer devices: 
		- OLED:  //**TODO**



#### DigitalIO Shield
- shieldModel: digitalio
- digital pins: 
    - SD0: digital i/o #1 with Button #1 
    - SD1: digital i/o #2 with Button #2
    - SD2: digital i/o #3 with Button #3
    - SD3: digital i/o #4 with Button #4
    - SD4: digital i/o #5
    - SD5: digital i/o #6
    - SD6: digital i/o #7
    - SD7: digital i/o #8
    - SD8: digital i/o #9 with the Relay #1 and Led #1
    - SD9: digital i/o #10 with the Relay #2 and Led #2
    - SD10: digital i/o #11 with the Relay #3 and Led #3
    - SD11: digital i/o #12 with the Relay #4 and Led #4
    - SD12: digital i/o #13 with Led #5
    - SD13: digital i/o #14 with Led #6
    - SD14: digital i/o #15 with Led #7
    - SD15: digital i/o #16 with Led #8