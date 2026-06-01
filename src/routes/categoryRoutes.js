import express from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

const createCategorySchema = z.object({
  name: z.string().min(1),
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name FROM categories WHERE restaurant_id = $1 ORDER BY id ASC",
      [req.user.restaurantId]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const payload = createCategorySchema.parse(req.body);
    const { rows } = await pool.query(
      "INSERT INTO categories (name, restaurant_id) VALUES ($1, $2) RETURNING id, name",
      [payload.name, req.user.restaurantId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authenticate, authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const payload = createCategorySchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE categories
       SET name = $1
       WHERE id = $2 AND restaurant_id = $3
       RETURNING id, name`,
      [payload.name, req.params.id, req.user.restaurantId]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Kategoriya topilmadi" });
    }

    return res.json(rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", authenticate, authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM categories WHERE id = $1 AND restaurant_id = $2", [
      req.params.id,
      req.user.restaurantId,
    ]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
