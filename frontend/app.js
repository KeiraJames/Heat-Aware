// --- Configuration & Constants ---
const REFRESH_INTERVAL_MS = 5000; // 5 seconds
const ALERT_THRESHOLD_F = 80.0;
const API_URL = '/api/data';

// --- Global Data Store ---
let temperatureHistory = [];
let activeStream = null; // Used for webcam/stream management

// --- Utility Functions ---

/**
 * Logs an event to the dashboard events list.
 * NOTE: This relies on the #events element being present in the DOM.
 * @param {string} message 
 * @param {string} type 'safe', 'caution', or 'danger'
 */
function logEvent(message, type = 'info') {
    const eventsList = document.getElementById('events');
    if (!eventsList) return;
    const item = document.createElement('li');
    item.className = `event-item event-${type}`;
    item.innerHTML = `
        <i class="dot ${type}"></i>
        <span class="message">${message}</span>
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
    `;
    eventsList.prepend(item);
}

/**
 * Fetches the latest sensor data from the Node API.
 */
async function fetchSensorData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`HTTP Status ${response.status}`);
        }
        const data = await response.json();
        
        if (!data || data.length === 0) {
            logEvent('No data received from cloud.', 'info');
            return null;
        }

        // We use the last 50 readings for the sparkline chart
        temperatureHistory = data.slice(0, 50).reverse(); 

        return {
            latest: temperatureHistory.at(-1),
            history: temperatureHistory.map(d => d.temperature),
            moisture: temperatureHistory.map(d => d.moisture_value),
        };

    } catch (error) {
        // Log network or server-side failure
        console.error('API Fetch Error:', error);
        if (location.hash === '#/dashboard') {
            logEvent(`Failed to connect to API: ${error.message}`, 'danger');
        }
        return null;
    }
}


// --- NEW INTEGRATED SPA AND UTILITY CODE START ---

// Simple SPA router using hash
const routes = ['#/', '#/login', '#/dashboard']
function showRoute(){
    const h = location.hash || '#/'
    document.querySelectorAll('.route').forEach(el => el.classList.add('hidden'))
    const active = routes.includes(h) ? h : '#/'
    const el = document.querySelector(`[data-route="${active}"]`)
    if (el) el.classList.remove('hidden')

    // Optional: Log when the user views the dashboard
    if (active === '#/dashboard') {
        logEvent('Dashboard loaded.', 'info');
    }
}

// Parallax
function setupParallax(){
    const hero = document.getElementById('hero')
    const onScroll = () => {
        document.querySelectorAll('[data-speed]').forEach(el => {
            const speed = parseFloat(el.getAttribute('data-speed') || '0')
            el.style.transform = `translate3d(0, ${window.scrollY * speed}px, 0)`
        })
        if (hero){
            const rect = hero.getBoundingClientRect()
            const vp = window.innerHeight
            const progress = Math.max(0, Math.min(1, 1 - rect.top / vp))
            hero.style.setProperty('--heroShift', `${-90 * progress}px`)
        }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive:true })
}

// Login (no backend)
function setupLogin(){
    const form = document.getElementById('loginForm')
    if (!form) return
    form.addEventListener('submit', (e) => {
        e.preventDefault()
        location.hash = '#/dashboard'
    })
}

