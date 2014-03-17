#!/usr/bin/env python
# -*- coding: utf-8 -*-


import json, pyfirmata, thread, time, socket, logging, logging.handlers ,argparse, os
from pyfirmata import Arduino, util
import logging.handlers


dirname, filename = os.path.split(os.path.abspath(__file__))

#=====Arduino======================================
arduino_serial_port = '/dev/ttySPI0'
arduino_serial_brate = 57600                    

#====variabile e strutture dati====================
logger_file=dirname+'/bridge-firmata.log'
layout_path='/opt/ideino-linino/node_modules/ideino-linino-lib/utils/layout.json'
host=''
sock=[None]
port= 9810                     #1557
gap=2                                                                                                       #read gap param
hash_getpin_d={}                                                                                            #get_pin dei pin digitali
hash_tx={'A0':-1,'A1':-1,'A2':-1,'A3':-1,'A4':-1,'A5':-1,'D2':-1,'D3':-1,'D4':-1,'D5':-1,'D6':-1,'D7':-1,'D8':-1,'D9':-1,'D10':-1,'D11':-1,'D12':-1,'D13':-1}
read_pin=[]                                                     #pin emit

def arduino():
    arduino = Arduino(arduino_serial_port,baudrate=arduino_serial_brate)
    iterator = util.Iterator(arduino)
    iterator.start()
    return arduino
        
def excute_command (command):

    cmd = json.loads(command)
        
    for i in range(len(cmd['command'])):                    #read python object param

        cmd_type=cmd['command'][i]['cmd'].upper()
        pin=cmd['command'][i]['pin']
        cmd_ad=pin[0].lower()
        cmd_pin=pin[1:3]                            #pin
        cmd_io=''
        cmd_value=''
        cmd_firm=''
        if (cmd_ad=='a' and int(cmd_pin)>5):
            logger.warning('Pin '+cmd_pin+' is not an analog pin')
            break
        elif (cmd_ad=='d' and int(cmd_pin) >13):
            logger.warning('Pin '+cmd_pin+' is not an digital pin')
            break

   #MODE: INPUT,OUTPUT, PWM, SERVO

        if(cmd_type == 'MODE'):                             #il comando lanciato è di tipo MODE

            cmd_io = cmd['command'][i]['mode'][0]           #cmd_io puo essere input o output (i=input, o=output)
            cmd_firm = cmd_ad+':'+cmd_pin+':'+cmd_io        #firmata command (ex: 'd:13:o')
            if(cmd_ad=='a' and cmd_io!='i'):
                logger.warning('Analog pin '+cmd_ad.upper()+cmd_pin+' can only operate in input mode')
            elif(cmd_ad=='d'):
                if cmd_pin not in hash_getpin_d: 
                    arduino.digital[int(cmd_pin)].write(0)              #reset pin a 0
                    pin_d = arduino.get_pin(cmd_firm)		        
                    hash_getpin_d.update({cmd_pin:pin_d})

                if(cmd_io == 'i'):
                    if (hash_getpin_d[cmd_pin].mode != 0):            #se il pin è gia in modalità input non faccio il reset del pin (0 INPUT - 1 OUTPUT - 2 ANALOG - 3 PWM - 4 SERVO)
                        hash_getpin_d[cmd_pin].write(0)               #reset pin a 0
                        hash_getpin_d[cmd_pin].mode=pyfirmata.INPUT
                        
                if(cmd_io == 'o'):
                    hash_getpin_d[cmd_pin].mode=pyfirmata.OUTPUT
                    hash_getpin_d[cmd_pin].write(0)                   #reset pin a 0 

                if(cmd_io == 'p'):
                    hash_getpin_d[cmd_pin].mode=pyfirmata.PWM

                if(cmd_io == 's'):
                    hash_getpin_d[cmd_pin].mode=pyfirmata.SERVO
                
            logger.info("Command >>> Type: " + cmd_type + "; Pin:" + cmd_pin + "; A/D:" + cmd_ad + "; I/O:" + cmd_io + "; Firmata:" + cmd_firm)


            #Write COMMAND

        if( cmd_type=='WRITE'): 

            cmd_value = cmd['command'][i]['value']

            try:
                if (cmd_ad == 'a'):
                    logger.warning("Write on analog pin "+cmd_pin+" is impossible: Arduino don't support analog write")
                elif (cmd_ad == 'd'):
                    arduino.digital[int(cmd_pin)].write(float(cmd_value))
                    logger.debug("Command >>> Type: "+cmd_type+"; Pin:"+cmd_pin+"; A/D:"+cmd_ad+"; Write Value:"+str(cmd_value))

            except:
                logger.error('Write on digital pin '+cmd_pin+' is impossible: pin is in input mode')

                    
            #Read COMMAND  

        elif( cmd_type=='READ'): 

            pin_r=(cmd_ad+cmd_pin).upper()
                                                                            #pin with read request            
            try:
                if cmd_ad == 'd':
                    if pin_r not in read_pin:                       
                        read_pin.append((pin_r))
                        
                elif cmd_ad == 'a': 
                    arduino.analog[int(cmd_pin)].enable_reporting()
                    if pin_r not in read_pin:
                        read_pin.append((pin_r))
                
                logger.debug("Command >>> Type: "+cmd_type+"; Pin:"+cmd_pin+"; A/D:"+cmd_ad)

            except:
                logger.error('read command error')
 

