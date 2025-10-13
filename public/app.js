// Selectors
const qtyInputs = document.querySelectorAll('.qty');
const totalEl = document.getElementById('total');
const form = document.getElementById('orderForm');
const orderResult = document.getElementById('orderResult');
const historyEl = document.getElementById('orderHistory');
const trackBtn = document.getElementById('startTrack');
const trackInput = document.getElementById('trackId');
const trackResult = document.getElementById('trackResult');

// 1️⃣ Update Total
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

// 2️⃣ Place Order
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const items = [];
  qtyInputs.forEach(input => {
    const qty = parseInt(input.value);
    if(qty>0) items.push({
      name: input.closest('.item').dataset.name,
      qty,
      price: parseInt(input.closest('.item').dataset.price)
    });
  });
  if(items.length===0){
    orderResult.textContent = '⚠️ Select at least one item.';
    return;
  }

  const orderData = {
    name: form.name.value,
    gmail: form.gmail.value,
    phone: form.phone.value,
    address: form.address.value,
    persons: form.persons.value,
    total: parseInt(totalEl.textContent),
    items,
    orderId: Date.now(),
    status: 'Preparing'
  };

  try {
    const res = await fetch('/order', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(orderData)
    });
    if(res.ok){
      orderResult.textContent = `✅ Order placed! Your Order ID: ${orderData.orderId}`;
      form.reset();
      updateTotal();
      loadHistory();
    } else {
      orderResult.textContent = '❌ Failed to place order';
    }
  } catch(err){
    orderResult.textContent = '❌ Server error';
  }
});

// 3️⃣ Load Order History
async function loadHistory(){
  try{
    const res = await fetch('/all-orders');
    if(res.ok){
      const orders = await res.json();
      historyEl.innerHTML = '';
      orders.slice().reverse().forEach(o=>{
        const div = document.createElement('div');
        div.className = 'p-4 border rounded shadow';
        div.innerHTML = `
          <p class="font-semibold">Order ID: ${o.orderId}</p>
          <p>Name: ${o.name}, Phone: ${o.phone}</p>
          <p>Address: ${o.address}</p>
          <p>Persons: ${o.persons}, Total: ₹${o.total}</p>
          <p>Status: <span class="${o.status.toLowerCase()==='delivered'?'text-green-600': o.status.toLowerCase()==='out for delivery'?'text-blue-600':'text-yellow-600'} font-bold">${o.status}</span>, Placed on: ${o.timestamp}</p>
          <p>Items: ${o.items.map(i=>`${i.name} x${i.qty}`).join(', ')}</p>
        `;
        historyEl.appendChild(div);
      });
    }
  } catch(err){
    historyEl.textContent = 'Failed to load order history';
  }
}

// 4️⃣ Live Tracking
trackBtn.addEventListener('click', async () => {
  const id = trackInput.value.trim();
  if(!id){
    trackResult.textContent = '⚠️ Please enter a valid Order ID.';
    trackResult.className = 'text-yellow-600 font-semibold text-lg';
    return;
  }

  try{
    const res = await fetch(`/track/${id}`);
    if(res.ok){
      const data = await res.json();
      let colorClass = 'text-yellow-600';
      if(data.status.toLowerCase() === 'out for delivery') colorClass = 'text-blue-600';
      if(data.status.toLowerCase() === 'delivered') colorClass = 'text-green-600';

      trackResult.innerHTML = `
        📦 Order ${data.orderId} <br>
        Status: <span class="${colorClass} font-bold">${data.status}</span> <br>
        Placed on: ${data.timestamp}
      `;
    } else {
      trackResult.textContent = '❌ Order not found.';
      trackResult.className = 'text-red-600 font-semibold text-lg';
    }
  } catch(err){
    trackResult.textContent = '❌ Server error. Try again later.';
    trackResult.className = 'text-red-600 font-semibold text-lg';
  }
});

// Initial load
loadHistory();
updateTotal();
