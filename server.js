const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5200;

// ✅ Use environment variable for Excel file (optional)
const EXCEL_FILE = process.env.EXCEL_PATH || 'orders.xlsx';
const excelFilePath = path.join(__dirname, EXCEL_FILE);

// ✅ Middleware
app.use(bodyParser.json());

// ✅ Serve static files (public folder for HTML, CSS, JS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Optional: Serve images from a dedicated folder (if you keep them separately)
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// 📊 Read orders from Excel file
function readOrders() {
  if (!fs.existsSync(excelFilePath)) return [];
  const workbook = XLSX.readFile(excelFilePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

// 📝 Write orders to Excel file
function writeOrders(data) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Orders');
  XLSX.writeFile(workbook, excelFilePath);
}

// 🏠 Serve homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🛍️ Place an order
app.post('/order', (req, res) => {
  const orderData = req.body;
  orderData.orderId = Date.now();
  orderData.timestamp = new Date().toLocaleString();
  orderData.status = 'Preparing';
  orderData.total = orderData.items.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  const orders = readOrders();
  orders.push(orderData);
  writeOrders(orders);

  simulateOrderStatus(orderData.orderId);

  res.status(200).json({
    message: 'Order placed successfully!',
    orderId: orderData.orderId
  });
});

// 🚚 Track order by ID
app.get('/track/:orderId', (req, res) => {
  const { orderId } = req.params;
  const orders = readOrders();
  const order = orders.find(o => String(o.orderId) === String(orderId));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({
    orderId: order.orderId,
    status: order.status,
    timestamp: order.timestamp,
    total: order.total
  });
});

// 🛠️ Admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 📥 Download Excel
app.get('/download-excel', (req, res) => {
  if (!fs.existsSync(excelFilePath)) {
    return res.status(404).send('No orders found.');
  }
  res.download(excelFilePath, 'orders.xlsx');
});

// ⏳ Simulate order status updates
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
  }, 10000); // 10 seconds
}

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
