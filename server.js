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

// ------------------ Generate Tracking ID ------------------
function generateTrackingID() {
  return "TID" + Date.now() + Math.floor(Math.random() * 9000 + 1000);
}

// ------------------ Read Orders ------------------
function readOrders() {
  if (!fs.existsSync(excelPath)) return [];

  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets["Orders"];
  if (!sheet) return [];

  const data = XLSX.utils.sheet_to_json(sheet);

  return data.map(order => {
    // Parse items
    try {
      order.items = typeof order.items === "string"
        ? JSON.parse(order.items)
        : order.items || [];
    } catch {
      order.items = [];
    }

    order.totalAmount = order.items.reduce(
      (sum, i) => sum + (Number(i.qty) || 0) * (Number(i.price) || 0),
      0
    );

    order["Order Status"] = order["Order Status"] || "Pending";
    order["Tracking ID"] = order["Tracking ID"] || generateTrackingID();

    return order;
  });
}

// ------------------ Save Orders ------------------
function saveOrders(orders) {
  const formatted = orders.map(o => ({
    ...o,
    items: JSON.stringify(o.items)
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(formatted);
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, excelPath);
}

// ------------------ Append New Order ------------------
function appendOrder(order) {
  const orders = readOrders();
  orders.push(order);
  saveOrders(orders);
}

// ------------------ ROUTES ------------------
app.get("/", (req, res) =>
  res.send("Server Running. Go to /admin")
);

app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "public/admin.html"))
);

app.get("/api/orders", (req, res) => {
  res.json(readOrders());
});

// ------------ CREATE ORDER (ONLY ONE ROUTE) ------------
app.post("/order", (req, res) => {
  const { name, phone, items } = req.body;

  if (!name || !phone || !Array.isArray(items)) {
    return res.status(400).json({ success: false, error: "Invalid data" });
  }

  const trackingId = generateTrackingID();

  const menuNames = {
    "cp100": "Chicken Pickle (100 g)",
    "cp250": "Chicken Pickle (250 g)",
    "gulab": "Gulabjamun (Box of 6)",
    "nuvvula": "Black Nuvvula Laddu (Box of 6)",
    "murukulu": "Murukulu 150 g"
  };

  const newOrder = {
    name,
    phone,
    items: items.map(i => ({
      name: menuNames[i.id] || i.name || "Unnamed Item",
      qty: Number(i.qty) || 1,
      price: Number(i.price) || 0
    })),
    totalAmount: items.reduce(
      (sum, i) => sum + (Number(i.qty) || 0) * (Number(i.price) || 0),
      0
    ),
    "Tracking ID": trackingId,
    "Order Status": "Pending",
    createdAt: new Date().toISOString()
  };

  appendOrder(newOrder);

  io.emit("new-order", newOrder);

  res.json({ success: true, orderId: trackingId });
});

// ------------ UPDATE STATUS ✔️ FIXED ✔️ ------------
app.post("/update-status", (req, res) => {
  const { trackingId, newStatus } = req.body;

  if (!trackingId || !newStatus) {
    return res.json({ success: false, error: "Missing data" });
  }

  let orders = readOrders();
  let updated = false;

  orders = orders.map(o => {
    const tid = o["Tracking ID"];

    if (tid === trackingId) {
      o["Order Status"] = newStatus;
      updated = true;
    }
    return o;
  });

  if (!updated) {
    return res.json({ success: false, error: "Tracking ID not found" });
  }

  saveOrders(orders);

  io.emit("all-orders", orders);

  return res.json({ success: true });
});

// ------------ DOWNLOAD EXCEL ------------
app.get("/download-excel", (req, res) => {
  res.download(excelPath, "orders.xlsx");
});

// ------------ SOCKET.IO ------------
io.on("connection", socket => {
  console.log("Client Connected");
  socket.emit("all-orders", readOrders());
});

// ------------ START SERVER ------------
server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
