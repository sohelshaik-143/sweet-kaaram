const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const ExcelJS = require('exceljs');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 5200;
const EXCEL_FILE = 'orders.xlsx';
const excelFilePath = path.join(__dirname, EXCEL_FILE);

// ────────────── Middleware ──────────────
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ────────────── Helper Functions ──────────────

// Initialize Excel if missing
async function initExcel() {
  if (!fs.existsSync(excelFilePath)) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Orders');
    sheet.columns = [
      { header: 'S.No', key: 'sno', width: 5 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Ph no', key: 'phone', width: 15 },
      { header: 'Item', key: 'item', width: 30 },
      { header: 'Qty', key: 'qty', width: 5 },
      { header: 'Amount', key: 'amount', width: 10 },
      { header: 'Tracking ID', key: 'trackingId', width: 20 },
      { header: 'Order Status', key: 'status', width: 15 }
    ];
    await workbook.xlsx.writeFile(excelFilePath);
  }
}

// Convert items array to string for Excel
function itemsToString(items) {
  if (!items) return '';
  return Array.isArray(items)
    ? items.map(i => `${i.name} x${i.qty}`).join(', ')
    : items;
}

// Read orders from Excel
async function readOrders() {
  await initExcel();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelFilePath);
  const sheet = workbook.getWorksheet('Orders');
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    rows.push({
      name: row.getCell('C').value || '',
      phone: row.getCell('D').value || '',
      items: row.getCell('E').value ? row.getCell('E').value.split(',').map(i => {
        const [name, qty] = i.trim().split(' x');
        return { name, qty: Number(qty) };
      }) : [],
      total: row.getCell('G').value || 0,
      'Tracking ID': row.getCell('H').value || '',
      'Order Status': row.getCell('I').value || 'Pending',
      createdAt: row.getCell('B').value ? new Date(row.getCell('B').value).toISOString() : new Date().toISOString()
    });
  });
  return rows;
}

// Save orders to Excel
async function saveOrders(orders) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Orders');
  sheet.columns = [
    { header: 'S.No', key: 'sno', width: 5 },
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Ph no', key: 'phone', width: 15 },
    { header: 'Item', key: 'item', width: 30 },
    { header: 'Qty', key: 'qty', width: 5 },
    { header: 'Amount', key: 'amount', width: 10 },
    { header: 'Tracking ID', key: 'trackingId', width: 20 },
    { header: 'Order Status', key: 'status', width: 15 }
  ];

  orders.forEach((o, index) => {
    sheet.addRow({
      sno: index + 1,
      date: new Date(o.createdAt).toLocaleString(),
      name: o.name,
      phone: o.phone,
      item: itemsToString(o.items),
      qty: Array.isArray(o.items) ? o.items.reduce((sum,i)=>sum+(i.qty||0),0) : 0,
      amount: o.total,
      trackingId: o['Tracking ID'],
      status: o['Order Status']
    });
  });

  await workbook.xlsx.writeFile(excelFilePath);
}

// Append new order
async function appendOrder(order) {
  const orders = await readOrders();
  orders.push(order);
  await saveOrders(orders);
}

// ────────────── Routes ──────────────
app.get('/', (req, res) => res.send('✅ Server running. Visit /admin for dashboard.'));

app.post('/order', async (req, res) => {
  const newOrder = {
    ...req.body,
    'Tracking ID': `SK${Date.now()}`,
    'Order Status': 'Pending',
    createdAt: new Date().toISOString()
  };
  await appendOrder(newOrder);
  io.emit('new-order', newOrder);
  res.json({ success: true, orderId: newOrder['Tracking ID'] });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

app.get('/api/orders', async (req, res) => res.json(await readOrders()));

app.post('/update-status', async (req, res) => {
  const { trackingId, newStatus } = req.body;
  const orders = await readOrders();
  const order = orders.find(o => o['Tracking ID'] === trackingId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order['Order Status'] = newStatus;
  await saveOrders(orders);
  io.emit('all-orders', orders);
  res.json({ success: true });
});

app.get('/download-excel', (req, res) => {
  if (!fs.existsSync(excelFilePath)) return res.status(404).send('Excel file not found');
  res.download(excelFilePath, 'orders.xlsx');
});

// ────────────── Socket.IO ──────────────
io.on('connection', (socket) => {
  console.log('Admin connected');
  readOrders().then(orders => socket.emit('all-orders', orders));
  socket.on('disconnect', () => console.log('Admin disconnected'));
});

// ────────────── Start Server ──────────────
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
