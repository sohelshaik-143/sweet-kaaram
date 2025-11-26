// =======================
//        SERVER.JS
// =======================
const express = require("express");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 5200;
const EXCEL_FILE = "orders.xlsx";
const excelPath = path.join(__dirname, EXCEL_FILE);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =======================
//     ADMIN PAGE
// =======================
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// =======================
//     TRACKING PAGE FIX
// =======================
app.get("/track", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "track.html"));
});

app.get("/track/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "track.html"));
});

// =======================
//   CREATE EXCEL IF MISSING
// =======================
function ensureExcel() {
  if (!fs.existsSync(excelPath)) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, excelPath);
  }
}
ensureExcel();

// =======================
//      LOAD ORDERS
// =======================
function loadHistory() {
  ensureExcel();
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets["Orders"];
  const json = XLSX.utils.sheet_to_json(sheet);

  return json.map(order => {
    try {
      order.items =
        typeof order.items === "string"
          ? JSON.parse(order.items)
          : Array.isArray(order.items) ? order.items : [];
    } catch {
      order.items = [];
    }

    order.totalAmount = order.items.reduce(
      (sum, i) => sum + i.qty * i.price,
      0
    );

    order["Order Status"] = order["Order Status"] || "Pending";
    return order;
  });
}

// =======================
//      SAVE ORDERS
// =======================
function saveHistory(orders) {
  const formatted = orders.map(o => ({
    ...o,
    items: JSON.stringify(o.items)
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(formatted);
  XLSX.utils.book_append_sheet(wb, ws, "Orders");

  XLSX.writeFile(wb, excelPath);
}

// =======================
//   GENERATE TRACKING ID
// =======================
function generateTrackingID() {
  return "TID" + Date.now() + Math.floor(Math.random() * 9000 + 1000);
}

// =======================
//     CREATE ORDER
// =======================
app.post("/order", (req, res) => {
  const { name, phone, items } = req.body;

  if (!name || !phone || !items) {
    return res.status(400).json({ success: false, error: "Invalid data" });
  }

  const trackingId = generateTrackingID();

  const updatedItems = items.map(i => ({
    name: i.name || "Unnamed Item",
    qty: Number(i.qty) || 1,
    price: Number(i.price) || 0
  }));

  const newOrder = {
    name,
    phone,
    items: updatedItems,
    totalAmount: updatedItems.reduce((s, i) => s + i.qty * i.price, 0),
    "Tracking ID": trackingId,
    "Order Status": "Pending",
    createdAt: new Date().toISOString()
  };

  const history = loadHistory();
  history.push(newOrder);
  saveHistory(history);

  io.emit("new-order", newOrder);

  res.json({ success: true, orderId: trackingId });
});

// =======================
//     TRACK ORDER API
// =======================
app.get("/api/track/:id", (req, res) => {
  const id = req.params.id;
  const history = loadHistory();

  const order = history.find(o => o["Tracking ID"] === id);

  if (!order) {
    return res.json({ success: false, error: "Order not found" });
  }

  res.json({ success: true, order });
});

// =======================
//     ADMIN — GET ALL ORDERS
// =======================
app.get("/api/orders", (req, res) => {
  res.json(loadHistory());
});

// =======================
//     ADMIN — UPDATE STATUS
// =======================
app.post("/update-status", (req, res) => {
  const { trackingId, newStatus } = req.body;

  const history = loadHistory();
  const index = history.findIndex(o => o["Tracking ID"] === trackingId);

  if (index === -1) {
    return res.json({ success: false, error: "Tracking ID not found" });
  }

  history[index]["Order Status"] = newStatus;
  saveHistory(history);

  io.emit("all-orders", history);

  res.json({ success: true });
});

// =======================
//     ADMIN — CLEAR ALL ORDERS
// =======================
app.post("/clear-orders", (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([]);
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, excelPath);

  io.emit("all-orders", []);
  res.json({ success: true });
});

// =======================
//   FIX — DOWNLOAD EXCEL
// =======================
app.get("/download-excel", (req, res) => {
  if (!fs.existsSync(excelPath)) {
    return res.status(404).send("Excel file not found.");
  }

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=orders.xlsx"
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  res.download(excelPath);
});

// =======================
//      SOCKET.IO
// =======================
io.on("connection", socket => {
  console.log("Client Connected");
  socket.emit("all-orders", loadHistory());
});

// =======================
//     START SERVER
// =======================
server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
