// ============================================
// Firebase Configuration
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyCJvnw4s_MM3kPCjdLjE606LhnkWO3ZgFw",
    authDomain: "hydronova-e2a65.firebaseapp.com",
    databaseURL: "https://hydronova-e2a65-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "hydronova-e2a65",
    storageBucket: "hydronova-e2a65.firebasestorage.app",
    messagingSenderId: "78075028045",
    appId: "1:78075028045:web:7279cdb5e4d254d00ff204"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ============================================
// State Management
// ============================================

let systemState = {
    pH: 6.4,
    pHStatus: "Good Condition",
    waterLevel: 85,
    waterStatus: "Normal",
    systemHealth: "Healthy",
    lastFirebaseUpdateReceived: null, // Track precise point database stream updated
    isConnected: false
};

let phChart = null;

// ============================================
// DOM Elements
// ============================================

const elements = {
    // Header
    currentDate: document.getElementById('currentDate'),
    currentTime: document.getElementById('currentTime'),
    systemStatus: document.getElementById('systemStatus'),
    statusIndicator: document.getElementById('statusIndicator'),

    // System Status Summary Card
    statusCard: document.getElementById('statusCard'),
    statusMessage: document.getElementById('statusMessage'),
    statusText: document.getElementById('statusText'),
    overallHealthStatus: document.getElementById('overallHealthStatus'),

    // pH Card
    phValue: document.getElementById('phValue'),
    phStatusBadge: document.getElementById('phStatusBadge'),
    phMessage: document.getElementById('phMessage'),
    phChart: document.getElementById('phChart'),

    // Water Card
    waterLevel: document.getElementById('waterLevel'),
    waterStatusBadge: document.getElementById('waterStatusBadge'),
    waterMessage: document.getElementById('waterMessage'),
    waterFill: document.getElementById('waterFill'),

    // Bottom Section
    lastUpdated: document.getElementById('lastUpdated')
};

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Execute immediately on loading
    updateRealtimeClock();
    setupFirebaseListeners();
    initializePhChart();
    
    // Smooth high-frequency execution for a real-time running clock ticker
    setInterval(updateRealtimeClock, 1000);
    
    // Heartbeat check every 10 seconds to compute if data is older than 1 hour
    setInterval(evaluateSystemHeartbeat, 10000);
});

// ============================================
// Real-time Clock Implementation
// ============================================

function updateRealtimeClock() {
    const now = new Date();
    
    // Format date beautifully
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    elements.currentDate.textContent = now.toLocaleDateString('en-US', options);
    
    // Track continuous real-time execution hours, minutes, and seconds
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // Handle structural structural '0' context mapping as 12
    
    elements.currentTime.textContent = `${hours}:${minutes}:${seconds} ${ampm}`;
}

// ============================================
// Firebase Ingestion Logic & Heartbeat Strategy
// ============================================

function setupFirebaseListeners() {
    database.ref('HydroNova/currentStatus').on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            systemState.pH = parseFloat(data.pH) || 6.4;
            systemState.pHStatus = data.pHStatus || "Good Condition";
            systemState.waterLevel = parseInt(data.waterLevel) || 85;
            systemState.waterStatus = data.waterStatus || "Normal";
            
            // Log exactly when this entry landed via the open data stream connection
            systemState.lastFirebaseUpdateReceived = new Date();
            
            // Initial sanity valuation check pass
            evaluateSystemHeartbeat();
            updateAllUI();
        }
    }, (error) => {
        console.error('Firebase connection channel failure:', error);
        setSystemOffline();
    });
}

function evaluateSystemHeartbeat() {
    if (!systemState.lastFirebaseUpdateReceived) {
        setSystemOffline();
        return;
    }

    const now = new Date();
    // Compute quantitative duration difference absolute millisecond length
    const latencyDurationMs = now - systemState.lastFirebaseUpdateReceived;
    const oneHourInMs = 60 * 60 * 1000; 

    if (latencyDurationMs > oneHourInMs) {
        // Data timestamp is older than an hour; ESP32 missed its structural windows 
        setSystemOffline();
    } else {
        systemState.isConnected = true;
        updateAllUI();
    }
}

function setSystemOffline() {
    systemState.isConnected = false;
    elements.systemStatus.textContent = 'Offline';
    elements.systemStatus.className = 'status-offline';
    elements.statusIndicator.style.backgroundColor = '#ff6b6b';
    elements.statusText.textContent = 'Hardware transmission missing. System is currently offline.';
    elements.overallHealthStatus.textContent = 'Unknown Status';
}

