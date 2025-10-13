// Return all orders (for admin panel)
app.get('/all-orders', (req, res) => {
  const orders = readOrders();
  res.json(orders);
});
