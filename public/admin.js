const tbody = document.querySelector('#ordersTable tbody');

// Fetch all orders
async function fetchOrders() {
  try {
    const res = await fetch('/all-orders');
    const data = await res.json();
    tbody.innerHTML = '';

    data.forEach(order => {
      const tr = document.createElement('tr');

      const itemsList = order.items.map(i => `${i.name} x${i.qty}`).join(', ');

      tr.innerHTML = `
        <td>${order.orderId}</td>
        <td>${order.name}</td>
        <td>${order.gmail}</td>
        <td>${order.phone}</td>
        <td>${order.address}</td>
        <td>${order.persons}</td>
        <td>${itemsList}</td>
        <td>${order.total}</td>
        <td>${order.status}</td>
        <td>${order.timestamp}</td>
        <td>
          <select data-id="${order.orderId}">
            <option ${order.status==='Preparing'?'selected':''}>Preparing</option>
            <option ${order.status==='Out for Delivery'?'selected':''}>Out for Delivery</option>
            <option ${order.status==='Delivered'?'selected':''}>Delivered</option>
          </select>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Add event listener for all dropdowns
    document.querySelectorAll('select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const orderId = e.target.dataset.id;
        const status = e.target.value;
        await fetch('/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, status })
        });
        fetchOrders(); // Refresh table
      });
    });

  } catch (err) {
    console.error('Error fetching orders:', err);
  }
}

fetchOrders();
