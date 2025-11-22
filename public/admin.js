// =============================
//        ADMIN PANEL JS
// =============================
const tbody = document.getElementById("ordersBody");
let currentOrders = [];

// ---------------- Render Orders ----------------
function renderOrders() {
  tbody.innerHTML = "";

  currentOrders.slice().reverse().forEach((order, i) => {
    const tr = document.createElement("tr");

    const trackingId =
      order["Tracking ID"] ||
      order.trackingId ||
      order.orderId ||
      "TID" + Date.now();

    // Parse items safely
    let items = [];
    try {
      if (Array.isArray(order.items)) {
        items = order.items;
      } else if (typeof order.items === "string") {
        items = JSON.parse(order.items);
      }
    } catch {
      items = [];
    }

    const itemsList = items.length
      ? items.map(i => `${i.name} (${i.qty} × ₹${i.price})`).join(", ")
      : "-";

    const qtyTotal = items.reduce((a, b) => a + Number(b.qty), 0);

    const status = order["Order Status"] || "Pending";
    const date = new Date(order.createdAt).toLocaleString();

    let btn = "";
    if (status === "Pending") {
      btn = `<button onclick="updateStatus('${trackingId}','Out for Delivery')" class="btn-blue">Out for Delivery</button>`;
    } else if (status === "Out for Delivery") {
      btn = `<button onclick="updateStatus('${trackingId}','Delivered')" class="btn-green">Mark Delivered</button>`;
    } else {
      btn = `<span class="text-gray-500">Done</span>`;
    }

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${date}</td>
      <td>${order.name}</td>
      <td>${order.phone}</td>
      <td>${itemsList}</td>
      <td>${qtyTotal}</td>
      <td>₹${order.totalAmount}</td>
      <td class="font-mono">${trackingId}</td>
      <td>${status}</td>
      <td>${btn}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ---------------- Update Status ----------------
async function updateStatus(trackingId, newStatus) {
  const res = await fetch("https://sweet-kaaram.onrender.com/update-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackingId, newStatus })
  });

  const data = await res.json();

  if (data.success) {

    currentOrders = currentOrders.map(o => {
      const tid =
        o["Tracking ID"] ||
        o.trackingId ||
        o.orderId;

      if (tid === trackingId) {
        o["Order Status"] = newStatus;
      }

      return o;
    });

    renderOrders();
  } else {
    alert("❌ Failed to update status");
  }
}

// ---------------- Socket.IO ----------------
const socket = io("https://sweet-kaaram.onrender.com");

socket.on("all-orders", orders => {
  currentOrders = orders;
  renderOrders();
});

socket.on("new-order", order => {
  currentOrders.push(order);
  renderOrders();
});

// ---------------- Fetch fallback ----------------
async function fetchOrders() {
  const res = await fetch("https://sweet-kaaram.onrender.com/api/orders");
  currentOrders = await res.json();
  renderOrders();
}

fetchOrders();
