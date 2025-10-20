// ========================
// Admin Dashboard JS
// ========================

const tbody = document.getElementById('ordersBody');
let currentOrders = [];

// ========================
// 🧾 Render Orders Table
// ========================
function renderOrders(newOrderId = null) {
  tbody.innerHTML = '';

  // Show newest orders first
  currentOrders.slice().reverse().forEach((order, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b text-center hover:bg-gray-50';
    if (order['Tracking ID'] === newOrderId) tr.classList.add('new-order');

    // Items display with qty x price
    const itemsList = Array.isArray(order.items) && order.items.length
      ? order.items.map(i => `${i.name} (${i.qty} x ₹${i.price})`).join(', ')
      : '-';

    // Total qty
    const qtyTotal = Array.isArray(order.items)
      ? order.items.reduce((sum, i) => sum + (i.qty || 0), 0)
      : 0;

    // Total amount
    const totalAmount = order.totalAmount ?? (Array.isArray(order.items)
      ? order.items.reduce((sum, i) => sum + ((i.price || 0) * (i.qty || 0)), 0)
      : 0);

    // Status & color
    const status = order['Order Status'] || 'Pending';
    const statusLower = status.toLowerCase();
    const statusColor =
      statusLower === 'delivered' ? 'text-green-600' :
      statusLower === 'out for delivery' ? 'text-blue-600' :
      'text-yellow-600';

    // Date display
    const dateDisplay = order.createdAt ? new Date(order.createdAt).toLocaleString() : '-';

    // Action buttons
    let actionBtn = '';
    if (statusLower === 'pending') {
      actionBtn = `<button onclick="updateStatus('${order['Tracking ID']}','Out for Delivery')" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition">Out for Delivery</button>`;
    } else if (statusLower === 'out for delivery') {
      actionBtn = `<button onclick="updateStatus('${order['Tracking ID']}','Delivered')" class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition">Mark Delivered</button>`;
    } else {
      actionBtn = `<span class="text-gray-500">✅ Done</span>`;
    }

    tr.innerHTML = `
      <td class="py-2 px-4">${index + 1}</td>
      <td class="py-2 px-4">${dateDisplay}</td>
      <td class="py-2 px-4">${order.name || '-'}</td>
      <td class="py-2 px-4">${order.phone || '-'}</td>
      <td class="py-2 px-4">${itemsList}</td>
      <td class="py-2 px-4">${qtyTotal}</td>
      <td class="py-2 px-4">₹${totalAmount}</td>
      <td class="py-2 px-4 font-mono">${order['Tracking ID'] || '-'}</td>
      <td class="py-2 px-4 font-bold ${statusColor}">${status}</td>
      <td class="py-2 px-4">${actionBtn}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ========================
// ⚡ Update Status
// ========================
async function updateStatus(trackingId, newStatus) {
  try {
    const res = await fetch('/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingId, newStatus })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update status');

    // Update locally
    const orderIndex = currentOrders.findIndex(o => o['Tracking ID'] === trackingId);
    if (orderIndex > -1) {
      currentOrders[orderIndex]['Order Status'] = newStatus;
      renderOrders(trackingId);
    }
  } catch (err) {
    console.error('Error updating status:', err);
    alert('❌ Failed to update status');
  }
}

// ========================
// 📡 Socket.IO Live Updates
// ========================
const socket = io();

socket.on('all-orders', (orders) => {
  currentOrders = orders;
  renderOrders();
});

socket.on('new-order', (order) => {
  currentOrders.push(order);
  renderOrders(order['Tracking ID']);
});

// ========================
// 🌐 Fetch Orders (Fallback)
// ========================
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    const orders = await res.json();
    currentOrders = orders;
    renderOrders();
  } catch (err) {
    console.error('Error fetching orders:', err);
  }
}

// Initial fetch
fetchOrders();
