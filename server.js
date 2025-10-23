const tbody = document.getElementById('ordersBody');
let currentOrders = [];

function renderOrders(newOrderId = null) {
  tbody.innerHTML = '';
  currentOrders.slice().reverse().forEach((order, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b text-center hover:bg-gray-50';
    if ((order['Tracking ID'] ?? order.trackingId) === newOrderId) tr.classList.add('new-order');

    let items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items ?? [];
    const itemsList = items.length ? items.map(i => `${i.name} (${i.qty} x ₹${i.price})`).join(', ') : '-';
    const qtyTotal = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
    const totalAmount = order.totalAmount ?? items.reduce((sum, i) => sum + ((i.qty || 0) * (i.price || 0)), 0);

    const status = order['Order Status'] || 'Pending';
    const statusColor = status.toLowerCase() === 'delivered' ? 'text-green-600' : status.toLowerCase() === 'out for delivery' ? 'text-blue-600' : 'text-yellow-600';
    const dateDisplay = order.createdAt ? new Date(order.createdAt).toLocaleString() : '-';

    let actionBtn = '';
    if (status.toLowerCase() === 'pending') actionBtn = `<button onclick="updateStatus('${order['Tracking ID'] ?? order.trackingId}','Out for Delivery')" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition">Out for Delivery</button>`;
    else if (status.toLowerCase() === 'out for delivery') actionBtn = `<button onclick="updateStatus('${order['Tracking ID'] ?? order.trackingId}','Delivered')" class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition">Mark Delivered</button>`;
    else actionBtn = `<span class="text-gray-500">✅ Done</span>`;

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${dateDisplay}</td>
      <td>${order.name || '-'}</td>
      <td>${order.phone || '-'}</td>
      <td>${itemsList}</td>
      <td>${qtyTotal}</td>
      <td>₹${totalAmount}</td>
      <td>${order['Tracking ID'] ?? order.trackingId ?? '-'}</td>
      <td class="${statusColor}">${status}</td>
      <td>${actionBtn}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function updateStatus(trackingId, newStatus) {
  try {
    const res = await fetch('/update-status', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({trackingId,newStatus}) });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed');
    const index = currentOrders.findIndex(o => (o['Tracking ID'] ?? o.trackingId) === trackingId);
    if (index > -1) { currentOrders[index]['Order Status'] = newStatus; renderOrders(trackingId); }
  } catch(err) { console.error(err); alert('❌ Failed to update status'); }
}

const socket = io();
socket.on('all-orders', orders => { currentOrders = orders; renderOrders(); });
socket.on('new-order', order => { currentOrders.push(order); renderOrders(order['Tracking ID'] ?? order.trackingId); });

document.getElementById('addOrderForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const itemsInput = document.getElementById('items').value.trim();
  if (!name || !phone || !itemsInput) { alert('⚠ Please fill all fields!'); return; }

  let items = [];
  try { items = JSON.parse(itemsInput); } catch { alert('❌ Invalid items JSON'); return; }

  try {
    const res = await fetch('/order', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,phone,items}) });
    const data = await res.json();
    if (data.success) { alert(`✅ Order Placed! Tracking ID: ${data.orderId ?? 'UNKNOWN'}`); document.getElementById('addOrderForm').reset(); }
    else alert('❌ Failed to place order');
  } catch(err) { console.error(err); alert('❌ Server error'); }
});
