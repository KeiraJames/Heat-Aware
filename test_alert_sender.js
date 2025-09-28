const http = require('http');

// Configuration must match the running server
const TARGET_HOST = 'localhost';
const TARGET_PORT = 5002;
const TARGET_PATH = '/api/sensor-data';
const ALERT_THRESHOLD = 80.0; 

// --- Test Data Payload ---
// Temperature is set well above the 80.0 F alert threshold to ensure the trigger fires.
const testData = {
    temperature: 85.5, 
    moisture_value: 450,
    timestamp: Date.now() / 1000 
};
const dataPayload = JSON.stringify(testData);

const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: TARGET_PATH,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataPayload),
    },
};

console.log(`Sending test data to ${TARGET_HOST}:${TARGET_PORT}${TARGET_PATH}...`);
console.log(`Payload: Temp=${testData.temperature}°F (Should trigger alert)`);

const req = http.request(options, (res) => {
    console.log(`\n--- Server Response ---`);
    console.log(`STATUS: ${res.statusCode}`);
    
    if (res.statusCode !== 200) {
        console.error("ALERT: The server did NOT return a 200 OK status.");
        console.error("Check the server console for errors (e.g., failed Twilio/Gemini call).");
    } else {
        console.log("SUCCESS: Data received by server. Check server console for Gemini/Twilio logs.");
    }

    res.setEncoding('utf8');
    let responseBody = '';
    res.on('data', (chunk) => {
        responseBody += chunk;
    });
    res.on('end', () => {
        console.log(`Body: ${responseBody}`);
        console.log(`--- End Response ---`);
    });
});

req.on('error', (e) => {
    console.error(`\n--- Request FAILED ---`);
    console.error(`Error connecting to Node server: ${e.message}`);
    console.error(`\nACTION REQUIRED: Ensure your 'server.js' is running on port ${TARGET_PORT}.`);
    console.error(`--- End Failure ---`);
});

// Write the data to the request body and end the request
req.write(dataPayload);
req.end();
