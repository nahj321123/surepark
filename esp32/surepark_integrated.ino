// ==============================================================
//  SurePark Baguio — Integrated ESP32 Firmware
//  =============================================
//  Your original hardware code is UNCHANGED below.
//  This file adds WiFi + HTTP on top of your existing logic.
//
//  BEFORE UPLOADING — fill in the 4 values in PART 1 below.
//  See SUREPARK_INTEGRATION_GUIDE.txt for full instructions.
// ==============================================================


// ==============================================================
//  PART 1 — CHANGE THESE 4 VALUES BEFORE UPLOADING
// ==============================================================
#define WIFI_SSID      "YOUR_WIFI_NAME"      // your WiFi network name
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"  // your WiFi password
#define SERVER_IP      "192.168.X.X"         // IP of PC running npm run dev
                                             // Windows: run ipconfig
                                             // Mac/Linux: run ifconfig
#define SLOT_ID        1                     // 1 to 5 — change per ESP32 board
// ==============================================================


// ==============================================================
//  PART 2 — YOUR EXISTING LIBRARIES + NEW ONES FOR WIFI/HTTP
// ==============================================================
#include <ESP32Servo.h>    // already in your original code
#include <WiFi.h>          // NEW — WiFi connection
#include <HTTPClient.h>    // NEW — send HTTP requests to web app
#include <ArduinoJson.h>   // NEW — parse JSON from web app responses
                           // Install via: Sketch → Manage Libraries
                           //              Search: ArduinoJson → Install


// ==============================================================
//  PART 3 — YOUR ORIGINAL PIN DEFINITIONS (unchanged)
// ==============================================================
const int trigPin    = 5;
const int echoPin    = 18;
const int buttonMain = 19;
const int buttonEnable = 21;
const int servoPin   = 23;
const int ledDetect  = 25;
const int ledNoDetect = 26;
const int ledEnable  = 27;

Servo myServo;


// ==============================================================
//  PART 4 — YOUR ORIGINAL SYSTEM STATES (unchanged)
// ==============================================================
bool systemEnabled    = true;
bool activated        = false;
bool at180            = false;
bool presenceDetected = false;

enum LedState {
  STATE_ENABLE,
  STATE_DETECT,
  STATE_NO_DETECT
};

LedState currentState = STATE_NO_DETECT;


// ==============================================================
//  PART 5 — YOUR ORIGINAL BUTTON TRACKING (unchanged)
// ==============================================================
bool lastMainState   = HIGH;
bool lastEnableState = HIGH;


// ==============================================================
//  PART 6 — YOUR ORIGINAL SENSOR VARIABLES (unchanged)
// ==============================================================
long duration;
int  distance;


// ==============================================================
//  PART 7 — NEW: HTTP TIMING VARIABLES
//  Controls how often the ESP32 talks to the web app server
// ==============================================================
unsigned long lastPollMs       = 0;   // tracks last bollard poll time
const unsigned long POLL_MS    = 2000; // poll server every 2 seconds

// Track what we last reported to the server to avoid duplicate POSTs
LedState lastReportedState = STATE_NO_DETECT;


// ==============================================================
//  NEW FUNCTION: connectWiFi()
//  Connects ESP32 to your WiFi network.
//  Called once in setup(). Blinks ledEnable while connecting.
// ==============================================================
void connectWiFi() {
  Serial.print("[WIFI] Connecting to: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int dots = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    dots++;

    // Blink the enable LED while waiting for WiFi
    digitalWrite(ledEnable, dots % 2 == 0 ? HIGH : LOW);

    if (dots > 40) {
      // After 20 seconds give up and continue without WiFi
      // Hardware will still work, just won't talk to the server
      Serial.println();
      Serial.println("[WIFI] Could not connect. Running in offline mode.");
      Serial.println("[WIFI] Check WIFI_SSID and WIFI_PASSWORD in the code.");
      digitalWrite(ledEnable, LOW);
      return;
    }
  }

  digitalWrite(ledEnable, LOW);
  Serial.println();
  Serial.print("[WIFI] Connected! ESP32 IP address: ");
  Serial.println(WiFi.localIP());
}


