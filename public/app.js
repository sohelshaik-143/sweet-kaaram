// ========================
// 📦 Selectors
// ========================
const qtyInputs = document.querySelectorAll('.qty');
const totalEl = document.getElementById('total');
const form = document.getElementById('orderForm');
const orderResult = document.getElementById('orderResult');
const historyEl = document.getElementById('orderHistory');
const trackBtn = document.getElementById('startTrack');
const trackInput = document.getElementById('trackId');
const trackResult = document.getElementById('trackResult');

// ========================
// 💰 1️⃣ Update Total
// ========================
function updateTotal() {
  let total = 0;
  qtyInputs.forEach(input => {
    const price = parseInt(input.closest('.item').dataset.price);
    const qty = parseInt(input.value) || 0;
    total += price * qty;
  });
  totalEl.textContent = total;
}
qtyInputs.forEach(input => input.addEventListener('input', updateTotal));

// ========================
// 📝 2️⃣ Place Order
// ========================
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const items = [];
  qtyInputs.forEach(input => {
    const qty = parseInt(input.value);
    if (qty > 0) {
      items.push({
        name: input.closest('.item').dataset.name,
        qty,
        price: parseInt(input.closest('.item').dataset.price)
      });
    }
  });

  if (items.length === 0) {
    orderResult.textContent = '⚠️ Please select at least one item.';
    orderResult.className = 'text-red-600 font-semibold';
    return;
  }

  const orderData = {
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    address: form.address.value.trim(),
    persons: form.persons.value.trim(),
    total: parseInt(totalEl.textContent),
    items
  };

  try {
    const res = await fetch('/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    const data = await res.json();
    if (res.ok) {
      orderResult.textContent = `✅ Order placed successfully!`;
      orderResult.className = 'text-green-600 font-semibold';
      form.reset();
      updateTotal();
      loadHistory();
    } else {
      orderResult.textContent = `❌ ${data.message || 'Failed to place order'}`;
      orderResult.className = 'text-red-600 font-semibold';
    }
  } catch (err) {
    console.error(err);
    orderResult.textContent = '❌ Server error. Try again later.';
    orderResult.className = 'text-red-600 font-semibold';
  }
});

// ========================
// 📜 3️⃣ Load Order History
// ========================
async function loadHistory() {
  try {
    const res = await fetch('/api/orders');
    if (res.ok) {
      const orders = await res.json();
      historyEl.innerHTML = '';

      orders.slice().reverse().forEach(o => {
        const div = document.createElement('div');
        div.className = 'p-4 border rounded shadow bg-white mb-4';

        const status = o['Order Status'] || o.status || 'Pending';
        const statusLower = status.toLowerCase();
        const statusColor =
          statusLower === 'delivered' ? 'text-green-600' :
          statusLower === 'out for delivery' ? 'text-blue-600' :
          'text-yellow-600';

        const trackingId = o['Tracking ID'] || o.trackingId || 'N/A';
        const timestamp = o['Date'] || (o.createdAt ? new Date(o.createdAt).toLocaleString() : '-');

        div.innerHTML = `
          <p class="font-semibold">📦 Order ID: ${trackingId}</p>
          <p><strong>Name:</strong> ${o.name || o['Name'] || '-'} | <strong>Phone:</strong> ${o.phone || o['Ph no'] || '-'}</p>
          <p><strong>Address:</strong> ${o.address || o['Address'] || '-'}</p>
          <p><strong>Persons:</strong> ${o.persons || '-'} | <strong>Total:</strong> ₹${o.total || o['Amount'] || 0}</p>
          <p><strong>Status:</strong> <span class="${statusColor} font-bold">${status}</span> | <strong>Placed on:</strong> ${timestamp}</p>
          <p><strong>Items:</strong> ${
            (o.items || [])
              .map(i => `${i.name} x${i.qty}`)
              .join(', ')
          }</p>
        `;
        historyEl.appendChild(div);
      });
    } else {
      historyEl.textContent = '❌ Failed to load orders.';
    }
  } catch (err) {
    console.error(err);
    historyEl.textContent = '❌ Server error while loading orders.';
  }
}

// ========================
// 🚚 4️⃣ Live Tracking
// ========================
trackBtn.addEventListener('click', async () => {
  const id = trackInput.value.trim();
  if (!id) {
    trackResult.textContent = '⚠️ Please enter a valid Order ID.';
    trackResult.className = 'text-yellow-600 font-semibold text-lg';
    return;
  }

  try {
    const res = await fetch(`/track/${id}`);
    if (res.ok) {
      const data = await res.json();
      let colorClass = 'text-yellow-600';
      const status = data.status || 'Pending';
      if (status.toLowerCase() === 'out for delivery') colorClass = 'text-blue-600';
      if (status.toLowerCase() === 'delivered') colorClass = 'text-green-600';

      trackResult.innerHTML = `
        📦 Order ${data.orderId || id}<br>
        Status: <span class="${colorClass} font-bold">${status}</span><br>
        Placed on: ${data.timestamp}
      `;
    } else {
      trackResult.textContent = '❌ Order not found.';
      trackResult.className = 'text-red-600 font-semibold text-lg';
    }
  } catch (err) {
    console.error(err);
    trackResult.textContent = '❌ Server error.';
    trackResult.className = 'text-red-600 font-semibold text-lg';
  }
});

// ========================
// 🚀 Initial Load
// ========================
loadHistory();
updateTotal();
