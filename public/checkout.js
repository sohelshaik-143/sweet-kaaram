// ==========================
//    CHECKOUT PAGE SCRIPT
// ==========================

// Get items from menu
function getSelectedItems() {
  const items = [];

  document.querySelectorAll(".menu-item").forEach(card => {
    const qty = Number(card.querySelector(".qty-input").value) || 0;

    if (qty > 0) {
      const name = card.querySelector(".item-name").innerText.trim();
      const price = Number(card.querySelector(".item-price").dataset.price);

      items.push({
        name,
        qty,
        price
      });
    }
  });

  return items;
}

// Place Order
document.getElementById("orderForm").addEventListener("submit", async e => {
  e.preventDefault();

  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const address = document.getElementById("custAddress").value.trim();

  const items = getSelectedItems();

  if (items.length === 0) {
    alert("⚠ Please select at least one item");
    return;
  }

  const res = await fetch("/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone, address, items })
  });

  const data = await res.json();
  if (data.success) {
    document.getElementById("successBox").innerHTML =
      `✅ Order Placed! Tracking ID: ${data.orderId}`;
  } else {
    alert("❌ Failed to place order");
  }
});
