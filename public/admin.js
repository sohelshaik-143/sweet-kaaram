const tbody = document.getElementById('ordersBody');
let currentOrders = [];

/* ---------------- Render Orders ---------------- */
function renderOrders(newOrderId = null) {
  tbody.innerHTML = '';

  currentOrders.slice().reverse().forEach((order, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b text-center hover:bg-gray-50';

    // Ensure Tracking ID exists
    const trackingId = order['Tracking ID'] ?? order.trackingId ?? 'UNKNOWN';
    if (trackingId === newOrderId) tr.classList.add('new-order');

    // Parse items safely
    let items = [];
    if (typeof order.items === 'string') {
      try { items = JSON.parse(order.items); } catch { items = []; }
    } else if (Array.isArray(order.items)) {
      items = order.items;
    }

    const itemsList = items.length
      ? items.map(i => `${i.name || 'Unnamed'} (${i.qty || 1} x ₹${i.price || 0})`).join(', ')
      : '-';

    const qtyTotal = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
    const totalAmount = order.totalAmount ?? items.reduce((sum, i) => sum + ((i.qty || 0) * (i.price || 0)), 0);

    const status = order['Order Status'] || 'Pending';
    const statusColor =
      status.toLowerCase() === 'delivered'
        ? 'text-green-600'
        : status.toLowerCase() === 'out for delivery'
        ? 'text-blue-600'
        : 'text-yellow-600';

    const dateDisplay = order.createdAt ? new Date(order.createdAt).toLocaleString() : '-';

    let actionBtn = '';
    if (status.toLowerCase() === 'pending') {
      actionBtn = `<button onclick="updateStatus('${trackingId}', 'Out for Delivery')" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition">Out for Delivery</button>`;
    } else if (status.toLowerCase() === 'out for delivery') {
      actionBtn = `<button onclick="updateStatus('${trackingId}', 'Delivered')" class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition">Mark Delivered</button>`;
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
      <td class="py-2 px-4 font-mono">${trackingId}</td>
      <td class="py-2 px-4 font-bold ${statusColor}">${status}</td>
      <td class="py-2 px-4">${actionBtn}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------------- Update Status ---------------- */
async function updateStatus(trackingId, newStatus) {
  try {
    const res = await fetch('/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingId, newStatus })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed');

    const index = currentOrders.findIndex(o => (o['Tracking ID'] ?? o.trackingId) === trackingId);
    if (index > -1) {
      currentOrders[index]['Order Status'] = newStatus;
      renderOrders(trackingId);
    }
  } catch (err) {
    console.error(err);
    alert('❌ Failed to update status');
  }
}

/* ---------------- Socket.IO ---------------- */
const socket = io();
socket.on('all-orders', orders => { currentOrders = orders; renderOrders(); });
socket.on('new-order', order => {
  // Ensure tracking ID exists
  if (!order['Tracking ID']) order['Tracking ID'] = order.trackingId ?? `SK${Date.now()}`;
  currentOrders.push(order);
  renderOrders(order['Tracking ID']);
});

/* ---------------- Fetch fallback ---------------- */
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    currentOrders = await res.json();
    // Fix missing tracking IDs
    currentOrders.forEach(o => {
      if (!o['Tracking ID']) o['Tracking ID'] = o.trackingId ?? `SK${Date.now()}`;
    });
    renderOrders();
  } catch (err) { console.error(err); }
}
fetchOrders();

/* ---------------- Add New Order ---------------- */
document.getElementById('addOrderForm').addEventListener('submit', async e => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const itemsInput = document.getElementById('items').value.trim();

  if (!name || !phone || !itemsInput) {
    alert('⚠ Please fill all fields!');
    return;
  }

  let items = [];
  try { items = JSON.parse(itemsInput); } catch {
    alert('❌ Invalid items JSON');
    return;
  }

  // Validate items
  items = items.map(i => ({
    name: i.name || 'Unnamed',
    qty: Number(i.qty) || 1,
    price: Number(i.price) || 0
  }));

  try {
    const res = await fetch('/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, items })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Order Placed! Tracking ID: ${data.orderId ?? 'SK'+Date.now()}`);
      document.getElementById('addOrderForm').reset();
    } else { alert('❌ Failed to place order'); }
  } catch (err) {
    console.error(err);
    alert('❌ Server error');
  }
});
