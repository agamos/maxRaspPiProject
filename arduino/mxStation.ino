#include <XBee.h>

// Arduino Wire library is required if I2Cdev I2CDEV_ARDUINO_WIRE implementation
// is used in I2Cdev.h
#include "Wire.h"

// I2Cdev and MPU6050 must be installed as libraries, or else the .cpp/.h files
// for both classes must be in the include path of your project
#include "I2Cdev.h"
#include "MPU6050_6Axis_MotionApps20.h"

// Initialise MPU6050
MPU6050 mpu;

// Initialise XBee
XBee xbee = XBee();
XBeeAddress64 addr64 = XBeeAddress64(0x0013a200, 0x40945dfc);

// Define threshold for fall sensor
#define FALL 1500

//Temp sensor vars
int sensorPin = 1; //the analog pin the TMP36's Vout (sense) pin is connected to
                        //the resolution is 10 mV / degree centigrade with a
                        //500 mV offset to allow for negative temperatures
unsigned long tempTime = 0;  // timer to read temperature on regular interval

//Touch sensor vars
int TouchSensor = 4; //connected to Digital pin D3

//LED indicator vars
int LED_PIN = 13;
bool blinkState = false;

// MPU control/status vars
bool dmpReady = false;  // set true if DMP init was successful
uint8_t mpuIntStatus;   // holds actual interrupt status byte from MPU
uint8_t devStatus;      // return status after each device operation (0 = success, !0 = error)
uint16_t packetSize;    // expected DMP packet size (default is 42 bytes)
uint16_t fifoCount;     // count of all bytes currently in FIFO
uint8_t fifoBuffer[64]; // FIFO storage buffer

// orientation/motion vars
Quaternion q;           // [w, x, y, z]         quaternion container
VectorInt16 aa;         // [x, y, z]            accel sensor measurements
VectorInt16 aaReal;     // [x, y, z]            gravity-free accel sensor measurements
VectorInt16 aaWorld;    // [x, y, z]            world-frame accel sensor measurements
VectorFloat gravity;    // [x, y, z]            gravity vector
float euler[3];         // [psi, theta, phi]    Euler angle container
float ypr[3];           // [yaw, pitch, roll]   yaw/pitch/roll container and gravity vector


// ================================================================
// ===               INTERRUPT DETECTION ROUTINE                ===
// ================================================================

volatile bool mpuInterrupt = false;     // indicates whether MPU interrupt pin has gone high
void dmpDataReady() {
    mpuInterrupt = true;
}
/*
 * setup() - this function runs once when you turn your Arduino on
 * We initialize the serial connection with the computer
 */
void setup()
{
  Wire.begin();

  pinMode(LED_PIN, OUTPUT);
  pinMode(TouchSensor, INPUT); 

  digitalWrite(LED_PIN, HIGH);

  Serial.begin(9600);
  xbee.setSerial(Serial);


  devStatus = mpu.dmpInitialize();
   // make sure it worked (returns 0 if so)
  if (devStatus == 0) {
        mpu.setDMPEnabled(true);
        // enable Arduino interrupt detection
        attachInterrupt(1, dmpDataReady, RISING);
        mpuIntStatus = mpu.getIntStatus();
        dmpReady = true;
        // get expected DMP packet size for later comparison
        packetSize = mpu.dmpGetFIFOPacketSize();
        digitalWrite(LED_PIN, LOW);
  }
}
 
// ================================================================
// ===               THREAD TIMER ROUTING                       ===
// ================================================================


bool isReady(unsigned long *tickTime, int waitTime) {
  unsigned long currentMillis = millis();
  if(*tickTime > currentMillis) {
    return false;
  }
  *tickTime = currentMillis + waitTime;
  return true;
}

// ================================================================
// ===               GENERIC SEND TO XBEE                       ===
// ================================================================

void sendXbee(uint8_t payload[], int length) {
   ZBTxRequest zbTx = ZBTxRequest(addr64, payload, sizeof(uint8_t)*length);
   xbee.send(zbTx);
}

// ================================================================
// ===               PROCESS MPU ON INTERRUPT                   ===
// ================================================================


void processMpu() {
   if (!dmpReady) return;

    // reset interrupt flag and get INT_STATUS byte
    mpuInterrupt = false;
    mpuIntStatus = mpu.getIntStatus();

    // get current FIFO count
    fifoCount = mpu.getFIFOCount();

    // check for overflow (this should never happen unless our code is too inefficient)
    if ((mpuIntStatus & 0x10) || fifoCount == 1024) {
        // reset so we can continue cleanly
        mpu.resetFIFO();
//        Serial.println(F("FIFO overflow!"));

    // otherwise, check for DMP data ready interrupt (this should happen frequently)
    } else if (mpuIntStatus & 0x01) {
        // wait for correct available data length, should be a VERY short wait
        while (fifoCount < packetSize) fifoCount = mpu.getFIFOCount();

        // read a packet from FIFO
        mpu.getFIFOBytes(fifoBuffer, packetSize);
        
        // track FIFO count here in case there is > 1 packet available
        // (this lets us immediately read more without waiting for an interrupt)
        fifoCount -= packetSize;

        // display real acceleration, adjusted to remove gravity
            mpu.dmpGetQuaternion(&q, fifoBuffer);
            mpu.dmpGetAccel(&aa, fifoBuffer);
            mpu.dmpGetGravity(&gravity, &q);
            mpu.dmpGetLinearAccel(&aaReal, &aa, &gravity);
       if(aaReal.y>FALL||aaReal.y<-FALL) {
          uint8_t msg[1] = {'F'};
          sendXbee(msg, 1);
       }
    }
}

// ================================================================
// ===               READ TOUCH SENSOR                          ===
// ================================================================


void readTouch() {
   if(digitalRead(TouchSensor)==HIGH)       //Read Touch sensor signal
   { 
    uint8_t msg[1] = {'B'};
    sendXbee(msg, 1);
   }
}

// ================================================================
// ===               READ TEMP SENSOR                           ===
// ================================================================

void readTemp() {
  // Only read once every 10 minutes
  if(!isReady(&tempTime, 10000))
    return;

  // read data from pin
  int reading = analogRead(sensorPin);  
 
  // converting that reading to voltage, for 3.3v arduino use 3.3
  float voltage = reading * 3.3;
  voltage /= 1024.0; 
 
 
  // now calulate the temperature in Centigrade
  float temperatureC = (voltage - 0.5) * 100 ;  //converting from 10 mv per degree wit 500 mV offset
                                               //to degrees ((voltage - 500mV) times 100)
  uint8_t decimalTemp = round(temperatureC);
  float tempTemp = temperatureC - decimalTemp;
  tempTemp *= 10;
  uint8_t floatingTemp = round(tempTemp);

  uint8_t payload[3];
  payload[0] = 'T';
  payload[1] = decimalTemp;
  payload[2] = floatingTemp;
  sendXbee(payload, 3);
}

void loop()                     // run over and over again
{
  // Read sensors until an interrupt occurs
  while(!mpuInterrupt) {
     readTouch();
     readTemp();
      // blink LED to indicate activity
     blinkState = !blinkState;
     digitalWrite(LED_PIN, blinkState);
  }
  
  // Process the interrupt
  processMpu();
}


