/***
 * file: index.js
 * version: 0.5.0
 * author: https://github.com/quasto
 * license: mit
 ***/
"use strict";

var linino = exports;

exports.board		= require('./board');
exports.htmlboard	= require('./htmlboard');
exports.version = "0.0.6";
 
/*** import all prototype functions used in this module ***/
require('./utils/proto');

/*** starting and setting the boards ***/
var board;
exports.Board = function(options) {
	return getBoard(options);
}; 

exports.Htmlboard = function(options){
	var h = new linino.htmlboard(options, getBoard(options));
	return h;
};

function getBoard(options){
	if(!board || typeof(board) == 'undefined' )
		board = new linino.board(options);
	return board;
};