require('dotenv').config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require('mongodb');
const twilio = require('twilio');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const PORT = 5002;
const PUBLIC_DIR = path.join(__dirname, "frontend");

// --- MongoDB Configuration (Uses .env) ---
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;
const COLLECTION_NAME = process.env.COLLECTION;
const client = new MongoClient(MONGO_URI);
let db;

// --- Twilio & Gemini Client Initialization (Uses .env) ---
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Advanced Alert State Management ---
const ALERT_THRESHOLD_F = 80.0;
const MAX_ALERTS = 5; // The maximum number of calls for a single event
const ALERT_COOLDOWN_MS = 60 * 1000; // 1 minute in milliseconds

let alertCallCount = 0;       // How many times we've called for the current event
let lastAlertTimestamp = 0;   // The timestamp of the last call

// Connect to MongoDB
async function connectToMongo() {
    try {
        await client.connect();
        db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);
        await collection.deleteMany({});
        console.log(`🧹 Database Cleanup Complete: Deleted old documents from '${COLLECTION_NAME}'.`);
        console.log("✅ Server Connected to MongoDB Atlas.");
    } catch (e) {
        console.error("❌ Failed to connect to MongoDB Atlas. Check network or URI:", e.message);
        process.exit(1);
    }
}
connectToMongo();

// --- Function to send alert using Gemini for voice content and Twilio for the call ---
async function sendAlertNotification(temperature, callCount) {
    console.log(`🔥 Unsafe temperature detected. Generating alert #${callCount} with Gemini...`);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Using 2.5 flash
        // Add the alert count to the prompt for better context
        const prompt = `Create a short, urgent voice alert. This is alert number ${callCount} of 5. The temperature inside a car is still at an unsafe level. The current temperature is ${temperature.toFixed(1)} degrees Fahrenheit. Start the message with 'This is an urgent safety alert.'`;

        const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
        const alertMessage = result.text; // Access the text directly

        console.log(`🤖 Gemini generated message: "${alertMessage}"`);
        console.log("📞 Placing call with Twilio...");

        // Twilio call setup
        await twilioClient.calls.create({
            twiml: `<Response><Say>${alertMessage}</Say></Response>`,
            to: process.env.RECIPIENT_PHONE_NUMBER,
            from: process.env.TWILIO_PHONE_NUMBER
        });

        console.log(`✅ Call #${callCount} initiated successfully.`);

    } catch (error) {
        console.error(`❌ Failed to send alert notification #${callCount}:`, error);
        // Note: We don't decrement the count on failure to prevent an endless loop of retries
    }
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml', // Added missing asset types
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    'default': 'application/octet-stream'
};

const getContentType = (filePath) => {
    const extname = path.extname(filePath).toLowerCase();
    return MIME_TYPES[extname] || MIME_TYPES.default;
};

const server = http.createServer(async (request, response) => {

    if (!db) {
         response.writeHead(503, { 'Content-Type': 'application/json' });
         return response.end(JSON.stringify({ error: "Database service unavailable." }));
    }

    // 1. --- API DATA ROUTE: /api/sensor-data (WRITE/POST from Pi) ---
    if (request.url === "/api/sensor-data" && request.method === 'POST') {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
        });
        request.on('end', async () => {
            try {
                const data = JSON.parse(body);
                console.log(`Received data from Pi: Temp=${data.temperature}°F`);

                const collection = db.collection(COLLECTION_NAME);
                await collection.insertOne(data);

                // --- Advanced Alert Trigger Logic ---
                if (data.temperature >= ALERT_THRESHOLD_F) {
                    const now = Date.now();
                    const timeSinceLastAlert = now - lastAlertTimestamp;

                    if (alertCallCount >= MAX_ALERTS) {
                        console.log(`[ALERT] Max alerts (${MAX_ALERTS}) already sent. Silencing further alerts for this event.`);
                    } else if (timeSinceLastAlert < ALERT_COOLDOWN_MS) {
                        const timeLeft = Math.round((ALERT_COOLDOWN_MS - timeSinceLastAlert) / 1000);
                        console.log(`[ALERT] In cooldown period. Not sending alert. Time left: ${timeLeft}s.`);
                    } else {
                        // Conditions met: Send the alert
                        console.log("[ALERT] Conditions met. Triggering alert.");
                        
                        // Increment count and update timestamp BEFORE making the call
                        alertCallCount++;
                        lastAlertTimestamp = now;

                        // Call the function (no need to await it, let it run in the background)
                        sendAlertNotification(data.temperature, alertCallCount);
                    }
                } else {
                    // Temperature is safe, reset the alert system if it was active
                    if (alertCallCount > 0) {
                        console.log("Temperature is back to a safe level. Resetting alert system.");
                        alertCallCount = 0;
                        lastAlertTimestamp = 0;
                    }
                }

                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ message: "Data received successfully." }));

            } catch (e) {
                console.error("Error processing sensor data:", e);
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'Internal Server Error processing data.' }));
            }
        });
        return;
    }

    // 2. --- API DATA ROUTE: /api/data (READ ONLY for Dashboard) ---
    if (request.url === "/api/data" && request.method === 'GET') {
        try {
            const collection = db.collection(COLLECTION_NAME);
            // Fetch the 50 most recent documents, sorted by timestamp descending
            const data = await collection.find({})
                                    .sort({ timestamp: -1 })
                                    .limit(50)
                                    .toArray();

            response.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            return response.end(JSON.stringify(data));
        } catch (e) {
            console.error("Error fetching data:", e);
            response.writeHead(500, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ error: 'Internal Server Error fetching data.' }));
        }
    }

    // 3. --- STATIC FILE ROUTES ---
    // Handle requests for index.html, CSS, JS, and all included images
    let requestedUrl = request.url === '/' ? '/index.html' : request.url;
    let filePath = path.join(PUBLIC_DIR, requestedUrl);
    let contentType = getContentType(filePath);

    // If the file is not found in /frontend, check the root directory for logos/assets
    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, requestedUrl);
        contentType = getContentType(filePath);
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                response.writeHead(404, { 'Content-Type': 'text/plain' });
                response.end("404 Not Found");
            } else {
                console.error(`File reading error: ${err.message}`);
                response.writeHead(500, { 'Content-Type': 'text/plain' });
                response.end("500 Internal Server Error");
            }
        } else {
            response.writeHead(200, { "Content-Type": contentType });
            response.end(data);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server dashboard available at: http://localhost:${PORT}`);
});
