// ------------------- IMPORTS -------------------
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const cors = require('cors');

// ------------------- APP CONFIG -------------------
const app = express();
const PORT = process.env.PORT || 4000;
const ordersFilePath = path.join(__dirname, 'orders.xlsx');

app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

// ------------------- ADMIN LOGIN -------------------
const ADMIN_EMAIL = "admin@sweetkaram.com";
const ADMIN_PASSWORD = "Admin@123";

// ------------------- INIT EXCEL FILE -------------------
function initExcelFile() {
  if (!fs.existsSync(ordersFilePath)) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, ordersFilePath);
    console.log('✅ orders.xlsx created');
  }
}
initExcelFile();

// ------------------- ADD ORDER -------------------
app.post('/order', (req, res) => {
  const newOrder = req.body;
  if (!newOrder.email || !newOrder.item || !newOrder.quantity) {
    return res.status(400).json({ message: 'Invalid order data ❌' });
  }

  const workbook = XLSX.readFile(ordersFilePath);
  const worksheet = workbook.Sheets['Orders'];
  const orders = XLSX.utils.sheet_to_json(worksheet);

  newOrder.timestamp = new Date().toISOString();
  orders.push(newOrder);

  const updatedWS = XLSX.utils.json_to_sheet(orders);
  workbook.Sheets['Orders'] = updatedWS;
  XLSX.writeFile(workbook, ordersFilePath);

  res.json({ message: '✅ Order saved successfully', order: newOrder });
});

// ------------------- GET ORDERS -------------------
app.get('/orders', (req, res) => {
  const workbook = XLSX.readFile(ordersFilePath);
  const worksheet = workbook.Sheets['Orders'];
  const orders = XLSX.utils.sheet_to_json(worksheet);
  res.json(orders);
});

// ------------------- DELETE ORDERS (ADMIN ONLY) -------------------
app.post('/admin/delete-orders', (req, res) => {
  const { email, password } = req.body;

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(403).json({ message: '❌ Unauthorized: Admin only' });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([]);
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  XLSX.writeFile(wb, ordersFilePath);

  res.json({ message: '🧹 All orders cleared by admin' });
});

// ------------------- LOGIN -------------------
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({ success: true, isAdmin: true, message: '✅ Admin login success' });
  }

  // For now, every non-admin user is just logged in (no DB)
  res.json({ success: true, isAdmin: false, message: '✅ User login success' });
});

// ------------------- START SERVER -------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