// ============================================
// UI Render Controls
// ============================================

function updateAllUI() {
    if (!systemState.isConnected) return; // Prevent updating UI with stale info if offline

    // Core Connectivity Top Element Visuals
    elements.systemStatus.textContent = 'Online';
    elements.systemStatus.className = 'status-online';
    elements.statusIndicator.style.backgroundColor = '#22c55e';

    // Sub-modules UI
    updatePhUI();
    updateWaterUI();
    updateSystemSummaryUI();
    updateTimestampLogOutput();
}

function updatePhUI() {
    elements.phValue.textContent = systemState.pH.toFixed(1);
    
    if (systemState.pHStatus === 'Too Acidic' || systemState.pHStatus === 'Too Alkaline') {
        elements.phStatusBadge.textContent = 'Alert';
        elements.phStatusBadge.className = 'status-badge alert';
        elements.phMessage.textContent = 'Nutrient solution pH bounds crossed! Adjust chemical balances immediately.';
    } else {
        elements.phStatusBadge.textContent = 'Normal';
        elements.phStatusBadge.className = 'status-badge';
        elements.phMessage.textContent = 'Nutrient solution pH is within the ideal range for healthy plant growth.';
    }
    
    if (phChart) {
        addPhDataToChart(systemState.pH);
    }
}

function updateWaterUI() {
    elements.waterLevel.textContent = systemState.waterLevel;
    elements.waterFill.style.height = systemState.waterLevel + '%';
    
    if (systemState.waterLevel < 30) {
        elements.waterStatusBadge.textContent = 'Alert';
        elements.waterStatusBadge.className = 'status-badge alert';
        elements.waterMessage.textContent = 'Critical Alert: Reservoir level is dangerously low. Refill required.';
    } else if (systemState.waterLevel > 85) {
        elements.waterStatusBadge.textContent = 'High';
        elements.waterStatusBadge.className = 'status-badge warning';
        elements.waterMessage.textContent = 'Water capacity warning: Level is high. Monitor closely.';
    } else {
        elements.waterStatusBadge.textContent = 'Normal';
        elements.waterStatusBadge.className = 'status-badge';
        elements.waterMessage.textContent = 'Water supply is adequate for continuous hydroponic circulation.';
    }
}

function updateSystemSummaryUI() {
    const hasPhAlert = systemState.pH < 5.5 || systemState.pH > 6.5;
    const hasWaterAlert = systemState.waterLevel < 30;

    if (hasPhAlert || hasWaterAlert) {
        systemState.systemHealth = "Action Required";
        elements.statusText.textContent = 'System requires critical attention. Check active card alerts below.';
        elements.overallHealthStatus.textContent = 'Warning';
    } else {
        systemState.systemHealth = "Healthy";
        elements.statusText.textContent = 'All parameters are operating normally within designated safe targets.';
        elements.overallHealthStatus.textContent = 'Healthy';
    }
}

function updateTimestampLogOutput() {
    if (systemState.lastFirebaseUpdateReceived) {
        const timeString = systemState.lastFirebaseUpdateReceived.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        elements.lastUpdated.textContent = timeString;
    }
}

// ============================================
// Chart.js Module Configuration
// ============================================

function initializePhChart() {
    const ctx = elements.phChart.getContext('2d');
    phChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'pH Level',
                data: [],
                borderColor: '#0099ff',
                backgroundColor: 'rgba(0, 153, 255, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 2,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 4, max: 8 },
                x: { grid: { display: false } }
            }
        }
    });
}
const backgrounds = [
    "assets/bg1.jpg",
    "assets/bg2.jpg",
    "assets/bg3.jpg",
    "assets/bg4.jpg"
];

const slideshow = document.getElementById("bg-slideshow");

let current = 0;

slideshow.style.backgroundImage =
    `url('${backgrounds[0]}')`;

setInterval(() => {

    slideshow.style.opacity = "0";

    setTimeout(() => {

        current =
            (current + 1) % backgrounds.length;

        slideshow.style.backgroundImage =
            `url('${backgrounds[current]}')`;

        slideshow.style.opacity = "1";

    }, 1000);

}, 8000);

function addPhDataToChart(phValue) {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (phChart.data.labels.length >= 10) {
        phChart.data.labels.shift();
        phChart.data.datasets[0].data.shift();
    }
    phChart.data.labels.push(timestamp);
    phChart.data.datasets[0].data.push(phValue);
    phChart.update('none'); // Update smoothly without visual animation stutter
}