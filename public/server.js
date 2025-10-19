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

// ────────────── MIDDLEWARE ──────────────
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ────────────── HELPER FUNCTIONS ──────────────

// Ensure Excel file exists with proper headers
function initExcel() {
  if (!fs.existsSync(excelFilePath)) {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
    XLSX.writeFile(workbook, excelFilePath);
  }
}

// Read orders from Excel
function readOrders() {
  initExcel();
  const workbook = XLSX.readFile(excelFilePath);
  const worksheet = workbook.Sheets['Orders'];
  if (!worksheet) return [];
  const orders = XLSX.utils.sheet_to_json(worksheet);

  // Normalize property names for dashboard
  return orders.map(o => ({
    name: o.name || o.Name || '',
    phone: o.phone || o.Phone || '',
    email: o.email || o.Email || '',
    address: o.address || o.Address || '',
    persons: o.persons || o.Persons || 0,
    items: o.items ? JSON.parse(o.items) : [],
    total: o.total || o.Total || 0,
    'Tracking ID': o['Tracking ID'] || o.TrackingID || '',
    'Order Status': o['Order Status'] || o.status || 'Pending',
    createdAt: o.createdAt || o.CreatedAt || new Date().toISOString()
  }));
}

// Save orders to Excel
function saveOrders(orders) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(
    orders.map(o => ({
      ...o,
      items: JSON.stringify(o.items)
    }))
  );
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
  XLSX.writeFile(workbook, excelFilePath);
}

// Append new order without deleting previous
function appendOrder(order) {
  const orders = readOrders();
  orders.push(order);
  saveOrders(orders);
}

// ────────────── ROUTES ──────────────

// Home
app.get('/', (req, res) => {
  res.send('✅ Server running. Visit /admin for dashboard.');
});

// Add new order
app.post('/order', (req, res) => {
  const newOrder = {
    ...req.body,
    'Tracking ID': `SK${Date.now()}`,
    'Order Status': 'Pending',
    createdAt: new Date().toISOString()
  };
  appendOrder(newOrder);
  io.emit('new-order', newOrder); // live broadcast
  res.json({ success: true, orderId: newOrder['Tracking ID'] });
});

// Admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

// Get all orders
app.get('/api/orders', (req, res) => {
  res.json(readOrders());
});

// Update order status
app.post('/update-status', (req, res) => {
  const { trackingId, newStatus } = req.body;
  const orders = readOrders();
  const order = orders.find(o => o['Tracking ID'] === trackingId);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  order['Order Status'] = newStatus;
  saveOrders(orders);

  io.emit('all-orders', orders); // live update
  res.json({ success: true });
});

// Download Excel
app.get('/download-excel', (req, res) => {
  if (!fs.existsSync(excelFilePath)) return res.status(404).send('Excel file not found');
  res.download(excelFilePath, 'orders.xlsx');
});

// ────────────── SOCKET.IO ──────────────
io.on('connection', (socket) => {
  console.log('Admin connected');
  socket.emit('all-orders', readOrders());
  socket.on('disconnect', () => console.log('Admin disconnected'));
});

// ────────────── START SERVER ──────────────
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
