const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5200;

// Excel file path
const EXCEL_FILE = process.env.EXCEL_PATH || 'orders.xlsx';
const excelFilePath = path.join(__dirname, EXCEL_FILE);

// ──────────── Middleware ────────────
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// ──────────── Excel Setup ────────────
const HEADERS = [
  "S.No", "Date", "Name", "Item", "Quantity",
  "Amount", "Ph no", "Tracking ID", "Order Status", "Timestamp"
];

function initializeExcel() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([], { header: HEADERS });
  XLSX.utils.sheet_add_aoa(ws, [HEADERS], { origin: 'A1' }); // Ensure headers
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  XLSX.writeFile(wb, excelFilePath);
  console.log('🆕 New Excel file created:', excelFilePath);
}

// Automatically delete old Excel and create new one on server start
if (fs.existsSync(excelFilePath)) {
  fs.unlinkSync(excelFilePath);
  console.log('🗑️ Old Excel file deleted');
}
initializeExcel();

// ──────────── Helper Functions ────────────
function readOrders() {
  const workbook = XLSX.readFile(excelFilePath);
  const sheet = workbook.Sheets['Orders'];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function writeOrders(data) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(data, { header: HEADERS });
  XLSX.utils.book_append_sheet(workbook, sheet, 'Orders');
  XLSX.writeFile(workbook, excelFilePath);
}

function cleanOldOrders() {
  const orders = readOrders();
  const now = Date.now();
  const filtered = orders.filter(o => {
    const ts = Number(o.Timestamp) || now;
    return (now - ts) <= 24 * 60 * 60 * 1000; // 24 hours
  });
  writeOrders(filtered);
}

// ──────────── Routes ────────────
app.get('/', (req, res) => {
  cleanOldOrders();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/order', (req, res) => {
  try {
    const { name, phone, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'No items in order.' });

    const orders = readOrders();
    const sNo = orders.length + 1;
    const date = new Date().toLocaleDateString('en-GB');
    const timestamp = Date.now();
    const trackingId = `TID${timestamp}${Math.floor(Math.random() * 1000)}`;

    const itemNames = items.map(i => `${i.item} (x${i.qty})`).join(', ');
    const totalQty = items.reduce((sum, i) => sum + Number(i.qty), 0);
    const totalAmount = items.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);

    const newOrder = {
      "S.No": sNo,
      "Date": date,
      "Name": name,
      "Item": itemNames,
      "Quantity": totalQty,
      "Amount": totalAmount,
      "Ph no": phone,
      "Tracking ID": trackingId,
      "Order Status": "Preparing",
      "Timestamp": timestamp
    };

    orders.push(newOrder);
    writeOrders(orders);

    res.json({ message: '✅ Order placed successfully!', trackingId });
  } catch (err) {
    console.error('❌ Error placing order:', err);
    res.status(500).json({ error: 'Something went wrong while placing the order.' });
  }
});

app.get('/api/orders', (req, res) => {
  try {
    cleanOldOrders();
    res.json(readOrders());
  } catch (err) {
    console.error('❌ Error reading orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

app.get('/track/:trackingId', (req, res) => {
  const { trackingId } = req.params;
  const order = readOrders().find(o => String(o['Tracking ID']) === String(trackingId));
  if (!order) return res.status(404).json({ error: 'Order not found' });

  res.json({
    trackingId: order['Tracking ID'],
    status: order['Order Status'],
    date: order['Date'],
    total: order['Amount'],
  });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/download-excel', (req, res) => {
  if (!fs.existsSync(excelFilePath)) return res.status(404).send('No orders found.');
  res.download(excelFilePath, 'orders.xlsx');
});

app.post('/update-status', (req, res) => {
  try {
    const { trackingId, newStatus } = req.body;
    if (!trackingId || !newStatus)
      return res.status(400).json({ error: 'Missing trackingId or newStatus' });

    const orders = readOrders();
    const index = orders.findIndex(o => String(o['Tracking ID']) === String(trackingId));
    if (index === -1) return res.status(404).json({ error: 'Order not found' });

    orders[index]['Order Status'] = newStatus;
    writeOrders(orders);
    res.json({ message: `✅ Order status updated to "${newStatus}"` });
  } catch (err) {
    console.error('❌ Error updating order status:', err);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

setInterval(cleanOldOrders, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
