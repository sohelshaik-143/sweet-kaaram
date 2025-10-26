// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 5200;
const EXCEL_FILE = 'orders.xlsx';
const excelPath = path.join(__dirname, EXCEL_FILE);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Generate Unique Tracking ID
function generateTrackingID() {
  return 'SK' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 9000 + 1000);
}

// ✅ Read Orders from Excel
function readOrders() {
  if (!fs.existsSync(excelPath)) return [];

  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames.includes('Orders') ? 'Orders' : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];

  const data = XLSX.utils.sheet_to_json(worksheet);

  return data.map(order => {
    // Parse items
    order.items = order.items ? JSON.parse(order.items) : [];

    order.items = order.items.map(i => ({
      name: i.name || 'Unnamed',
      qty: Number(i.qty) || 1,
      price: Number(i.price) || 0
    }));

    // Calculate totals
    order.totalAmount = order.items.reduce((sum, i) => sum + (i.qty * i.price), 0);
    order['Order Status'] = order['Order Status'] || 'Pending';
    order.createdAt = order.createdAt || new Date().toISOString();

    // ✅ Always ensure tracking ID exists
    if (!order['Tracking ID'] || order['Tracking ID'].trim() === '') {
      order['Tracking ID'] = generateTrackingID();
    }

    return order;
  });
}

// ✅ Save Orders to Excel
function saveOrders(orders) {
  const formatted = orders.map(o => ({
    ...o,
    items: JSON.stringify(o.items)
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(formatted);
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  XLSX.writeFile(wb, excelPath);
}

// ✅ Append a new order
function appendOrder(order) {
  const orders = readOrders();
  orders.push(order);
  saveOrders(orders);
}

// ROUTES

app.get('/', (req, res) => res.send('✅ Server running. Visit /admin for dashboard.'));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/api/orders', (req, res) => res.json(readOrders()));

// ✅ Create a new order
app.post('/order', (req, res) => {
  const { name, phone, items } = req.body;

  if (!name || !phone || !Array.isArray(items)) {
    return res.status(400).json({ success: false, error: 'Invalid data' });
  }

  const newOrder = {
    name,
    phone,
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

// ✅ Update order status
app.post('/update-status', (req, res) => {
  const { trackingId, newStatus } = req.body;
  if (!trackingId || !newStatus) {
    return res.status(400).json({ success: false, error: 'Missing data' });
  }

  const orders = readOrders();
  const order = orders.find(o => o['Tracking ID'] === trackingId);

  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

  order['Order Status'] = newStatus;
  saveOrders(orders);

  io.emit('all-orders', orders);
  res.json({ success: true });
});

// ✅ Download Excel file
app.get('/download-excel', (req, res) => {
  if (!fs.existsSync(excelPath)) return res.status(404).send('Excel file not found');
  res.download(excelPath, 'orders.xlsx');
});

// SOCKET.IO
io.on('connection', socket => {
  console.log('🟢 Client connected');
  socket.emit('all-orders', readOrders());
});

// ✅ START SERVER
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
