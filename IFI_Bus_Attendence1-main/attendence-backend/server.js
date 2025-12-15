const express = require('express');
const cors = require('cors');
const dbOperation = require('./dboperation');
const API_PORT = 5000;
const app = express();

// Middlewares
app.use(cors());              // allow frontend/mobile to call this
app.use(express.json());      // parse JSON body

// Health check (optional)
app.get('/', (req, res) => {
    res.send('Attendance API running');
});

// GET /api/health - more detailed health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Attendance API is running',
        timestamp: new Date().toISOString(),
        duplicateCheckWindow: '5 minutes'
    });
});

// POST /api/scan - receive scan from app
app.post('/api/scan', async (req, res) => {
    const { employeeId, scanDateTime, scanType, deviceInfo } = req.body;
    
    // Validate required fields
    if (!employeeId || !scanDateTime || !scanType) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields (employeeId, scanDateTime, scanType)',
        });
    }

    // Validate employeeId format (optional, adjust as needed)
    if (typeof employeeId !== 'string' || employeeId.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Invalid employee ID format',
        });
    }

    // Validate scanDateTime format
    const scanDate = new Date(scanDateTime);
    if (isNaN(scanDate.getTime())) {
        return res.status(400).json({
            success: false,
            message: 'Invalid scan date/time format',
        });
    }

    // Ensure scanDateTime is not in the future
    const now = new Date();
    if (scanDate > now) {
        return res.status(400).json({
            success: false,
            message: 'Scan date/time cannot be in the future',
        });
    }

    try {
        // Use the updated insertScan function that includes duplicate check
        const result = await dbOperation.insertScan(
            employeeId.trim(),
            scanDateTime,
            scanType,
            deviceInfo || 'Expo-Mobile-Scanner'
        );
        
        return res.json({
            success: true,
            message: 'Scan recorded successfully',
            timestamp: new Date().toISOString(),
            employeeId: employeeId
        });
        
    } catch (error) {
        console.error('Error inserting scan:', error);
        
        // Handle duplicate scan error specifically
        if (error.code === 'DUPLICATE' || error.message === 'DUPLICATE_SCAN') {
            return res.status(409).json({ // 409 Conflict
                success: false,
                message: error.message || `Employee ID ${employeeId} was recently scanned`,
                code: 'DUPLICATE_SCAN',
                timestamp: new Date().toISOString()
            });
        }
        
        // Handle other database errors
        if (error.message?.includes('Violation of PRIMARY KEY') || 
            error.message?.includes('duplicate key')) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate entry detected',
                code: 'DUPLICATE_ENTRY',
                timestamp: new Date().toISOString()
            });
        }
        
        // Handle SQL connection errors
        if (error.code === 'ETIMEOUT' || error.code === 'ESOCKET') {
            return res.status(503).json({
                success: false,
                message: 'Database connection timeout. Please try again.',
                code: 'DB_CONNECTION_ERROR',
                timestamp: new Date().toISOString()
            });
        }
        
        // Generic server error
        return res.status(500).json({
            success: false,
            message: 'Server error while saving scan',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/recent-scans/:employeeId?hours=24 - Check recent scans for an employee
app.get('/api/recent-scans/:employeeId', async (req, res) => {
    const { employeeId } = req.params;
    const hours = parseInt(req.query.hours) || 24;
    
    if (!employeeId) {
        return res.status(400).json({
            success: false,
            message: 'Employee ID is required'
        });
    }
    
    try {
        // You'll need to add a function in dboperation.js to get recent scans
        // For now, we'll use the checkRecentScan function with a custom threshold
        const minutesThreshold = hours * 60;
        const hasRecentScan = await dbOperation.checkRecentScan(employeeId, minutesThreshold);
        
        return res.json({
            success: true,
            employeeId,
            hasRecentScan,
            timeWindow: `${hours} hours`,
            message: hasRecentScan 
                ? `Employee ${employeeId} has been scanned in the last ${hours} hours`
                : `No recent scans found for employee ${employeeId} in the last ${hours} hours`
        });
        
    } catch (error) {
        console.error('Error checking recent scans:', error);
        return res.status(500).json({
            success: false,
            message: 'Error checking recent scans',
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/scans/today - Get today's scans (for debugging/admin)
app.get('/api/scans/today', async (req, res) => {
    try {
        // You would need to add a function in dboperation.js to get today's scans
        // For now, returning a placeholder response
        return res.json({
            success: true,
            message: 'This endpoint requires additional implementation',
            timestamp: new Date().toISOString(),
            date: new Date().toDateString()
        });
    } catch (error) {
        console.error('Error getting today\'s scans:', error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving scans',
            timestamp: new Date().toISOString()
        });
    }
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(API_PORT, () => {
    console.log(`=================================`);
    console.log(`Attendance API listening on port ${API_PORT}`);
    console.log(`Duplicate check: Enabled (5-minute window)`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Server URL: http://localhost:${API_PORT}`);
    console.log(`Health check: http://localhost:${API_PORT}/api/health`);
    console.log(`=================================`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Export for testing purposes
module.exports = app;