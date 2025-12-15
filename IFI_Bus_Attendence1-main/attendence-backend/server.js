const express = require('express');
const cors = require('cors');
const dbOperation = require('./dboperation');
const API_PORT = 5000;
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// ✅ ADD THIS: GET endpoint for browser testing
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>Attendance API</title></head>
            <body>
                <h1>✅ Attendance API Server is Running!</h1>
                <p>Port: ${API_PORT}</p>
                <p>Time: ${new Date().toLocaleString()}</p>
                <p>Endpoints:</p>
                <ul>
                    <li>POST /api/scan - Submit a scan</li>
                    <li>GET /health - Health check</li>
                </ul>
            </body>
        </html>
    `);
});

// ✅ ADD THIS: Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        serverTime: new Date().toISOString(),
        port: API_PORT
    });
});

// POST /api/scan - receive scan from app
app.post('/api/scan', async (req, res) => {
    const { employeeId, scanDateTime, scanType, deviceInfo } = req.body;
    
    // Basic validation
    if (!employeeId || !scanDateTime || !scanType) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields',
        });
    }

    try {
        await dbOperation.insertScan(
            employeeId.trim(),
            scanDateTime,
            scanType,
            deviceInfo || 'Unknown'
        );
        
        return res.json({
            success: true,
            message: 'Scan recorded successfully',
        });
        
    } catch (error) {
        console.error('Error:', error);
        
        // Handle duplicate scan
        if (error.code === 'DUPLICATE') {
            return res.status(409).json({
                success: false,
                message: error.message,
            });
        }
        
        // Other errors
        return res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

// ✅ ADD THIS: Catch-all for undefined routes
app.use('*', (req, res) => {
    res.status(404).send(`
        <html>
            <body>
                <h1>404 - Route Not Found</h1>
                <p>Requested: ${req.originalUrl}</p>
                <p>Try visiting: <a href="/">Home Page</a></p>
            </body>
        </html>
    `);
});

// Start server
app.listen(API_PORT, '0.0.0.0', () => { // ✅ Added '0.0.0.0' here
    console.log(`================================`);
    console.log(`✅ Server is running!`);
    console.log(`📡 Port: ${API_PORT}`);
    console.log(`🌐 Local: http://localhost:${API_PORT}`);
    console.log(`🔗 Health: http://localhost:${API_PORT}/health`);
    console.log(`📱 API: POST http://localhost:${API_PORT}/api/scan`);
    console.log(`================================`);
});

module.exports = app;