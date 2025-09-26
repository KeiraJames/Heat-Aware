const http = require("http")
const fs = require("fs")
const path = require("path")
const { MongoClient } = require('mongodb'); // 👈 Import MongoDB Driver

const PORT = 5003;
const PUBLIC_DIR = path.join(__dirname, "frontend"); 

// --- MongoDB Configuration ---
const MONGO_URI = 'mongodb://localhost:27017'; // Update as needed
const DB_NAME = 'myDatabase'; // Your database name
const COLLECTION_NAME = 'myCollection'; // Your collection name
const client = new MongoClient(MONGO_URI);
let db;

// Connect to MongoDB once when the server starts
async function connectToMongo() {
    try {
        await client.connect();
        db = client.db(DB_NAME);
        console.log("✅ Connected to MongoDB");
    } catch (e) {
        console.error("❌ Failed to connect to MongoDB. Check URI or status:", e.message);
        process.exit(1); 
    }
}
connectToMongo();
// -----------------------------

const server = http.createServer(async (request, response) => { // 👈 Make callback async

    // 1. --- API DATA ROUTE ---
    if (request.url === "/api/data" && request.method === 'GET') {
        if (!db) {
             response.writeHead(503, { 'Content-Type': 'application/json' });
             return response.end(JSON.stringify({ error: "Database not ready." }));
        }
        try {
            const collection = db.collection(COLLECTION_NAME);
            // Fetch all documents
            const data = await collection.find({}).toArray();

            response.writeHead(200, { 
                'Content-Type': 'application/json',
                // This is needed so app.js can fetch from this route
                'Access-Control-Allow-Origin': '*' 
            });
            return response.end(JSON.stringify(data)); // Send the data as JSON

        } catch (e) {
            console.error("Error fetching data:", e);
            response.writeHead(500, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ error: 'Internal Server Error fetching data.' }));
        }
    }


    // 2. --- STATIC FILE ROUTES ---
    let contentType;
    let filePath;

    if (request.url === "/" || request.url === "/index.html") {
        filePath = path.join(PUBLIC_DIR, "index.html");
        contentType = "text/html";
    } else if (request.url === "/style.css") {
        filePath = path.join(PUBLIC_DIR, "style.css");
        contentType = "text/css";
    } else if (request.url === "/app.js") { // 👈 Add your client-side script
        filePath = path.join(PUBLIC_DIR, "app.js");
        contentType = "text/javascript";
    } else {
        // Handle unmatched routes (404 Not Found)
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        return response.end("404 Not Found");
    }

    // Read and send the determined file
    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error(`Error reading ${filePath}: ${err.message}`);
            response.writeHead(500, { 'Content-Type': 'text/plain' });
            response.end("500 Server Error");
        } else {
            response.writeHead(200, { "Content-Type": contentType });
            response.end(data);
        }
    });
});

server.listen(PORT, () =>
    console.log(`Listening here: http://localhost:${PORT}`)
);