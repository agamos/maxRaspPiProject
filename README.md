Introduction
The MxStation (fall sensor) is a monitoring system for carers of the elderly or in-firmed especially addressing the risk of an unattended fall.  The solution is based upon a central Raspberry Pi which is monitoring a remote sensor worn around the neck of the monitored person.  Consideration has been taken that the people are anticipated to be further away from each other than normal visual or audible monitoring could be achieved.

Use Case
Two real life use cases were the inspiration of this solution.
1. My late Grandmother was in a nursing home and prone to falls, the care home had no monitoring solution and trusted carers to regularly monitor all the residents. Unfortunately, she fell on a few occasions in her room and lay waiting for help for quite some time, which was both painful and undignified.
2. More recently an OAP friend with knee problems, fell asleep in his dining room chair, toppled over and dislocated his hip. It took over an hour for help to arrive.
Both of these cases made me think how I might be able to provide a solution utilising modern technology.

Prototype
Monitoring station
The monitoring station was to be suitable for a desktop or shelf.  Ease of use was very important. 
Node.js was used to develop a light user interface and web server.  Node.js scales well and is extremely reliable.  As the user interface was designed to run in a browser, its made sense to use Javascript for the back end services too.  The main server runs as a web server, Xbee listener and webSocket emitter.
Communication using 433MHz trancievers was initially attempted only to find that the range indoors was too low.  XBee trancievers have a much better range and have been set up as a mesh network allowing nodes to be added to extend the range easily.  The pendant XBee has been setup as a Router node allowing it to both transmit packets from itself and also route packets to other nodes.

Remote pendant
The pendant was originally planned to be built using surface mounted components around an Atmel processor.  I have not had any experience with SMD components and decided it to be a risk to attempt that for the prototype.  An Arduino Fio was chosen as it already has the XBee connector built in.  An early design used a simple accelerometer for the motion detection but it was found to be unsuitable for the purpose as their were too many false-positives.  The 9DoF board is far more accurate and more reliable.  I have also designed a case for the existing Fio based pendant which can be found on github with my source code.

Future considerations
- reduce the size of the pendant and believe with SMDs this will be achievable.
- use the Asterix raspberry pi image to include dial-up capabilities to the monitoring station, allowing a carer or emergency services to be called after an alarm has been ringing for a predefined time
