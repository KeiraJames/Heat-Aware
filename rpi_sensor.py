import time
import sys
from datetime import datetime
from pymongo import MongoClient
import board # Library for accessing GPIO/I2C
from adafruit_seesaw.seesaw import Seesaw # Adafruit Seesaw sensor library

# --- Configuration ---
# Updated to connect to a local MongoDB instance running on the default port.
# If MongoDB is running on a different machine than the Pi, replace 'localhost' with that machine's IP.
MONGO_URI = 'mongodb://localhost:27017' 
DB_NAME = 'myDatabase'
COLLECTION_NAME = 'myCollection'
ALERT_THRESHOLD_C = 26.67 # 80°F converted to Celsius 
INTERVAL_SECONDS = 10 # 10-second loop interval

# --- Sensor Setup (Using I2C Bus) ---
try:
    i2c_bus = board.I2C()  # Uses board.SCL and board.SDA
    # Initialize Seesaw sensor at address 0x36
    ss = Seesaw(i2c_bus, addr=0x36)
except Exception as e:
    print(f"❌ Failed to initialize I2C sensor: {e}")
    # Exiting if the sensor cannot be found or initialized
    sys.exit(1)

# --- Database Connection ---
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    # Check connection health
    client.admin.command('ismaster') 
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    # Changed confirmation message to reflect local connection
    print(f"✅ Connected to local MongoDB at {MONGO_URI}.")
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")
    sys.exit(1)


def read_sensor_data():
    """
    Reads actual temperature and moisture from the Adafruit Seesaw sensor.
    """
    try:
        # Read moisture and temperature using the configured Seesaw object
        moisture_value = ss.moisture_read()
        temperature_c = ss.get_temp() 
        
        # Basic check for invalid reads (sensor issues)
        if temperature_c is None or moisture_value is None:
            raise Exception("Sensor returned None value. Read may have failed.")
        
        return round(temperature_c, 2), moisture_value

    except Exception as e:
        print(f"Error reading sensor: {e}. Check wiring and I2C connection.")
        return None, None


def send_data_and_alert():
    """Gathers data, checks alert condition, and inserts into MongoDB."""
    
    temperature, moisture = read_sensor_data()

    if temperature is None or moisture is None:
        return # Skip insertion if sensor read failed

    data = {
        'temperature': temperature,
        'moisture_value': moisture,
        'timestamp': datetime.now().timestamp() * 1000 # Store as milliseconds epoch
    }

    try:
        # Insert data into MongoDB
        collection.insert_one(data)
        
        status_message = f"[{datetime.now().strftime('%H:%M:%S')}] Inserted: Temp={temperature}°C, Moisture={moisture}"

        # 🎯 CRITICAL ALERT CHECK (80°F or 26.67°C)
        if temperature >= ALERT_THRESHOLD_C:
            status_message += " -> 🔥 CRITICAL DANGER! TRIGGERING PHONE CALL."
            # **Integration point:** This is where you add your Twilio/phone service API call.
            
        else:
            status_message += " (Safe)"
            
        print(status_message)
        
    except Exception as e:
        print(f"Error inserting into MongoDB: {e}")


def main():
    """Main loop to continuously gather and send data."""
    print(f"Starting sensor monitoring. Sending data every {INTERVAL_SECONDS} seconds...")
    print(f"Alert set at: {ALERT_THRESHOLD_C}°C (80°F)")
    
    while True:
        send_data_and_alert()
        time.sleep(INTERVAL_SECONDS)

if __name__ == '__main__':
    main()
