const tbody = document.getElementById('ordersBody');
let currentOrders = [];

// ========================
// Render Orders Table
// ========================
function renderOrders(newOrderId = null) {
  tbody.innerHTML = '';

  currentOrders.slice().reverse().forEach((order, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b text-center hover:bg-gray-50';
    if (order['Tracking ID'] === newOrderId) tr.classList.add('new-order');

    const itemsList = Array.isArray(order.items) && order.items.length
      ? order.items.map(i => `${i.name} (${i.qty} x ₹${i.price})`).join(', ')
      : '-';

    const qtyTotal = Array.isArray(order.items)
      ? order.items.reduce((sum, i) => sum + (i.qty || 0), 0)
      : 0;

    const totalAmount = order.totalAmount ?? (Array.isArray(order.items)
      ? order.items.reduce((sum, i) => sum + ((i.price || 0) * (i.qty || 0)), 0)
      : 0);

    const status = order['Order Status'] || 'Pending';
    const statusLower = status.toLowerCase();
    const statusColor =
      statusLower === 'delivered' ? 'text-green-600' :
      statusLower === 'out for delivery' ? 'text-blue-600' :
      'text-yellow-600';

    const dateDisplay = order.createdAt ? new Date(order.createdAt).toLocaleString() : '-';

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
// Update Order Status
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

    const index = currentOrders.findIndex(o => o['Tracking ID'] === trackingId);
    if (index > -1) {
      currentOrders[index]['Order Status'] = newStatus;
      renderOrders(trackingId);
    }
  } catch (err) {
    console.error(err);
    alert('❌ Failed to update status');
  }
}

// ========================
// Socket.IO Live Updates
// ========================
const socket = io();

socket.on('all-orders', orders => {
  currentOrders = orders;
  renderOrders();
});

socket.on('new-order', order => {
  currentOrders.push(order);
  renderOrders(order['Tracking ID']);
});

// ========================
// Fallback: Fetch Orders
// ========================
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    currentOrders = await res.json();
    renderOrders();
  } catch (err) {
    console.error(err);
  }
}

fetchOrders();

// ========================
// Add Order Form Handling
// ========================
document.getElementById('addOrderForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  let items = [];
  try { items = JSON.parse(document.getElementById('items').value); } 
  catch { alert('❌ Invalid items JSON'); return; }

  try {
    const res = await fetch('/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, items })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Order Placed! Tracking ID: ${data.trackingId}`);
      document.getElementById('addOrderForm').reset();
    } else alert('❌ Failed to place order');
  } catch (err) {
    console.error(err);
    alert('❌ Server error');
  }
});
