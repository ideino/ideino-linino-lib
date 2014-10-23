/***
 * file: check.js
 * version: 0.6.0
 * author:  https://github.com/quasto
 *          https://github.com/andrea-83
  ***/

var utils  = require('./utils'),
    logger,
    boardLayout = {};
    
/*** constants ***/	
var CHECK_MSG = {	PIN_UNDEFINED : 	"The specified pin is undefined!",
					PIN_NOT_DIGITAL: 	"The specified pin [{0}] is not a Digital pin",
					PIN_NOT_ANALOG: 	"The specified pin [{0}] is not an Analog pin",
                    PIN_NOT_PWM: 	    "The specified pin [{0}] is not a Pwm pin",
					PIN_NOT_VIRTUAL: 	"The specified pin [{0}] is not a Virtual pin",
					PIN_NOT_LAYOUT:		"The specified pin [{0}] is not defined in the board layout!",
					PIN_TIMER_SERVO:	"The [{0}] pin timer used by a servo",
                    PIN_TIMER_PWM:	    "Check AnalogWritens [{0}] - pwm pin [{1}] share the same timer",
					PIN_NOT_DEFINED:	"The specified pin [{0}] is not already defined! You must first, call pinMode!",
                    PIN_NOT_ENABLED:    "The specified pin [{0}] is disabled",                 
					MODE_NOT_VALID: 	"The specified mode [{0}] for pin [{1}] is not valid.",
					MODE_UNDEFINED : 	"The specified mode for pin [{0}] is undefined!"

					
				};

module.exports = {
    lookUpPin:      function(p){ return lookUpPin(p); }
    ,pinMode:       function(p, m){ return pinMode(p, m); }
    ,digitalWrite:  function(p){ return digitalWrite(p); }
    ,digitalRead:   function(p){ return digitalRead(p); }
    ,analogWrite:   function(p){ return analogWrite(p); }
    ,analogRead:    function(p){ return analogRead(p); }
    ,analogWritens: function(p){ return analogWritens(p); }
    ,i2cRead:       function(p){ return i2cRead(p); }
    ,servoWrite:    function(p){ return servoWrite(p); }
    ,setBoardLayout:function(b) {  boardLayout = b;}
    ,setLogger:     function(l) {  logger = l;}
    //,getBoardLayout: function(){ console.log(boardLayout);}
};
/*** PUBLIC ***/

