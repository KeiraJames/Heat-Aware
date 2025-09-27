const http = require("http");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require('mongodb'); 

const PORT = 5002;
const PUBLIC_DIR = path.join(__dirname, "frontend"); 

// --- MongoDB Configuration (Atlas Cloud) ---
// Note: Node server uses the long Atlas URI for cloud connection
const client = new MongoClient(MONGO_URI);
let db;

// Connect to MongoDB once when the server script runs
async function connectToMongo() {
    try {
        await client.connect();
        db = client.db(DB_NAME);
        
        // 🎯 NEW LOGIC: CLEAR DATABASE ON STARTUP
        const collection = db.collection(COLLECTION_NAME);
        const deleteResult = await collection.deleteMany({});
        console.log(`🧹 Database Cleanup Complete: Deleted ${deleteResult.deletedCount} old documents from '${COLLECTION_NAME}'.`);

        console.log("✅ Server Connected to MongoDB Atlas.");
    } catch (e) {
        console.error("❌ Failed to connect to MongoDB Atlas. Check network or URI:", e.message);
        process.exit(1); 
    }
}
connectToMongo();

// --- MIME Type Lookup Map ---
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    'default': 'application/octet-stream' 
};

const getContentType = (filePath) => {
    const extname = path.extname(filePath).toLowerCase();
    return MIME_TYPES[extname] || MIME_TYPES.default;
};

// --- HTTP Server Creation ---
const server = http.createServer(async (request, response) => { 
    
    // Ensure DB is ready before handling data requests
    if (!db) {
         response.writeHead(503, { 'Content-Type': 'application/json' });
         return response.end(JSON.stringify({ error: "Database service unavailable." }));
    }

    // 1. --- API READ ROUTE: /api/data ---
    if (request.url === "/api/data" && request.method === 'GET') {
        try {
            const collection = db.collection(COLLECTION_NAME);
            
            // Fetch the latest 50 documents, sorted by timestamp descending
            const data = await collection.find({})
                // Sorting should ideally happen in memory if indexes aren't available/used
                .sort({ timestamp: -1 }) 
                .limit(50)
                .toArray();

            response.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' 
            });
            return response.end(JSON.stringify(data)); 

        } catch (e) {
            console.error("Error fetching data:", e);
            response.writeHead(500, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ error: 'Internal Server Error fetching data.' }));
        }
    }

    // 2. --- API CLEAR ROUTE: /api/clear ---
    if (request.url === "/api/clear" && request.method === 'POST') {
        try {
            const collection = db.collection(COLLECTION_NAME);
            const result = await collection.deleteMany({});
            
            console.log(`🧹 Manual Clear Request: Deleted ${result.deletedCount} documents.`);

            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ 
                message: "Database cleared successfully.", 
                deletedCount: result.deletedCount 
            }));
        } catch (e) {
            console.error("Error clearing database:", e);
            response.writeHead(500, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ error: 'Failed to clear database.' }));
        }
    }

    // 3. --- STATIC FILE ROUTES ---
    const requestedUrl = request.url === '/' ? '/index.html' : request.url;
    const filePath = path.join(PUBLIC_DIR, requestedUrl);
    const contentType = getContentType(filePath);

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
