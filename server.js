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
const EXCEL_FILE = 'orders.xlsx';
const excelFilePath = path.join(__dirname, EXCEL_FILE);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ------------------- Helpers ------------------- */

// Generate unique Tracking ID
function generateTrackingID() {
  return 'SK' + Date.now().toString().slice(-8) + Math.floor(1000 + Math.random() * 9000);
}

// Read orders from Excel
function readOrders() {
  if (!fs.existsSync(excelFilePath)) return [];

  const workbook = XLSX.readFile(excelFilePath);
  const worksheet = workbook.Sheets['Orders'];
  if (!worksheet) return [];

  const orders = XLSX.utils.sheet_to_json(worksheet);

  return orders.map(order => {
    // Normalize keys
    if (order.trackingId) { order['Tracking ID'] = order.trackingId; delete order.trackingId; }

    if (!order['Tracking ID'] || order['Tracking ID'] === 'undefined' || order['Tracking ID'] === '') {
      order['Tracking ID'] = generateTrackingID();
    }

    if (!order['Order Status']) order['Order Status'] = 'Pending';
    if (!order.createdAt) order.createdAt = new Date().toISOString();

    // Parse items
    if (order.items && typeof order.items === 'string') {
      try { order.items = JSON.parse(order.items); } catch { order.items = []; }
    } else if (!order.items) order.items = [];

    order.items = order.items.map(i => ({
      name: i.name || 'Unnamed',
      qty: Number(i.qty) || 1,
      price: Number(i.price) || 0
    }));

    if (!order.totalAmount) {
      order.totalAmount = order.items.reduce((sum, i) => sum + (i.qty * i.price), 0);
    }

    return order;
  });
}

// Save orders to Excel
function saveOrders(orders) {
  const ordersToSave = orders.map(order => ({ ...order, items: JSON.stringify(order.items) }));
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(ordersToSave);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
  XLSX.writeFile(workbook, excelFilePath);
}

// Append new order
function appendOrder(order) {
  const orders = readOrders();
  orders.push(order);
  saveOrders(orders);
}

/* ------------------- Routes ------------------- */

// Health check
app.get('/', (req, res) => res.send('✅ Server running. Visit /admin'));

// Add new order
app.post('/order', (req, res) => {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];

  const newOrder = {
    ...body,
    items,
    'Tracking ID': generateTrackingID(),
    'Order Status': 'Pending',
    createdAt: new Date().toISOString(),
    totalAmount: items.reduce((sum, i) => sum + ((i.price || 0) * (i.qty || 0)), 0)
  };

  appendOrder(newOrder);
  io.emit('new-order', newOrder);

  res.json({ success: true, orderId: newOrder['Tracking ID'] });
});

// Admin dashboard
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

// Fetch all orders
app.get('/api/orders', (req, res) => {
  res.json(readOrders());
});

// Update order status
app.post('/update-status', (req, res) => {
  const { trackingId, newStatus } = req.body;
  if (!trackingId || !newStatus) return res.status(400).json({ error: 'Missing trackingId or newStatus' });

  const orders = readOrders();
  const order = orders.find(o => o['Tracking ID'] === trackingId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order['Order Status'] = newStatus;
  saveOrders(orders);
  io.emit('all-orders', orders);

  res.json({ success: true });
});

// Download Excel
app.get('/download-excel', (req, res) => {
  if (!fs.existsSync(excelFilePath)) return res.status(404).send('Excel file not found');
  res.download(excelFilePath, 'orders.xlsx');
});

/* ------------------- Socket.IO ------------------- */

io.on('connection', socket => {
  socket.emit('all-orders', readOrders());
});

/* ------------------- Auto-fix old orders ------------------- */
(function fixOldOrders() {
  const orders = readOrders();
  let updated = false;

  orders.forEach(order => {
    if (!order['Tracking ID'] || order['Tracking ID'] === 'undefined' || order['Tracking ID'] === '') {
      order['Tracking ID'] = generateTrackingID();
      updated = true;
    }
    if (!order.items) order.items = [];
  });

  if (updated) saveOrders(orders);
})();

/* ------------------- Start Server ------------------- */
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