// ==============================================================
//  NEW FUNCTION: postSensorEvent(bool carPresent)
//  Tells the web app server that a car arrived or left.
//
//  Called when:
//    - STATE changes to STATE_DETECT    → carPresent = true
//    - STATE changes to STATE_NO_DETECT → carPresent = false
//
//  Sends: POST http://<SERVER_IP>:3000/api/sensor
//  Body:  { "slotId": 1, "carPresent": true }
// ==============================================================
void postSensorEvent(bool carPresent) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[SENSOR] WiFi not connected — skipping server update");
    return;
  }

  HTTPClient http;
  String url = String("http://") + SERVER_IP + ":3000/api/sensor";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000); // 5 second timeout

  // Build the JSON body manually (simple enough without ArduinoJson)
  String body = "{\"slotId\":";
  body += SLOT_ID;
  body += ",\"carPresent\":";
  body += carPresent ? "true" : "false";
  body += "}";

  Serial.print("[SENSOR] Sending to server: ");
  Serial.println(body);

  int httpCode = http.POST(body);
  http.end();

  if (httpCode == 200) {
    Serial.println("[SENSOR] Server acknowledged — slot status updated");
  } else if (httpCode == 403) {
    Serial.println("[SENSOR] HTTP 403 — slot not in correct state");
    Serial.println("          (slot must be Reserved+Paid for car detection to work)");
  } else if (httpCode == 404) {
    Serial.println("[SENSOR] HTTP 404 — slot ID not found, check SLOT_ID value");
  } else if (httpCode < 0) {
    Serial.print("[SENSOR] Connection failed — check SERVER_IP. Error: ");
    Serial.println(httpCode);
  } else {
    Serial.print("[SENSOR] Unexpected HTTP code: ");
    Serial.println(httpCode);
  }
}


// ==============================================================
//  NEW FUNCTION: pollBollardCommand()
//  Asks the server what position the bollard servo should be in.
//  The user controls this from the web app dashboard.
//
//  Calls: GET http://<SERVER_IP>:3000/api/bollard?slotId=1
//  Response: { "ok": true, "slotId": 1, "bollardUp": true/false }
//
//  bollardUp = true  → move servo to 180 degrees (raised/blocking)
//  bollardUp = false → move servo to 0 degrees   (lowered/open)
// ==============================================================
void pollBollardCommand() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String("http://") + SERVER_IP + ":3000/api/bollard?slotId=" + String(SLOT_ID);

  http.begin(url);
  http.setTimeout(5000);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();

    // Parse the JSON response: { "ok": true, "slotId": 1, "bollardUp": false }
    StaticJsonDocument<128> doc;
    DeserializationError err = deserializeJson(doc, payload);

    if (!err) {
      bool serverWantsBollardUp = doc["bollardUp"].as<bool>();

      // Only act if the server wants a different position than current
      int currentAngle = myServo.read();
      bool currentlyUp = (currentAngle > 90);

      if (serverWantsBollardUp && !currentlyUp) {
        Serial.println("[BOLLARD] Server command: RAISE (180 deg)");
        myServo.write(180);
        delay(300);

      } else if (!serverWantsBollardUp && currentlyUp) {
        Serial.println("[BOLLARD] Server command: LOWER (0 deg)");
        myServo.write(0);
        delay(300);
      }
      // If already in correct position, do nothing (no Serial spam)

    } else {
      Serial.println("[BOLLARD] Failed to parse server response");
    }

  } else if (httpCode == 403) {
    // Bollard locked — slot not paid yet, this is normal
    // Do not print anything to avoid Serial spam

  } else if (httpCode < 0) {
    Serial.print("[BOLLARD] Connection failed. Error: ");
    Serial.println(httpCode);
  }

  http.end();
}


