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

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helpers
function generateTrackingID() {
  return `SK${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
}

function readOrders() {
  if (!fs.existsSync(excelFilePath)) return [];
  const workbook = XLSX.readFile(excelFilePath);
  const worksheet = workbook.Sheets['Orders'];
  if (!worksheet) return [];

  const orders = XLSX.utils.sheet_to_json(worksheet);

  return orders.map(order => {
    // Parse items JSON safely
    if (order.items && typeof order.items === 'string') {
      try { 
        order.items = JSON.parse(order.items); 
      } catch { 
        order.items = []; 
      }
    } else if (!order.items) {
      order.items = [];
    }

    // Calculate totalAmount if missing
    if (!order.totalAmount && order.items.length > 0) {
      order.totalAmount = order.items.reduce((sum, i) => sum + ((i.price || 0) * (i.qty || 0)), 0);
    }

    // Ensure Tracking ID and Status exist
    if (!order['Tracking ID']) order['Tracking ID'] = generateTrackingID();
    if (!order['Order Status']) order['Order Status'] = 'Pending';

    return order;
  });
}

function saveOrders(orders) {
  const ordersToSave = orders.map(order => ({
    ...order,
    items: order.items ? JSON.stringify(order.items) : '[]'
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(ordersToSave);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
  XLSX.writeFile(workbook, excelFilePath);
}

function appendOrder(order) {
  const orders = readOrders();
  orders.push(order);
  saveOrders(orders);
}

// Routes
app.get('/', (req, res) => res.send('✅ Server running. Visit /admin for dashboard.'));

app.post('/order', (req, res) => {
  const newOrder = {
    ...req.body,
    'Tracking ID': generateTrackingID(),
    'Order Status': 'Pending',
    createdAt: new Date().toISOString()
  };

  // Ensure items is an array
  if (!Array.isArray(newOrder.items)) newOrder.items = [];

  // Calculate totalAmount
  newOrder.totalAmount = newOrder.items.reduce((sum, i) => sum + ((i.price||0)*(i.qty||0)), 0);

  appendOrder(newOrder);
  io.emit('new-order', newOrder);

  res.json({ success: true, orderId: newOrder['Tracking ID'] });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/api/orders', (req, res) => res.json(readOrders()));

app.post('/update-status', (req, res) => {
  const { trackingId, newStatus } = req.body;
  const orders = readOrders();
  const order = orders.find(o => o['Tracking ID'] === trackingId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order['Order Status'] = newStatus;
  saveOrders(orders);
  io.emit('all-orders', orders);

  res.json({ success: true });
});

app.get('/download-excel', (req, res) => {
  if (!fs.existsSync(excelFilePath)) return res.status(404).send('Excel file not found');
  res.download(excelFilePath, 'orders.xlsx');
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('Admin connected');
  socket.emit('all-orders', readOrders());
  socket.on('disconnect', () => console.log('Admin disconnected'));
});

// Start server
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
