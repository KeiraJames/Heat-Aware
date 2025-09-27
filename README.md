# Heat Aware 🚨🌡️
A Raspberry Pi–powered IoT system that calls a designated phone number when a car’s interior temperature becomes dangerously high—helping protect pets and children from heat-related emergencies.

---

## Overview
Heat Aware monitors a vehicle’s cabin temperature with a digital sensor connected to a Raspberry Pi.  
When the temperature exceeds a configurable threshold, the system:

- Places an automated phone call (and optional SMS) to the registered caregiver
- Logs the event and reading in MongoDB for analysis and history

---

## Features
- Real-time temperature sensing via Raspberry Pi GPIO  
- Automated phone-call alerts using the Twilio Voice API  
- Configurable temperature threshold and contact numbers  
- MongoDB logging for historical temperature and alert data  
- Remote configuration and updates

---

## Hardware
- Raspberry Pi 4 Model B (or other Pi with GPIO and internet)
- Digital temperature sensor (e.g., DS18B20 or DHT22)
- Breadboard & jumper wires
- Internet connection (Ethernet or Wi-Fi)

---

## Software Stack
- **Backend:** Node.js + Express  
- **Database:** MongoDB (Atlas or self-hosted)  
- **Sensor Interface:** `onoff` or `rpi-dht-sensor` Node packages  
- **Voice Calls:** Twilio Voice API

---

## Quick Start
1. **Set up Raspberry Pi OS** and enable SSH.
2. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/heat-aware.git
   cd heat-aware