// ==============================================================
//  YOUR ORIGINAL setup() — with WiFi connection added at top
// ==============================================================
void setup() {
  pinMode(trigPin,    OUTPUT);
  pinMode(echoPin,    INPUT);

  // Use internal pull-ups (same as your original code)
  pinMode(buttonMain,   INPUT_PULLUP);
  pinMode(buttonEnable, INPUT_PULLUP);

  pinMode(ledDetect,   OUTPUT);
  pinMode(ledNoDetect, OUTPUT);
  pinMode(ledEnable,   OUTPUT);

  myServo.attach(servoPin);
  myServo.write(0);

  Serial.begin(115200);
  delay(500);

  // ---- NEW: startup banner ----
  Serial.println();
  Serial.println("==========================================");
  Serial.println("  SurePark Baguio — Integrated Firmware");
  Serial.print  ("  Slot ID: ");
  Serial.println(SLOT_ID);
  Serial.println("==========================================");

  // ---- NEW: connect to WiFi ----
  connectWiFi();

  Serial.println("[SYSTEM] Ready. Waiting for enable button.");
  Serial.println();
}


// ==============================================================
//  YOUR ORIGINAL loop() — with HTTP calls added at the right places
//  All your original logic is here unchanged.
//  Search for "NEW:" comments to see exactly what was added.
// ==============================================================
void loop() {

  // ===== YOUR ORIGINAL: MASTER ENABLE BUTTON =====
  bool enableState = digitalRead(buttonEnable);

  if (lastEnableState == HIGH && enableState == LOW) {
    delay(200); // debounce (your original)

    if (currentState == STATE_NO_DETECT) {
      currentState = STATE_ENABLE;
      Serial.println("[STATE] -> STATE_ENABLE (enable button pressed)");
    }
  }
  lastEnableState = enableState;


  // ===== YOUR ORIGINAL: SENSOR READING =====
  if (activated && at180) {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    duration = pulseIn(echoPin, HIGH, 30000); // timeout (your original)
    distance = duration * 0.034 / 2;

    Serial.print("Distance: ");
    Serial.println(distance);
  }


  // ===== YOUR ORIGINAL: LED STATE MACHINE =====
  // NEW: postSensorEvent() is called when state changes
  switch (currentState) {

    case STATE_ENABLE:
      digitalWrite(ledEnable,   HIGH);
      digitalWrite(ledDetect,   LOW);
      digitalWrite(ledNoDetect, LOW);

      if (activated && distance > 0 && distance <= 20) {
        presenceDetected = true;
        currentState = STATE_DETECT;

        // NEW: Tell the web app a car was detected
        Serial.println("[STATE] -> STATE_DETECT (car detected)");
        postSensorEvent(true);
        lastReportedState = STATE_DETECT;
      }
      break;


    case STATE_DETECT:
      digitalWrite(ledEnable,   LOW);
      digitalWrite(ledDetect,   HIGH);
      digitalWrite(ledNoDetect, LOW);

      myServo.write(180); // your original

      if (distance > 20 && presenceDetected) {
        currentState = STATE_NO_DETECT;

        // NEW: Tell the web app the car has left
        Serial.println("[STATE] -> STATE_NO_DETECT (car left)");
        postSensorEvent(false);
        lastReportedState = STATE_NO_DETECT;
      }
      break;


    case STATE_NO_DETECT:
      digitalWrite(ledEnable,   LOW);
      digitalWrite(ledDetect,   LOW);
      digitalWrite(ledNoDetect, HIGH);

      myServo.write(0); // your original

      // Your original resets
      activated        = false;
      at180            = false;
      presenceDetected = false;
      break;
  }


  // ===== YOUR ORIGINAL: ACTIVATION BUTTON =====
  bool mainState = digitalRead(buttonMain);

  if (lastMainState == HIGH && mainState == LOW) {
    if (currentState == STATE_ENABLE) {
      activated        = true;
      at180            = true;
      presenceDetected = false;

      myServo.write(180);
      delay(300); // your original

      Serial.println("[STATE] Main button pressed — sensor scanning started");
    }
  }
  lastMainState = mainState;


  // ===== NEW: POLL SERVER FOR BOLLARD COMMAND EVERY 2 SECONDS =====
  // This checks if the user pressed Raise/Lower Bollard in the web app
  unsigned long now = millis();
  if (now - lastPollMs >= POLL_MS) {
    lastPollMs = now;
    pollBollardCommand();
  }


  // ===== NEW: RECONNECT WIFI IF IT DROPS =====
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Connection lost — reconnecting...");
    WiFi.reconnect();
    delay(1000);
  }


  delay(100); // your original
}
