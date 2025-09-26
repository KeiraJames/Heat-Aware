const { MongoClient } = require('mongodb');

// --- Configuration ---
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'myDatabase';
const COLLECTION_NAME = 'myCollection';
const client = new MongoClient(MONGO_URI);

const SIMULATION_INTERVAL_MS = 10000; // 10 seconds

let db;

/**
 * Connects to MongoDB and initializes the database handle.
 */
async function connectToMongo() {
    try {
        await client.connect();
        db = client.db(DB_NAME);
        console.log("✅ Simulator connected to MongoDB.");
        return db;
    } catch (e) {
        console.error("❌ Failed to connect to MongoDB. Check server status or URI.", e.message);
        process.exit(1); 
    }
}

/**
 * Generates a mock sensor reading.
 * Temperature will hover between 15°C and 35°C (to ensure some values are above 20 for your filter).
 */
function generateSensorData() {
    // Generate temperature between 15.0 and 35.0
    const temperature = (Math.random() * (35 - 15) + 15).toFixed(2);
    
    // Generate moisture between 200 and 900
    const moisture_value = Math.floor(Math.random() * (900 - 200) + 200);

    return {
        temperature: parseFloat(temperature),
        moisture_value: moisture_value,
        timestamp: Date.now() / 1000 // UNIX timestamp in seconds
    };
}

/**
 * Inserts the simulated sensor data into the MongoDB collection.
 */
async function sendSensorData() {
    if (!db) {
        console.error("Database connection not established. Skipping insertion.");
        return;
    }

    const data = generateSensorData();
    const collection = db.collection(COLLECTION_NAME);

    try {
        const result = await collection.insertOne(data);
        console.log(`[${new Date().toLocaleTimeString()}] Inserted: Temp=${data.temperature}°C, Moisture=${data.moisture_value}. ID: ${result.insertedId}`);
    } catch (e) {
        console.error("Error inserting data:", e.message);
    }
}

/**
 * Main function to start the simulation loop.
 */
async function startSimulation() {
    await connectToMongo();
    
    // Start the timer to execute sendSensorData() every 10 seconds
    console.log(`Starting sensor simulation. Inserting data every ${SIMULATION_INTERVAL_MS / 1000} seconds...`);
    
    // Run immediately once, then repeat every interval
    sendSensorData();
    setInterval(sendSensorData, SIMULATION_INTERVAL_MS);
}

startSimulation();