function lookUpPin(pin){
    try{
        if( typeof(pin) == 'undefined'){
			throw new Error(CHECK_MSG.PIN_UNDEFINED);
        }
        else{
            p = getValueByKey(pin.toUpperCase(), boardLayout.layout);
            if(!p)
                throw new Error(String.format(CHECK_MSG.PIN_NOT_LAYOUT, pin));
            else
                return p;
        }
    }
    catch(err){
        throw new Error('LOOK UP ERROR: '+ err.message);    
    }
}
function pinMode(pinnumber, mode){
	try{ 
        if( typeof(mode) == 'undefined'){
			return(new Error(String.format(CHECK_MSG.MODE_UNDEFINED,pinnumber)) );
		}

        if( !isPinEnabled(pinnumber) ){
			return(new Error(String.format(CHECK_MSG.PIN_NOT_ENABLED,pinnumber)) );
		}

        if( !isPinDigital(pinnumber) && !isPinPwm(pinnumber) ){ 
			return new Error(String.format(CHECK_MSG.PIN_NOT_DIGITAL,pinnumber));
		}

        
        if( isPinDigital(pinnumber) && 
            !(  mode.toLowerCase() == utils.MODES.OUTPUT.toLowerCase() ||
                mode.toLowerCase() == utils.MODES.INPUT.toLowerCase())){
		      return new Error(String.format(CHECK_MSG.MODE_NOT_VALID, mode, pinnumber) + " Allowed modes are: "+ utils.MODES.OUTPUT +", "+ utils.MODES.INPUT); 
    
        }
        if (    isPinPwm(pinnumber) && 
                !(  mode.toLowerCase() == utils.MODES.PWM.toLowerCase() ||
                    mode.toLowerCase() == utils.MODES.SERVO.toLowerCase())){
		      return new Error(String.format(CHECK_MSG.MODE_NOT_VALID, mode, pinnumber) + " Allowed modes are: "+ utils.MODES.PWM +", "+ utils.MODES.SERVO);    
        }
        
        return true;

	}
	catch(err){
		return new Error('Check Pin Mode: '+ err.message);
	}
}
function digitalWrite(pinnumber){	
	try{
        if( !isPinEnabled(pinnumber) ){
			return(new Error(String.format(CHECK_MSG.PIN_NOT_ENABLED,pinnumber)) );
		}
        
        if( !isPinDigital(pinnumber) ){      
			return new Error( String.format(CHECK_MSG.PIN_NOT_DIGITAL, pinnumber) );
        }
        if( typeof(boardLayout.register[pinnumber].MOD) == 'undefined'){
			return new Error( String.format(CHECK_MSG.PIN_NOT_DEFINED, pinnumber) );
		}
        
        if( !isModeOutput(pinnumber) ){
			return new Error( String.format(CHECK_MSG.MODE_NOT_VALID, boardLayout.register[pinnumber].MOD.toLowerCase(), pinnumber) + " Allowed modes are: "+            utils.MODES.OUTPUT);
		}
        
	}
	catch(err){
		return new Error('Check Digital Write: '+ err.message);
	}
}
function digitalRead(pinnumber){
	try{
        if( !isPinEnabled(pinnumber) ){
			return(new Error(String.format(CHECK_MSG.PIN_NOT_ENABLED,pinnumber)) );
		}
        
        if( !isPinDigital(pinnumber)){ 
			return new Error( String.format(CHECK_MSG.PIN_NOT_DIGITAL, pinnumber) );
		}
		
        if(typeof(boardLayout.register[pinnumber].MOD) == 'undefined'){
			return new Error( String.format(CHECK_MSG.PIN_NOT_DEFINED, pinnumber) );
		}
        
		if(	!isModeOutput(pinnumber)  && 
			!isModeInput(pinnumber)  &&
			!isModePwm(pinnumber) ){
			return new Error(String.format(CHECK_MSG.MODE_NOT_VALID, boardLayout.register[pinnumber].MOD.toLowerCase(), pinnumber) + " Allowed modes are: "+ utils.MODES.OUTPUT +", "+ utils.MODES.INPUT);
		}
        return true;
	}
	catch(err){
		return new Error('Check Digital Read: '+ err.message);
	}
}
function analogWrite(pinnumber){	
	try{
        if( !isPinEnabled(pinnumber) ){
			return(new Error(String.format(CHECK_MSG.PIN_NOT_ENABLED,pinnumber)) );
		}
        
        if(!isPinPwm(pinnumber)){ 
			return new Error( String.format(CHECK_MSG.PIN_NOT_PWM, pinnumber) ) 
		}
		
        if(typeof(boardLayout.register[pinnumber].MOD) == 'undefined'){
			return new Error( String.format(CHECK_MSG.PIN_NOT_DEFINED, pinnumber) ) 
		}
		
        if(!isModePwm(pinnumber) ){
			return new Error( String.format(CHECK_MSG.MODE_NOT_VALID, boardLayout.register[pinnumber].MOD.toLowerCase(), pinnumber) + " Allowed modes are: "+ utils.MODES.PWM);
		}
        return true;

	}
	catch(err){
		return new Error('Check Analog Write: '+ err.message);
	}
}
function analogWritens(pinnumber){
	try{
		var check = analogWrite(pinnumber, boardLayout);
		if(check instanceof Error){
			throw check;
		}
		else{
			//verify that i can write the period to pins that have a shared timer 
			//cannot write the period to pins in servo mode with a shared timer
			var timer = boardLayout.register[pinnumber].TIM;
            //analogwrite
			var timer_share= _.filter(boardLayout.timer, function(pin){ 
                        return  pin.SHA == true &&
                                pin.SER == true &&
                                pin.DEF == timer } );
			if( timer_share.length > 0){
				throw new Error(String.format(CHECK_MSG.PIN_TIMER_SERVO, pinnumber)); 
			}
            if(boardLayout.timer[timer].USE.indexOf(pinnumber) < 0){
                boardLayout.timer[timer].USE.push(pinnumber);
            }
            if(boardLayout.timer[timer].USE.indexOf(pinnumber) >= 0 && boardLayout.timer[timer].USE.length > 1){                
                logger.warn(String.format(CHECK_MSG.PIN_TIMER_PWM, pinnumber, boardLayout.timer[timer].USE ));
            }
		}
		return true;	
	}	
	
	catch(err){    
		return new Error('Check AnalogWritens: '+ err.message);
	}
}
function analogRead(pinnumber){
	try{
        if( !isPinEnabled(pinnumber) ){
			return(new Error(String.format(CHECK_MSG.PIN_NOT_ENABLED,pinnumber)) );
		}
        
		if( typeof(pinnumber) == 'undefined'){
			return new Error( CHECK_MSG.PIN_UNDEFINED ) ;
		}
        
        if( !isPinAdc(pinnumber) && !isPinPwm ){ 
			return( new Error( String.format(CHECK_MSG.PIN_NOT_ANALOG, pinnumber)) );
		}
        
        if(isPinPwm(pinnumber) &&
           typeof(boardLayout.register[pinnumber].MOD) == 'undefined'){
			return new Error( String.format(CHECK_MSG.PIN_NOT_DEFINED, pinnumber) ) ;
		}
        
        if(isPinPwm(pinnumber) && isModePwm(pinnumber) ){
			return(new Error( String.format(CHECK_MSG.MODE_NOT_VALID, boardLayout.register[pinnumber].MOD.toLowerCase(), pinnumber) + " Allowed modes are: "+ utils.MODES.PWM));
		}
		
		return true;
	}
	catch(err){
		return new Error('Check Analog Read: '+ err.message);
	}
}

