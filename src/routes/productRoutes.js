import express from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

const createProductSchema = z.object({
  name: z.string().min(1),
  categoryId: z.coerce.number().int().positive(),
  price: z.coerce.number().positive(),
  image: z.string().optional(),
  isReady: z.boolean().default(false),
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.category_id AS "categoryId", p.price, p.image, p.is_ready AS "isReady"
       FROM products p
       WHERE p.restaurant_id = $1
       ORDER BY p.id ASC`,
      [req.user.restaurantId]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const payload = createProductSchema.parse(req.body);

    const { rows } = await pool.query(
      `INSERT INTO products (name, category_id, price, image, is_ready, restaurant_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, category_id AS "categoryId", price, image, is_ready AS "isReady"`,
      [
        payload.name,
        payload.categoryId,
        payload.price,
        payload.image || null,
        payload.isReady,
        req.user.restaurantId,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authenticate, authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const payload = createProductSchema.parse(req.body);

    const { rows } = await pool.query(
      `UPDATE products
       SET name = $1, category_id = $2, price = $3, image = $4, is_ready = $5
       WHERE id = $6 AND restaurant_id = $7
       RETURNING id, name, category_id AS "categoryId", price, image, is_ready AS "isReady"`,
      [
        payload.name,
        payload.categoryId,
        payload.price,
        payload.image || null,
        payload.isReady,
        req.params.id,
        req.user.restaurantId,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    return res.json(rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", authenticate, authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM products WHERE id = $1 AND restaurant_id = $2", [
      req.params.id,
      req.user.restaurantId,
    ]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
