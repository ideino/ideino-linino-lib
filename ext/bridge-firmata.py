#!/usr/bin/env python
# -*- coding: utf-8 -*-


import json, pyfirmata, thread, threading, time, socket
from pyfirmata import Arduino, util

#=====Arduino======================================
arduino_serial_port = '/dev/ttySPI0'
arduino_serial_brate = 57600                    

arduino = Arduino(arduino_serial_port,baudrate=arduino_serial_brate)
iterator = util.Iterator(arduino)
iterator.start()


#====variabile e strutture dati====================
host=''              #'127.0.0.1'                #socket
port= 9810                     #1557
gap=2                                                                                                       #read gap param
hash_getpin_d={'0':0,'1':0,'2':0,'3':0,'4':0,'5':0,'6':0,'7':0,'8':0,'9':0,'10':0,'11':0,'12':0,'13':0}      #get_pin dei pin digitali
#hash_reporting_a={'0':0,'1':0,'2':0,'3':0,'4':0,'5':0}  
hash_tx={'A0':-1,'A1':-1,'A2':-1,'A3':-1,'A4':-1,'A5':-1,'D2':-1,'D3':-1,'D4':-1,'D5':-1,'D6':-1,'D7':-1,'D8':-1,'D9':-1,'D10':-1,'D11':-1,'D12':-1,'D13':-1}
read_pin=[]                                                     #pin emit


        
def excute_command (command):               

    cmd = command                              
    for i in range(len(cmd['command'])):                    #read python object param

        cmd_type=cmd['command'][i]['cmd'].upper()
        pin=cmd['command'][i]['pin']
        cmd_ad=pin[0].lower()
        cmd_pin=pin[1:3]                            #pin
        cmd_io=''
        cmd_value=''
        cmd_firm=''

   #MODE: INPUT,OUTPUT, PWM, SERVO

        if(cmd_type == 'MODE'):                             #il comando lanciato è di tipo MODE

            cmd_io = cmd['command'][i]['mode'][0]           #cmd_io puo essere input o output (i=input, o=output)
            cmd_firm = cmd_ad+':'+cmd_pin+':'+cmd_io        #firmata command (ex: 'd:13:o')
            if(cmd_ad=='a'):
                pass
                #print 'Analog pin can operate only in input mode'
            elif(cmd_ad=='d'):
                if (hash_getpin_d[cmd_pin]==0): 
                    arduino.digital[int(cmd_pin)].write(0)              #reset pin a 0
                    pin_d = arduino.get_pin(cmd_firm)		        
                    hash_getpin_d[cmd_pin]= pin_d            

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

                
            #print "Command >>> Type: " + cmd_type + "; Pin:" + cmd_pin + "; A/D:" + cmd_ad + "; I/O:" + cmd_io + "; Firmata:" + cmd_firm


            #Write COMMAND

        if( cmd_type=='WRITE'): 

            cmd_value = cmd['command'][i]['value']

            try:
                if (cmd_ad == 'a'):
                    pass
                    #print "Command ERROR: analog write impossible"
                elif (cmd_ad == 'd'):
                    arduino.digital[int(cmd_pin)].write(float(cmd_value))
                    #print "Command >>> Type: "+cmd_type+"; Pin:"+cmd_pin+"; A/D:"+cmd_ad+"; Write Value:"+str(cmd_value)

            except:
                pass
                #print "Command ERROR: pin is in input mode"

                    

            #Read COMMAND  

        elif( cmd_type=='READ'): 

            cmd_read_value = -1
            pin_t=(cmd_ad+cmd_pin).upper()
                                                                            #pin with read request            
            try:
                if cmd_ad == 'd':
                    if pin_t not in read_pin:
                        read_pin.append((cmd_ad+cmd_pin).upper())
                        
                elif cmd_ad == 'a': 
                    arduino.analog[int(cmd_pin)].enable_reporting()
                    if pin_t not in read_pin:
                        read_pin.append((cmd_ad+cmd_pin).upper())
                
                #print "Command >>> Type: "+cmd_type+"; Pin:"+cmd_pin+"; A/D:"+cmd_ad

            except:
                pass
                #print "Command ERROR: pin out of range"


def polling(thread, delay, socket):
    #print 'polling'
    while True:
    
        time.sleep(delay)
        hash_tmp={'A0':hash_tx['A0'],'A1':hash_tx['A1'],'A2':hash_tx['A2'],'A3':hash_tx['A3'],'A4':hash_tx['A4'],'A5':hash_tx['A5'],'D2':hash_tx['D2'],'D3':hash_tx['D3'],'D4':hash_tx['D4'],'D5':hash_tx['D5'],'D6':hash_tx['D6'],'D7':hash_tx['D7'],'D8':hash_tx['D8'],'D9':hash_tx['D9'],'D10':hash_tx['D10'],'D11':hash_tx['D11'],'D12':hash_tx['D12'],'D13':hash_tx['D13']}   

            #====DIGITAL PIN=====
    

        for i in range (2,14):                                      # i pin 0 1 sono riservati alla seriale
            hash_key="D"+str(i)
            if(hash_getpin_d[str(i)]!=0):                           # verifico che sia stato fatto il get_pin del pin interessato altrimenti la riga sotto da un errore
                if hash_key in read_pin:                                # leggo il pin solo se è in input in modo da ridurre il traffico di messaggi xmpp
                    if arduino.digital[i].read():
                        hash_tmp[hash_key]= 1                       # invio 1 e 0 al posto di True e False
                    else:                                           #(arduino.digital[i].read()== None) or (arduino.digital[i].read()== False):
                        hash_tmp[hash_key]= 0

          #=====ANALOG PIN==========    
        for y in range (0,6):
            hash_key="A"+str(y)
            value=arduino.analog[y].read()    
            if (value is not None) and (hash_key in read_pin) :                
                value = int(value * 1023)
                if hash_tx[hash_key]+gap < value or hash_tx[hash_key]-gap > value:
                    hash_tmp[hash_key]= value                                
            elif hash_key in read_pin:
                hash_tmp[hash_key]=0


        for i in hash_tmp.keys():                                   
            if cmp(hash_tx[i],hash_tmp[i]):
                hash_tx[i]=hash_tmp[i]
                try:
                    socket.send('{"cmd": "read-back", "pin": "'+i.upper()+'", "value":'+str(hash_tx[i])+'}')
                except:
                    #print 'Server disconnected'
                    pass


def connection(s):
    clients = [] 
    while 1:
        conn, addr = s.accept()
        #print 'connection'
        clients.append(conn)
        handle(conn,addr,clients)

def handle(s, addr, clients):       #handle websocket
    try:
        thread.start_new_thread( polling, ("Thread-1", 0.05,s))
    except:
        print "Error: unable to start polling thread"

    while 1:
        data = s.recv(1024)
        if not data:
            #print "No data"
            break
        command=json.loads(data)
        excute_command(command)
        #print 'client to server: '+data
        #s.send('{"cmd": "read-back", "pin": "5", "value":3}')
                                 #se ricevo un comando di lettura invio una risposta          
    #print 'Client closed:', addr
    s.close()


if __name__ == "__main__":

    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)     
    s.bind((host, port))
    s.listen(5)
    connection(s)
    
    