function servoWrite(pinnumber){	
	try{
        if( !isPinEnabled(pinnumber) ){
			return(new Error(String.format(CHECK_MSG.PIN_NOT_ENABLED,pinnumber)) );
		}
        
        if(!isPinPwm(pinnumber)){ //servo pin TYP is pwm
            return new Error( String.format( CHECK_MSG.PIN_NOT_SERVO, pinnumber ) );
        }

		if(typeof(boardLayout.register[pinnumber].MOD) == 'undefined'){
			return new Error( String.format(CHECK_MSG.PIN_NOT_DEFINED, pinnumber) );
		}

		if(!isModeServo(pinnumber) ){
			return new Error( String.format(CHECK_MSG.MODE_NOT_VALID, boardLayout.register[pinnumber].MOD.toLowerCase(), pinnumber) + " Allowed modes are: "+ utils.MODES.SERVO);
		}
		return true;
	}
	catch(err){
		return new Error('Check Servo Write: '+ err.message);
	}
}

function i2cRead(pinnumber){
	try{
        if( !isPinEnabled(pinnumber) ){
			return(new Error(String.format(CHECK_MSG.PIN_NOT_ENABLED,pinnumber)) );
		}
        		
		return true;
	}
	catch(err){
		return new Error('Check i2c Read: '+ err.message);
	}
}

function display(pinnumber){
	try{
        if( !isPinEnabled(pinnumber) ){
			return(new Error(String.format(CHECK_MSG.PIN_NOT_ENABLED,pinnumber)) );
		}
        		
		return true;
	}
	catch(err){
		return new Error('Check i2c Read: '+ err.message);
	}
}

/*** PRIVATE ***/

function getValueByKey(key, collection) {
    collection = collection || '';
    //var val = this.valueOf();
    if(typeof collection == 'object' || typeof collection == 'array')
    {
        if(key in collection)
        {
            return collection[key];
        }
        else
        {
            for(var x in collection)
            {
                var found = getValueByKey(key, collection[x]);
                if(found != false)
                {
                    return found;
                }
            }
        }
    }
    return false;
};

function isPinEnabled(pin){
    if( boardLayout.disabled.indexOf(pin.toUpperCase()) >= 0) return false;
    else return true;
};
function isPinDigital(pin){
    if( boardLayout.register[pin].TYP.toUpperCase() == 'DIGITAL') return true;
    else return false;
};
function isPinPwm(pin){
    if( boardLayout.register[pin].TYP.toUpperCase() == 'PWM') return true;
    else return false;
};
function isPinAdc(pin){
    if( boardLayout.register[pin].TYP.toUpperCase() == 'ANALOG') return true;
    else return false;
};
function isPinServo(pin){
    if( boardLayout.register[pin].TYP.toUpperCase() == 'SERVO') return true;
    else return false;
};
function isPinI2c(pin){
    if( boardLayout.register[pin].TYP.toUpperCase() == 'ANALOG') return true;
    else return false;
};
function isPinFb(pin){
    if( boardLayout.register[pin].TYP.toUpperCase() == 'FB') return true;
    else return false;
};

function isModeInput(pin){
    if( boardLayout.register[pin].MOD.toUpperCase() == 'INPUT') return true;
    else return false;
};
function isModeOutput(pin){
    if( boardLayout.register[pin].MOD.toUpperCase() == 'OUTPUT') return true;
    else return false;
};
function isModePwm(pin){
    if( boardLayout.register[pin].MOD.toUpperCase() == 'PWM') return true;
    else return false;
};
function isModeServo(pin){
    if( boardLayout.register[pin].MOD.toUpperCase() == 'SERVO') return true;
    else return false;
};


