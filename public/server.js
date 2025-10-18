// ────────────── SERVER SETUP ──────────────
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5200;

// ────────────── EXCEL FILE CONFIG ──────────────
const EXCEL_FILE = 'orders.xlsx';
const excelFilePath = path.join(__dirname, EXCEL_FILE);

// ────────────── MIDDLEWARE ──────────────
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // For frontend/admin

// ────────────── HELPER FUNCTIONS ──────────────

// Read existing orders from Excel
function readOrders() {
    if (!fs.existsSync(excelFilePath)) return [];
    const workbook = XLSX.readFile(excelFilePath);
    const worksheet = workbook.Sheets['Orders'];
    if (!worksheet) return [];
    return XLSX.utils.sheet_to_json(worksheet);
}

// Save orders to Excel (appends new orders)
function saveOrders(orders) {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(orders);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
    XLSX.writeFile(workbook, excelFilePath);
}

// ────────────── ROUTES ──────────────

// Home route
app.get('/', (req, res) => {
    res.send('Server is running. Use /admin to view orders.');
});

// Add new order
app.post('/order', (req, res) => {
    const newOrder = req.body;

    // Read existing orders
    const existingOrders = readOrders();

    // Append new order
    existingOrders.push({
        ...newOrder,
        createdAt: new Date().toISOString()
    });

    // Save back to Excel
    saveOrders(existingOrders);

    res.json({ success: true, message: 'Order added successfully.' });
});

// Admin dashboard to view orders
app.get('/admin', (req, res) => {
    const orders = readOrders();
    res.json({ orders });
});

// ────────────── START SERVER ──────────────
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
