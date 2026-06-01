import express from "express";
import ExcelJS from "exceljs";
import { z } from "zod";
import { pool } from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { getNextOrderNumber } from "../utils/orderNumber.js";

const router = express.Router();

const createOrderSchema = z.object({
  type: z.enum(["zal", "dastavka", "saboy"]),
  items: z.array(
    z.object({
      productId: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().positive(),
    })
  ).min(1),
});

const updateStatusSchema = z.object({
  status: z.enum(["pending", "ready", "completed", "cancelled"]),
});

const orderHistoryQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  type: z.enum(["zal", "dastavka", "saboy"]).optional(),
  categoryIds: z
    .union([z.string(), z.array(z.coerce.number().int().positive())])
    .optional()
    .transform((value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      return value
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);
    }),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const ORDER_TYPE_LABELS = {
  zal: "Zal",
  dastavka: "Dastavka",
  saboy: "Saboy",
};

const ORDER_STATUS_LABELS = {
  pending: "Kutilmoqda",
  ready: "Tayyor",
  completed: "Yakunlangan",
  cancelled: "Bekor qilingan",
};

function parseDateBoundary(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

function buildOrderHistoryFilters(query) {
  const filters = orderHistoryQuerySchema.parse(query);
  const dateFrom = parseDateBoundary(filters.dateFrom);
  const dateTo = parseDateBoundary(filters.dateTo, true);
  const offset = (filters.page - 1) * filters.limit;

  const conditions = ["o.restaurant_id = $1"];
  const params = [null];
  let paramIndex = 2;

  if (dateFrom) {
    conditions.push(`o.created_at >= $${paramIndex}`);
    params.push(dateFrom);
    paramIndex += 1;
  }

  if (dateTo) {
    conditions.push(`o.created_at <= $${paramIndex}`);
    params.push(dateTo);
    paramIndex += 1;
  }

  if (filters.type) {
    conditions.push(`o.type = $${paramIndex}`);
    params.push(filters.type);
    paramIndex += 1;
  }

  if (filters.categoryIds.length) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = o.id AND p.category_id = ANY($${paramIndex}::int[])
    )`);
    params.push(filters.categoryIds);
    paramIndex += 1;
  }

  return {
    filters,
    whereClause: conditions.join(" AND "),
    params,
    offset,
    limit: filters.limit,
  };
}

async function fetchFilteredOrders(restaurantId, query, { paginate = true } = {}) {
  const { filters, whereClause, params, offset, limit } = buildOrderHistoryFilters(query);
  params[0] = restaurantId;

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM orders o
    WHERE ${whereClause}
  `;
  const { rows: countRows } = await pool.query(countQuery, params);
  const total = countRows[0]?.total || 0;

  let ordersQuery = `
    SELECT o.id, o.order_number AS "orderNumber", o.type, o.status, o.total, o.created_at AS "createdAt"
    FROM orders o
    WHERE ${whereClause}
    ORDER BY o.created_at DESC
  `;

  const orderParams = [...params];
  if (paginate) {
    ordersQuery += ` LIMIT $${orderParams.length + 1} OFFSET $${orderParams.length + 2}`;
    orderParams.push(limit, offset);
  }

  const { rows } = await pool.query(ordersQuery, orderParams);
  const orderIds = rows.map((order) => order.id);
  const itemsMap = await getOrderItemsByOrderIds(orderIds);

  const orders = rows.map((order) => ({
    id: String(order.id),
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    total: Number(order.total),
    createdAt: order.createdAt,
    items: itemsMap.get(String(order.id)) || [],
  }));

  return {
    orders,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: paginate ? Math.max(1, Math.ceil(total / filters.limit)) : 1,
  };
}

function formatOrderItems(items) {
  return items.map((item) => `${item.name} x${item.quantity}`).join(", ");
}

async function buildOrdersWorkbook(orders) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Buyurtmalar");

  sheet.columns = [
    { header: "Buyurtma raqami", key: "orderNumber", width: 16 },
    { header: "Sana va vaqt", key: "createdAt", width: 22 },
    { header: "Tur", key: "type", width: 14 },
    { header: "Holat", key: "status", width: 18 },
    { header: "Mahsulotlar", key: "items", width: 48 },
    { header: "Jami (so'm)", key: "total", width: 16 },
  ];

  sheet.getRow(1).font = { bold: true };

  for (const order of orders) {
    sheet.addRow({
      orderNumber: order.orderNumber,
      createdAt: new Date(order.createdAt).toLocaleString("uz-UZ"),
      type: ORDER_TYPE_LABELS[order.type] || order.type,
      status: ORDER_STATUS_LABELS[order.status] || order.status,
      items: formatOrderItems(order.items),
      total: order.total,
    });
  }

  return workbook;
}