def polling(thread, delay):
    while True:
    
        time.sleep(delay)
        hash_tmp={'A0':hash_tx['A0'],'A1':hash_tx['A1'],'A2':hash_tx['A2'],'A3':hash_tx['A3'],'A4':hash_tx['A4'],'A5':hash_tx['A5'],'D2':hash_tx['D2'],'D3':hash_tx['D3'],'D4':hash_tx['D4'],'D5':hash_tx['D5'],'D6':hash_tx['D6'],'D7':hash_tx['D7'],'D8':hash_tx['D8'],'D9':hash_tx['D9'],'D10':hash_tx['D10'],'D11':hash_tx['D11'],'D12':hash_tx['D12'],'D13':hash_tx['D13']}   

        #========DIGITAL PIN===========
        
        for i in range (2,14):                                      # i pin 0 1 sono riservati alla seriale
            hash_key="D"+str(i)
            if str(i) in hash_getpin_d:                           # verifico che sia stato fatto il get_pin del pin interessato altrimenti la riga sotto da un errore
                if hash_key in read_pin:                                # leggo il pin solo se è in input in modo da ridurre il traffico di messaggi xmpp
                    if arduino.digital[i].read():
                        hash_tmp[hash_key]= 1                       # invio 1 e 0 al posto di True e False
                    else:                                           #(arduino.digital[i].read()== None) or (arduino.digital[i].read()== False):
                        hash_tmp[hash_key]= 0

        #========ANALOG PIN=============    
        for y in range (0,6):
            hash_key="A"+str(y)
            if hash_key in read_pin:                                #faccio la lettura solo se è stata effettuata la richiesta
                value=arduino.analog[y].read()    
                if value is not None:                
                    value = int(value * 1023)
                    if hash_tx[hash_key]+gap < value or hash_tx[hash_key]-gap > value:
                        hash_tmp[hash_key]= value                                
                else:
                    hash_tmp[hash_key]=0


        for i in hash_tmp.keys():                                   
            if cmp(hash_tx[i],hash_tmp[i]):
                hash_tx[i]=hash_tmp[i]
                if sock[0] is not None:
                    sock[0].sendall('{"cmd": "read-back", "pin": "'+i.upper()+'", "value":'+str(hash_tx[i])+'}')
		    time.sleep(0.025)

def connection(s):
    while 1:
        conn, addr = s.accept()
        sock[0]=conn
        logger.info('Client connected:'+str(addr))
        handle(conn,addr)
        

def handle(conn, addr):       #handle websocket

    while 1:
        try:
            data = conn.recv(1024)
        except socket.error , msg:
            logger.error('data receive failed. Error code: '+str(msg[0])+' Error message: ' + msg[1])
            break
        if not data:
            break
        try:        
            if '}{' in data:
                data=data.replace('}{','}-{')
                data=data.split('-')
                for i in data:
                    excute_command(i)
            else:
                excute_command(data)
        except :
            logger.error('json parse error on this command: '+data)
    
    logger.debug('Client closed:'+str(addr))
    sock[0]=None
    conn.close()


def arg_par():
    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter,
                description='Show the use of options in Python')
    parser.add_argument('-log', type=str, help=" set the log level [i=info, e=error, w=warning, d=debug] (default: %(default)s)", nargs='?',default='i')
    parser.add_argument('-handle', type=str, help='set the log mode [f=file, c=console, a=all] (default: %(default)s)', nargs='?', default='f')
    parser.add_argument('-layout', type=str, help='set the board layout [y=yun, m=mega, r=raspberry](default: %(default)s)', nargs='?', default='y')
    args = parser.parse_args()
    l = args.log
    hl = args.handle
    ly = args.layout
    return l,hl,ly
    
if __name__ == "__main__":

    layout_file=open(layout_path)               #upload board layout
    file_data=layout_file.read()
    layout_file.close()
    layout=json.loads(file_data)

    l,hl,ly= arg_par()

    arduino=arduino()
    
    logger = logging.getLogger('bridge-firmata')
    formatter = logging.Formatter('%(asctime)s %(levelname)s: %(message)s')
    hdlr_file = logging.handlers.RotatingFileHandler(logger_file, maxBytes=100000, backupCount=3)   #logger file (backupCount= log file number, maxBytes=log file size)
    hdlr_console= logging.StreamHandler()
    hdlr_file.setFormatter(formatter)
    hdlr_console.setFormatter(formatter)
    if 'w' in l:
        level=logging.WARNING
    if 'i' in l:
        level=logging.INFO
    if 'e' in l:
        level=logging.ERROR
    if 'd' in l:
        level=logging.DEBUG
    if 'f' in hl:
        logger.addHandler(hdlr_file)
    if 'a' in hl:
        logger.addHandler(hdlr_file)
        logger.addHandler(hdlr_console)
    if 'c' in hl:
        logger.addHandler(hdlr_console)
    if 'y' in ly:
        board='arduino_yun'

    logger.setLevel(level)              #WARNING,INFO,ERROR
    
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)     
    try:
        s.bind((host, port))
    except socket.error , msg:
        logger.error('Bind failed. Error code: '+str(msg[0])+' Error message: ' + msg[1])
    s.listen(5)

    try:
        thread.start_new_thread( polling, ("Thread-1", 0.025))
        logger.debug('Polling thread started')
    except:
        logger.error('unable to start polling thread')

    connection(s)
        
    
    


