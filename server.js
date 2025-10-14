const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5200;

// ✅ Excel file path
const EXCEL_FILE = process.env.EXCEL_PATH || 'orders.xlsx';
const excelFilePath = path.join(__dirname, EXCEL_FILE);

// ✅ Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// ✅ Read orders from Excel
function readOrders() {
  if (!fs.existsSync(excelFilePath)) return [];
  const workbook = XLSX.readFile(excelFilePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

// ✅ Write orders to Excel
function writeOrders(data) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Orders');
  XLSX.writeFile(workbook, excelFilePath);
}

// ✅ Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Place an order
app.post('/order', (req, res) => {
  try {
    const orderData = req.body;

    // Check if order has valid items
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      return res.status(400).json({ error: 'No items in order.' });
    }

    orderData.orderId = Date.now();
    orderData.timestamp = new Date().toLocaleString();
    orderData.status = 'Preparing';
    orderData.total = orderData.items.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const qty = Number(item.qty) || 0;
      return sum + price * qty;
    }, 0);

    const orders = readOrders();
    orders.push(orderData);
    writeOrders(orders);

    simulateOrderStatus(orderData.orderId);

    res.status(200).json({
      message: '✅ Order placed successfully!',
      orderId: orderData.orderId,
    });
  } catch (err) {
    console.error('❌ Error placing order:', err);
    res.status(500).json({ error: 'Something went wrong while placing the order.' });
  }
});

// ✅ Get all orders
app.get('/all-orders', (req, res) => {
  try {
    const orders = readOrders();
    res.json(orders);
  } catch (err) {
    console.error('❌ Error reading orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// ✅ Track order by ID
app.get('/track/:orderId', (req, res) => {
  const { orderId } = req.params;
  const orders = readOrders();
  const order = orders.find(o => String(o.orderId) === String(orderId));
  if (!order) return res.status(404).json({ error: 'Order not found' });

  res.json({
    orderId: order.orderId,
    status: order.status,
    timestamp: order.timestamp,
    total: order.total,
  });
});

// ✅ Admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ✅ Download Excel
app.get('/download-excel', (req, res) => {
  if (!fs.existsSync(excelFilePath)) {
    return res.status(404).send('No orders found.');
  }
  res.download(excelFilePath, 'orders.xlsx');
});

// ✅ Simulate order status updates
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
  }, 10000); // every 10 seconds
}

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
