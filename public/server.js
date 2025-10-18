const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

// Excel file path
const EXCEL_FILE = process.env.EXCEL_PATH || 'orders.xlsx';
const excelFilePath = path.join(__dirname, EXCEL_FILE);

// ──────────── Middleware ────────────
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ──────────── Helper Functions ────────────

// Create Excel file with headers if it doesn't exist
function initExcel() {
  if (!fs.existsSync(excelFilePath)) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { orderId: 'Order ID', name: 'Name', email: 'Email', phone: 'Phone', address: 'Address', persons: 'Persons', items: 'Items', total: 'Total', payment: 'Payment', status: 'Status', createdAt: 'Created At' }
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, excelFilePath);
  }
}

// Read all orders
function readOrders() {
  const wb = XLSX.readFile(excelFilePath);
  const ws = wb.Sheets['Orders'];
  const data = XLSX.utils.sheet_to_json(ws);
  return data;
}

// Write all orders back to the file
function writeOrders(data) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  XLSX.writeFile(wb, excelFilePath);
}

// ──────────── Routes ────────────

// Add new order (User)
app.post('/api/orders', (req, res) => {
  const newOrder = req.body;
  newOrder.createdAt = new Date().toISOString();
  newOrder.status = 'Pending';

  const orders = readOrders();
  orders.push(newOrder);
  writeOrders(orders);

  res.status(201).json({ message: 'Order saved successfully', order: newOrder });
});

// Get all orders (Admin)
app.get('/api/orders', (req, res) => {
  const orders = readOrders();
  res.json(orders);
});

// Delete order by ID (Only Admin)
app.delete('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  let orders = readOrders();

  const index = orders.findIndex(o => String(o.orderId) === String(orderId));
  if (index === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }

  orders.splice(index, 1);
  writeOrders(orders);

  res.json({ message: 'Order deleted successfully by admin' });
});

// ──────────── Start Server ────────────
initExcel();
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
