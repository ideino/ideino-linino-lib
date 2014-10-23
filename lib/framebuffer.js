/***
 * file: framebuffer.js
 * author: https://github.com/quasto
 * based on: https://github.com/fivdi/onoff/blob/master/onoff.js 
 ***/

var fs = require('fs'),
    path = require('path');
    fbRootPath = '/dev/',
	//TODO al momento viene abilitato dalla shield
    //fbEnablingPath = '/sys/devices/mcuio/0:0.0/adc/',
    exec = require('child_process').exec;
    
exports.version = '0.0.1';

function FrameBuffer(pin_register, options) {
    options = options || {};
	
    this.fb = pin_register.NUM;
	this.map = pin_register.MAP;
    this.fbPath = fbRootPath + this.map; 
    this.opts = {};
    
    valuePath = this.fbPath;
    /*if (!fs.existsSync(this.adcPath)) {
        // The pin hasn't been exported yet so export it.
        fs.writeFileSync(adcEnablingPath + 'enable', '1');

        // Allow all users to read and write the GPIO value file
        fs.chmodSync(valuePath, 0444);
    } 
	*/
    
    this.valueFd = fs.openSync(valuePath, 'r+');
}

exports.FrameBuffer = FrameBuffer;

/**
 * Write to the FB value synchronously.
 *
 */
/*
var writing = false;
FrameBuffer.prototype.writeSync = function(imgFile) {
    var that = this;
    if(!writing){
        
        if(fs.existsSync(imgFile)){
            //1- convert to monochrome remove alpha channel to png
            convertMonochrome(imgFile, function(err, resultFile){
                if(!err){
                //2- call png2mono tools
                    convertPng2Mono(resultFile, function(err, resultFile) {
                        if(!err){
                            writeToFb(that.fbPath, resultFile, function(err){
                                if(!err){
                                    
                                }
                            });

                        }
                    });
                }
            });

        

        //3- write to framebuffer 
        }
        else{
            //il file non esiste   
            
        }
    }
    else{
        //sta ancora scrivendo il precedente
    }
	
};
*/

FrameBuffer.prototype.writeSync = function(context, canvas) {
    //var buffer = mono(context, canvas);
    //fs.writeSync(this.valueFd, buffer, 0, buffer.length, 0);
    
    mono(context, canvas, this.valueFd, function(){
        
    });
    /*
    fs.write(this.valueFd, buffer, 0, buffer.length, 0, function(){
    
    });
    */
}


function mono(context, canvas, valueFd, callback) {
    
    //var timeStart = new Date().getTime();
    var elem = [1,2,4,8,16,32,64,128];
    var nb = new Buffer(1024),
    imgData = context.getImageData(0, 0, canvas.width, canvas.height),
    pixels = imgData.data,
    //pixels = canvas.toBuffer(),     
    j = 0, 
    k = 0,
    h = 0,
    b = 0;
    nb.fill(0);
    //var b = 0;
    
    //console.log(pixels.length);
    for(var i = 0, n = pixels.length; i < n; i += 4) {
        //var g = pixels[i];// * .3 + pixels[i+1] * .59 + pixels[i+2] * .11;
        //var b = g <= 127 ? 0 : 1 ;
        b = pixels[i] <= 127 ? 1 : 0;
        if(k == 8){
            k = 0;
            j++;
        }
        nb[j] += b * elem[k];//Math.pow(2,k);
        k++;
        h++;
    }
    
    /*var timeStop = new Date().getTime(); 
    var timeElapsed = timeStop-timeStart; 
    console.log("MONO: "+timeElapsed);*/
    canvas.width=canvas.width;
    //return nb;
    fs.write(valueFd, nb, 0, nb.length, 0, function(){
        callback();
    });
    
    
  }
/*
function mono(context, canvas, valueFd, callback) {
    var timeStart = new Date().getTime();
    
    var nb = new Buffer(1024),
    imgData = context.getImageData(0, 0, canvas.width, canvas.height),
    pixels = imgData.data,     
    j = 0, 
    k = 0,
    h = 0;
    nb.fill(0);
    var b = 0;
    for(var i = 0, n = pixels.length; i < n; i += 4) {
        //var g = pixels[i];// * .3 + pixels[i+1] * .59 + pixels[i+2] * .11;
        //var b = g <= 127 ? 0 : 1 ;
        b = pixels[i] <= 127 ? 1 : 0;
        if(k == 8){
            k = 0;
            j++;
        }
        nb[j] += b * Math.pow(2,k);
        k++;
        h++;
    }
    
    var timeStop = new Date().getTime(); 
    var timeElapsed = timeStop-timeStart; 
    console.log(timeElapsed);
    
    
    //return nb;
    fs.write(valueFd, nb, 0, nb.length, 0, function(){
        callback();
    });
    
  }
  */