import time
from pymongo import MongoClient
import board
from adafruit_seesaw.seesaw import Seesaw
import os

# --- Configuration ---
# Pi connects DIRECTLY to the MongoDB Atlas Cloud Cluster.
MONGO_URI = os.environ.get('MONGO_URI')
DB_NAME = os.environ.get('DB_NAME')
COLLECTION_NAME = os.environ.get('COLLECTION_NAME')

ALERT_THRESHOLD_F = 80.0 # 🎯 THRESHOLD: 80.0 degrees Fahrenheit
SIMULATION_INTERVAL_SEC = 10

# --- MongoDB Client Setup ---
try:
    client = MongoClient(MONGO_URI)
    client.admin.command('ping')
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    print(f"✅ Pi connected to MongoDB ATLAS: {DB_NAME}.{COLLECTION_NAME}")
    MONGO_READY = True
except Exception as e:
    print(f"❌ MongoDB Connection Error: {e}")
    print("   Check network connectivity and ensure the Pi's IP is whitelisted in Atlas.")
    MONGO_READY = False
    collection = None # Ensure collection variable is defined even on failure

# Initialize I2C connection
try:
    i2c_bus = board.I2C()
    ss = Seesaw(i2c_bus, addr=0x36)
    print("✅ Seesaw sensor initialized via I2C.")
    SENSOR_READY = True
except Exception as e:
    print(f"❌ I2C Initialization Error: {e}. Using mock data.")
    SENSOR_READY = False

def convert_c_to_f(celsius):
   
    return (celsius * 9/5) + 32

def send_alert(temperature_f):
    """Logs the critical alert using the Fahrenheit value."""
    print("*******************************************")
    print(f"🚨 CRITICAL ALERT: TEMPERATURE IS {temperature_f:.2f}°F")
    print("   Action: Logged alert locally (80°F threshold exceeded).")
    print("*******************************************")

def save_data(temperature_f, moisture_value):
    """Inserts data into the MongoDB Atlas collection, storing Fahrenheit."""

    if not MONGO_READY or collection is None:
        # Prevent crash if MongoDB connection failed
        print("🔴 Skipping MongoDB write: Client is not connected.")
        return

    data = {
        "temperature": temperature_f, # 🎯 CHANGED: Storing Fahrenheit here
        "moisture_value": moisture_value,
        "timestamp": time.time() * 1000 # Save as milliseconds
    }

    try:
        collection.insert_one(data)
    except Exception as e:
        print(f"❌ MongoDB Insertion Error: {e}")

# Main loop to read data and save it every 10 seconds
while True:
    if SENSOR_READY:
        moisture_value = ss.moisture_read()
        temperature_c = ss.get_temp() # Sensor returns Celsius

    # 1. Convert to Fahrenheit
    temperature_f = convert_c_to_f(temperature_c)

    # 2. Save the Fahrenheit data
    save_data(temperature_f-10, moisture_value)

    # 3. Check for alert condition
    if temperature_f >= ALERT_THRESHOLD_F:
        send_alert(temperature_f)

    # 4. Print status
    print(f"Temp: {temperature_f:.2f}°F | Moisture: {moisture_value}")

    time.sleep(SIMULATION_INTERVAL_SEC)