async function getOrderItemsByOrderIds(orderIds) {
  if (!orderIds.length) {
    return new Map();
  }

  const { rows } = await pool.query(
    `SELECT oi.order_id AS "orderId", oi.product_id AS "productId", oi.product_name AS "name", oi.price, oi.quantity, oi.is_ready AS "isReady",
            p.image
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE order_id = ANY($1::int[])`,
    [orderIds]
  );

  const map = new Map();
  for (const row of rows) {
    const key = String(row.orderId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push({
      id: String(row.productId),
      name: row.name,
      price: Number(row.price),
      quantity: row.quantity,
      image: row.image,
      isReady: row.isReady,
    });
  }
  return map;
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, order_number AS "orderNumber", type, status, total, created_at AS "createdAt"
       FROM orders
       WHERE restaurant_id = $1
       ORDER BY created_at DESC`,
      [req.user.restaurantId]
    );
    const orderIds = rows.map((order) => order.id);
    const itemsMap = await getOrderItemsByOrderIds(orderIds);

    const result = rows.map((order) => ({
      id: String(order.id),
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt,
      items: itemsMap.get(String(order.id)) || [],
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/history", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const result = await fetchFilteredOrders(req.user.restaurantId, req.query, { paginate: true });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/export", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const { orders } = await fetchFilteredOrders(req.user.restaurantId, req.query, { paginate: false });
    const workbook = await buildOrdersWorkbook(orders);
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="buyurtmalar.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const payload = createOrderSchema.parse(req.body);
    await client.query("BEGIN");

    const productIds = payload.items.map((item) => item.productId);
    const { rows: products } = await client.query(
      "SELECT id, name, price, is_ready, image FROM products WHERE restaurant_id = $1 AND id = ANY($2::int[])",
      [req.user.restaurantId, productIds]
    );

    if (products.length !== productIds.length) {
      return res.status(400).json({ message: "Ba'zi mahsulotlar topilmadi" });
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const total = payload.items.reduce((sum, item) => {
      const product = productMap.get(item.productId);
      return sum + Number(product.price) * item.quantity;
    }, 0);

    await client.query("SELECT pg_advisory_xact_lock($1)", [req.user.restaurantId]);

    const { rows: lastNumberRows } = await client.query(
      `SELECT COALESCE(MAX(order_number), 0)::int AS last
       FROM orders
       WHERE restaurant_id = $1`,
      [req.user.restaurantId]
    );
    const orderNumber = getNextOrderNumber(lastNumberRows[0].last);

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (restaurant_id, type, status, total, order_number)
       VALUES ($1, $2, 'pending', $3, $4)
       RETURNING id, order_number AS "orderNumber", type, status, total, created_at AS "createdAt"`,
      [req.user.restaurantId, payload.type, total, orderNumber]
    );

    const createdOrder = orderRows[0];

    const responseItems = [];
    for (const item of payload.items) {
      const product = productMap.get(item.productId);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, is_ready)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [createdOrder.id, item.productId, product.name, product.price, item.quantity, product.is_ready]
      );
      responseItems.push({
        id: String(item.productId),
        name: product.name,
        price: Number(product.price),
        quantity: item.quantity,
        image: product.image,
        isReady: product.is_ready,
      });
    }

    await client.query("COMMIT");

    res.status(201).json({
      id: String(createdOrder.id),
      orderNumber: createdOrder.orderNumber,
      type: createdOrder.type,
      status: createdOrder.status,
      total: Number(createdOrder.total),
      createdAt: createdOrder.createdAt,
      items: responseItems,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

router.patch("/:id/status", authenticate, async (req, res, next) => {
  try {
    const payload = updateStatusSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE orders
       SET status = $1
       WHERE id = $2 AND restaurant_id = $3
       RETURNING id, order_number AS "orderNumber", type, status, total, created_at AS "createdAt"`,
      [payload.status, req.params.id, req.user.restaurantId]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Buyurtma topilmadi" });
    }

    res.json({
      ...rows[0],
      id: String(rows[0].id),
      total: Number(rows[0].total),
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/cancel", authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE orders
       SET status = 'cancelled'
       WHERE id = $1 AND restaurant_id = $2
       RETURNING id, order_number AS "orderNumber", type, status, total, created_at AS "createdAt"`,
      [req.params.id, req.user.restaurantId]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Buyurtma topilmadi" });
    }

    res.json({
      ...rows[0],
      id: String(rows[0].id),
      total: Number(rows[0].total),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
