/***
 * file: framebuffer.js
 * author: https://github.com/quasto
 * based on: https://github.com/fivdi/onoff/blob/master/onoff.js 
 ***/

var fs = require('fs'),
    path = require('path');
    fbRootPath = '/dev/',
    exec = require('child_process').exec;
    


function FrameBuffer(pin_register, options) {
    options = options || {};
	
    this.fb = pin_register.NUM;
	this.map = pin_register.MAP;
    this.fbPath = fbRootPath + this.map; 
    this.opts = {};
    this.valuePath = this.fbPath;
    this.valueFd = fs.openSync(this.valuePath, 'r+');
    
    /**
    * Write to the FB value synchronously.
    *
    */
    this.writeSync = function(context, canvas) {
        mono(context, canvas, this.valueFd, function(){});
    }

    /**
    * 
    *
    */
    function mono(context, canvas, valueFd, callback) {

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
        

        canvas.width=canvas.width;              //to clear canvas
        fs.write(valueFd, nb, 0, nb.length, 0, function(){
            callback();
        });


    }
}

exports.FrameBuffer = FrameBuffer;
exports.version = '0.0.2';

