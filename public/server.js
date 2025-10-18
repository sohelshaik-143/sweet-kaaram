const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000; // You can change this port if needed

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Excel file path
const EXCEL_FILE = 'orders.xlsx';
const excelFilePath = path.join(__dirname, EXCEL_FILE);

// Ensure Excel file exists
if (!fs.existsSync(excelFilePath)) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([]);
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  XLSX.writeFile(wb, excelFilePath);
}

// 📌 Function to read orders from Excel
function readOrders() {
  const wb = XLSX.readFile(excelFilePath);
  const ws = wb.Sheets['Orders'];
  return XLSX.utils.sheet_to_json(ws) || [];
}

// 📌 Function to write orders to Excel (Append without deleting old)
function writeOrders(orders) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(orders);
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  XLSX.writeFile(wb, excelFilePath);
}

// ✅ API: Place New Order
app.post('/api/orders', (req, res) => {
  try {
    const newOrder = req.body;
    const orders = readOrders();

    // Assign unique ID and timestamp
    newOrder.orderId = `SK${Date.now()}`;
    newOrder.createdAt = new Date().toISOString();

    orders.push(newOrder);
    writeOrders(orders);

    res.status(201).json({ message: 'Order placed successfully', orderId: newOrder.orderId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to place order' });
  }
});

// ✅ API: Get All Orders
app.get('/api/orders', (req, res) => {
  try {
    const orders = readOrders();
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// ✅ API: Admin Delete Order (Manual only)
app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const { isAdmin } = req.body; // You can replace this with proper auth check later

  if (!isAdmin) {
    return res.status(403).json({ message: 'Unauthorized: Only admin can delete orders' });
  }

  try {
    let orders = readOrders();
    const updatedOrders = orders.filter(order => order.orderId !== id);

    if (updatedOrders.length === orders.length) {
      return res.status(404).json({ message: 'Order not found' });
    }

    writeOrders(updatedOrders);
    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete order' });
  }
});

// ✅ Server Start
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
