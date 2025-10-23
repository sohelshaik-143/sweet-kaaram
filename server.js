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

/* ---------------- Helpers ---------------- */
function generateTrackingID() {
  return 'SK' + Date.now().toString().slice(-8) + Math.floor(1000 + Math.random() * 9000);
}

function readOrders() {
  if (!fs.existsSync(excelFilePath)) return [];

  const workbook = XLSX.readFile(excelFilePath);
  const worksheet = workbook.Sheets['Orders'];
  if (!worksheet) return [];

  const orders = XLSX.utils.sheet_to_json(worksheet);

  return orders.map(order => {
    // Normalize keys
    Object.keys(order).forEach(k => {
      const trimmed = k.trim();
      if (trimmed !== k) {
        order[trimmed] = order[k];
        delete order[k];
      }
    });

    if (order['tracking id']) {
      order['Tracking ID'] = order['tracking id'];
      delete order['tracking id'];
    }
    if (!order['Tracking ID'] || order['Tracking ID'] === 'undefined') {
      order['Tracking ID'] = generateTrackingID();
    }

    order.name = order.name || 'Unnamed';
    order.phone = order.phone || '-';
    order['Order Status'] = order['Order Status'] || 'Pending';
    order.createdAt = order.createdAt || new Date().toISOString();

    // Parse items safely
    if (typeof order.items === 'string') {
      try { order.items = JSON.parse(order.items); } catch { order.items = []; }
    } else if (!Array.isArray(order.items)) {
      order.items = [];
    }

    // Normalize items
    order.items = order.items.map(i => ({
      name: i.name || 'Unnamed',
      qty: Number(i.qty) || 1,
      price: Number(i.price) || 0
    }));

    // Calculate totalAmount
    order.totalAmount = order.items.reduce((sum, i) => sum + (i.qty * i.price), 0);

    return order;
  });
}

function saveOrders(orders) {
  const ordersToSave = orders.map(order => ({
    ...order,
    items: JSON.stringify(order.items)
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

/* ---------------- Routes ---------------- */
app.get('/', (req, res) => res.send('✅ Server running. Visit /admin'));

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

app.get('/api/orders', (req, res) => res.json(readOrders()));

app.post('/order', (req, res) => {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];

  const newOrder = {
    name: body.name || 'Unnamed',
    phone: body.phone || '-',
    items,
    'Tracking ID': generateTrackingID(),
    'Order Status': 'Pending',
    createdAt: new Date().toISOString(),
    totalAmount: items.reduce((sum, i) => sum + ((i.price || 0) * (i.qty || 0)), 0)
  };

  appendOrder(newOrder);
  io.emit('new-order', newOrder);

  console.log('New order created:', newOrder);
  res.json({ success: true, orderId: newOrder['Tracking ID'] });
});

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

app.get('/download-excel', (req, res) => {
  if (!fs.existsSync(excelFilePath)) return res.status(404).send('Excel file not found');
  res.download(excelFilePath, 'orders.xlsx');
});

/* ---------------- Socket.IO ---------------- */
io.on('connection', socket => {
  socket.emit('all-orders', readOrders());
});

/* ---------------- Server Init ---------------- */
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
