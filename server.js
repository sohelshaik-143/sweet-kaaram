const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const PORT = 5200;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const excelFilePath = path.join(__dirname, 'orders.xlsx');

// ------------------- Helper Functions -------------------
// Read orders from Excel
function readOrders() {
  if (!fs.existsSync(excelFilePath)) return [];
  const workbook = XLSX.readFile(excelFilePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

// Write orders to Excel
function writeOrders(data) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Orders');
  XLSX.writeFile(workbook, excelFilePath);
}

// ------------------- Customer Routes -------------------
// Serve front-end
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Place order
app.post('/order', (req, res) => {
  const orderData = req.body;
  orderData.timestamp = new Date().toLocaleString();
  orderData.status = 'Preparing';

  const orders = readOrders();
  orders.push(orderData);
  writeOrders(orders);

  // Start automatic status updates
  simulateOrderStatus(orderData.orderId);

  res.status(200).json({ message: 'Order placed successfully!' });
});

// Track order
app.get('/track/:orderId', (req, res) => {
  const { orderId } = req.params;
  const orders = readOrders();
  const order = orders.find(o => String(o.orderId) === String(orderId));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ orderId: order.orderId, status: order.status, timestamp: order.timestamp });
});

// Get all orders (for history)
app.get('/all-orders', (req, res) => {
  const orders = readOrders();
  res.json(orders);
});

// ------------------- Admin Routes -------------------
// Serve Admin Dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Download Excel
app.get('/download-excel', (req, res) => {
  if (!fs.existsSync(excelFilePath)) return res.status(404).send('No orders found.');
  res.download(excelFilePath, 'orders.xlsx');
});

// ------------------- Status Simulation -------------------
function simulateOrderStatus(orderId) {
  const statuses = ['Preparing', 'Out for Delivery', 'Delivered'];
  let index = 0;

  const interval = setInterval(() => {
    const orders = readOrders();
    const orderIndex = orders.findIndex(o => String(o.orderId) === String(orderId));
    if (orderIndex === -1 || index >= statuses.length) {
      clearInterval(interval);
      return;
    }

    orders[orderIndex].status = statuses[index];
    writeOrders(orders);
    index++;
  }, 10000); // Change status every 10 seconds
}

// ------------------- Start Server -------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
