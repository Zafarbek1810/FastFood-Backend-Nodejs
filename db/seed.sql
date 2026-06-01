INSERT INTO restaurants (id, name, phone)
VALUES (1, 'Main Restaurant', '+998 90 123 45 67')
ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone;

INSERT INTO categories (id, name, restaurant_id)
VALUES
  (1, 'Ichimlik', 1),
  (2, 'Burger', 1),
  (3, 'Lavash', 1),
  (4, 'Pizza', 1),
  (5, 'Hot Dog', 1),
  (6, 'Salatlar', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, category_id, price, is_ready, restaurant_id)
VALUES
  (1, 'Coca Cola', 1, 8000, TRUE, 1),
  (2, 'Fanta', 1, 8000, TRUE, 1),
  (3, 'Sprite', 1, 8000, TRUE, 1),
  (4, 'Cheeseburger', 2, 25000, FALSE, 1),
  (5, 'Double Burger', 2, 32000, FALSE, 1),
  (6, 'Tovuq Lavash', 3, 22000, FALSE, 1),
  (7, 'Gosht Lavash', 3, 24000, FALSE, 1),
  (8, 'Pepperoni Pizza', 4, 45000, FALSE, 1),
  (9, 'Margarita Pizza', 4, 40000, FALSE, 1),
  (10, 'Hot Dog', 5, 18000, FALSE, 1),
  (11, 'Caesar Salat', 6, 20000, TRUE, 1)
ON CONFLICT (id) DO NOTHING;
