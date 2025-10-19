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

// Read all orders from Excel
function readOrders() {
  if (!fs.existsSync(excelFilePath)) return [];
  const workbook = XLSX.readFile(excelFilePath);
  const worksheet = workbook.Sheets['Orders'];
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json(worksheet);
}

// Save orders array to Excel
function saveOrders(orders) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(orders);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
  XLSX.writeFile(workbook, excelFilePath);
}

// Append a new order without deleting previous
function appendOrder(newOrder) {
  const orders = readOrders();
  orders.push(newOrder);
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

  io.emit('new-order', newOrder); // Real-time broadcast
  res.json({ success: true, message: 'Order added successfully.', orderId: newOrder['Tracking ID'] });
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

  io.emit('all-orders', orders); // Update dashboard live
  res.json({ success: true, message: `Order ${trackingId} marked as ${newStatus}` });
});

// Reset all orders manually
app.post('/reset-orders', (req, res) => {
  saveOrders([]);
  io.emit('all-orders', []);
  res.json({ success: true, message: 'All orders cleared manually.' });
});

// Download Excel
app.get('/download-excel', (req, res) => {
  if (!fs.existsSync(excelFilePath)) return res.status(404).send('Excel file not found');
  res.download(excelFilePath, 'orders.xlsx', err => {
    if (err) console.error('Error downloading file:', err);
  });
});

// ────────────── SOCKET.IO ──────────────
io.on('connection', (socket) => {
  console.log('Admin connected');
  socket.emit('all-orders', readOrders());

  socket.on('disconnect', () => {
    console.log('Admin disconnected');
  });
});

// ────────────── START SERVER ──────────────
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