// Temperature card with sparkline (NOW USING LIVE DATA)
function setupTempCard(){
    const svg = document.getElementById('spark');
    const tempValue = document.getElementById('tempValue');
    const dataElement = document.getElementById('data'); // 👈 Fetch element with ID 'data'
    if (!svg || !tempValue) return

    function getVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim() }

    // Function to draw the sparkline based on fetched data
    function drawSparkline(series) {
        if (series.length < 2) {
             svg.innerHTML = '';
             tempValue.textContent = series.at(-1) ? `${series.at(-1).toFixed(1)}°F` : '--°F';
             return;
        }

        const w=200,h=60;
        const max=Math.max(...series, ALERT_THRESHOLD_F + 5); 
        const min=Math.min(...series, ALERT_THRESHOLD_F - 10);
        
        // Map data points to SVG coordinates
        const pts = series.map((v,i)=>[ 
            i*(w/(series.length-1)), 
            h - ((v-min)/(max-min||1))*h 
        ]);
        
        const d = 'M'+pts.map(p=>p.join(',')).join(' L ');
        const area = `M0,${h} ` + pts.map(p=>p.join(',')).join(' L ') + ` L${w},${h} Z`;
        const last = series.at(-1);
        
        // Determine color based on ALERT_THRESHOLD_F (80°F)
        const dangerThreshold = ALERT_THRESHOLD_F;
        const cautionThreshold = ALERT_THRESHOLD_F - 5; // 75°F

        let colorName = '--safe';
        if (last >= dangerThreshold) {
            colorName = '--danger';
        } else if (last >= cautionThreshold) {
            colorName = '--caution';
        }
        const color = getVar(colorName);
        
        // Render SVG paths
        svg.innerHTML = `
            <path d="${area}" fill="${color}33"></path>
            <path d="${d}" fill="none" stroke="${color}" stroke-width="2"></path>
        `;
        
        // Update the main temperature display
        tempValue.textContent = `${last.toFixed(1)}°F`;
        tempValue.className = `temp-value ${colorName.replace('--', '')}`;
    }

    // Function to fetch data and update UI (runs repeatedly)
    async function updateTempCard() {
        const data = await fetchSensorData();
        if (data && data.history.length > 0) {
            // Use the actual historical temperature data for the sparkline
            drawSparkline(data.history);

             // Log event for the latest reading 
            const latestTempF = data.latest.temperature;
            let status = 'safe';
            let message = `Latest reading: ${latestTempF.toFixed(2)}°F.`;
            
            if (latestTempF >= ALERT_THRESHOLD_F) {
                status = 'danger';
                message = `🚨 DANGER: HEAT ALERT! Temperature is ${latestTempF.toFixed(2)}°F.`;
            } else if (latestTempF >= (ALERT_THRESHOLD_F - 5)) {
                status = 'caution';
                message = `CAUTION: Temperature rising (${latestTempF.toFixed(2)}°F).`;
            }

            logEvent(message, status);
            
            // 👈 UPDATED: Insert only the temperature value into the #data element
            if (dataElement) {
                // Display only the temperature, formatted to two decimal places
                dataElement.textContent = latestTempF.toFixed(2);
            }

        } else {
             tempValue.textContent = '--°F';
             logEvent('Waiting for first data transmission...', 'info');
             if (dataElement) {
                 dataElement.textContent = 'Awaiting initial data point...';
             }
        }
    }

    // Start the continuous data fetch loop using the constant interval
    updateTempCard(); // First run immediately
    setInterval(updateTempCard, REFRESH_INTERVAL_MS);
}

// Video feed (webcam or URL)
function setupVideo(){
    const video = document.getElementById('video')
    const startCam = document.getElementById('startCam')
    const stopCam = document.getElementById('stopCam')
    const streamUrl = document.getElementById('streamUrl')
    const loadUrl = document.getElementById('loadUrl')
    const err = document.getElementById('vidError')
    if (!video) return

    // Helper to stop any active stream
    function stopActiveStream() {
        if (activeStream) { 
            activeStream.getTracks().forEach(t=>t.stop()); 
            activeStream = null 
        }
        if (video) video.srcObject = null
    }

    startCam?.addEventListener('click', async () => {
        err.textContent = ''
        stopActiveStream() // Stop existing streams
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:false })
            activeStream = stream
            video.srcObject = stream
            await video.play()
            logEvent('Local camera started.', 'success');
        } catch (e){
            err.textContent = 'Camera access failed. Check permissions.'
            logEvent('Camera access failed.', 'danger');
        }
    })
    stopCam?.addEventListener('click', stopActiveStream)

    loadUrl?.addEventListener('click', () => {
        if (!streamUrl.value) return
        stopActiveStream()
        video.removeAttribute('srcObject')
        video.src = streamUrl.value
        video.play().catch(()=> err.textContent = 'Could not autoplay URL stream. Click play.')
        logEvent(`Loading stream URL: ${streamUrl.value}`, 'info');
    })
}

// --- INITIALIZATION ---

window.addEventListener('hashchange', showRoute);
window.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Router & Utilities
    showRoute();
    setupParallax();

    // 2. Setup Dashboard Features
    setupLogin();
    setupVideo();
    
    // 3. Setup and start the continuous data fetching loop (includes chart)
    setupTempCard(); 

    // Footer Year
    document.getElementById('year').textContent = new Date().getFullYear();
});
