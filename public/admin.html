const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 5200;

// Excel file path
const EXCEL_FILE = 'orders.xlsx';
const excelFilePath = path.join(__dirname, EXCEL_FILE);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ────────────── HELPER FUNCTIONS ──────────────
function readOrders() {
    if (!fs.existsSync(excelFilePath)) return [];
    const workbook = XLSX.readFile(excelFilePath);
    let worksheet = workbook.Sheets['Orders'];
    if (!worksheet) {
        worksheet = XLSX.utils.json_to_sheet([]);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
        XLSX.writeFile(workbook, excelFilePath);
        return [];
    }
    return XLSX.utils.sheet_to_json(worksheet);
}

function saveOrders(orders) {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(orders);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
    XLSX.writeFile(workbook, excelFilePath);
}

// ────────────── ROUTES ──────────────

// Home
app.get('/', (req, res) => res.send('Server running. Visit /admin for dashboard.'));

// Add new order → Excel updated immediately
app.post('/order', (req, res) => {
    const newOrder = { ...req.body, createdAt: new Date().toISOString() };
    const existingOrders = readOrders();
    existingOrders.push(newOrder);
    saveOrders(existingOrders);

    io.emit('new-order', newOrder); // Real-time update
    res.json({ success: true, message: 'Order added and saved to Excel.' });
});

// Admin dashboard HTML
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

// Get all orders (Excel read every time)
app.get('/api/orders', (req, res) => res.json(readOrders()));

// Mark order as delivered
app.post('/update-status', (req, res) => {
    const { trackingId, newStatus } = req.body;
    const orders = readOrders();
    const order = orders.find(o => o['Tracking ID'] === trackingId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order['Order Status'] = newStatus;
    saveOrders(orders);
    io.emit('all-orders', orders);
    res.json({ success: true, message: `Order ${trackingId} marked as ${newStatus}` });
});

// Clear all orders manually
app.post('/reset-orders', (req, res) => {
    saveOrders([]);
    io.emit('all-orders', []);
    res.json({ success: true, message: 'All orders cleared manually.' });
});

// Download Excel
app.get('/download-excel', (req, res) => {
    if (!fs.existsSync(excelFilePath)) return res.status(404).send('Excel file not found');
    res.download(excelFilePath, 'orders.xlsx', (err) => {
        if (err) console.error('Error downloading file:', err);
    });
});

// ────────────── SOCKET.IO ──────────────
io.on('connection', (socket) => {
    console.log('Admin connected');
    socket.emit('all-orders', readOrders());
    socket.on('disconnect', () => console.log('Admin disconnected'));
});

// ────────────── START SERVER ──────────────
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
