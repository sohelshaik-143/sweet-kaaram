// ========================
// Admin Dashboard JS
// ========================

const tbody = document.querySelector('#ordersTable tbody');
let currentOrders = [];

// ========================
// 🧾 Render Orders Table
// ========================
function renderOrders(orders) {
  tbody.innerHTML = '';

  orders.slice().reverse().forEach(order => {
    const tr = document.createElement('tr');

    const itemsList = order.items ? order.items.map(i => `${i.name} x${i.qty}`).join(', ') : '-';

    // Determine status and color
    const status = order.status || order['Order Status'] || 'Pending';
    let statusColor = 'text-yellow-600';
    if (status.toLowerCase() === 'out for delivery') statusColor = 'text-blue-600';
    if (status.toLowerCase() === 'delivered') statusColor = 'text-green-600';

    const dateDisplay = order.timestamp || order.createdAt
      ? new Date(order.timestamp || order.createdAt).toLocaleString()
      : '-';

    tr.innerHTML = `
      <td>${order.orderId || order['Tracking ID']}</td>
      <td>${order.name || order['Name']}</td>
      <td>${order.gmail || order['Gmail'] || '-'}</td>
      <td>${order.phone || order['Ph no'] || '-'}</td>
      <td>${order.address || '-'}</td>
      <td>${order.persons || '-'}</td>
      <td>${itemsList}</td>
      <td>${order.total || order['Amount'] || 0}</td>
      <td class="${statusColor} font-bold">${status}</td>
      <td>${dateDisplay}</td>
      <td>
        <select data-id="${order.orderId || order['Tracking ID']}">
          <option ${status === 'Preparing' || status === 'Pending' ? 'selected' : ''}>Preparing</option>
          <option ${status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
          <option ${status === 'Delivered' ? 'selected' : ''}>Delivered</option>
        </select>
      </td>
    `;

    tbody.appendChild(tr);
  });

  attachDropdownListeners();
}

// ========================
// 🎛 Attach Dropdown Listeners
// ========================
function attachDropdownListeners() {
  document.querySelectorAll('select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const newStatus = e.target.value;

      try {
        const res = await fetch('/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackingId: id, newStatus })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update status');

        // Update row color immediately
        const row = e.target.closest('tr');
        const statusCell = row.cells[8];
        statusCell.textContent = newStatus;
        statusCell.className = newStatus.toLowerCase() === 'delivered'
          ? 'text-green-600 font-bold'
          : newStatus.toLowerCase() === 'out for delivery'
          ? 'text-blue-600 font-bold'
          : 'text-yellow-600 font-bold';

      } catch (err) {
        console.error('Error updating status:', err);
        alert('❌ Failed to update status');
      }
    });
  });
}

// ========================
// 📡 Socket.IO Live Updates
// ========================
const socket = io();

// Load all orders initially
socket.on('all-orders', (orders) => {
  currentOrders = orders;
  renderOrders(currentOrders);
});

// New order received
socket.on('new-order', (order) => {
  currentOrders.push(order);
  renderOrders(currentOrders);
});

// Status updated by another admin
socket.on('update-status', (updatedOrder) => {
  const index = currentOrders.findIndex(o => o['Tracking ID'] === updatedOrder['Tracking ID']);
  if (index > -1) {
    currentOrders[index] = updatedOrder;
    renderOrders(currentOrders);
  }
});

// ========================
// 🌐 Fallback: Fetch Orders
// ========================
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    const orders = await res.json();
    currentOrders = orders;
    renderOrders(currentOrders);
  } catch (err) {
    console.error('Error fetching orders:', err);
  }
}

// Initial fetch
fetchOrders();
