import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

const roleSchema = z.enum(["cashier", "kitchen", "tv_display"]);

const createStaffSchema = z.object({
  login: z.string().min(3),
  password: z.string().min(3),
  role: roleSchema,
});

const updateStaffSchema = z.object({
  login: z.string().min(3),
  role: roleSchema,
  password: z.string().min(3).optional(),
});

router.get("/", authenticate, authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, login, role
       FROM users
       WHERE restaurant_id = $1 AND role IN ('cashier', 'kitchen', 'tv_display')
       ORDER BY id ASC`,
      [req.user.restaurantId]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const payload = createStaffSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (login, password_hash, role, restaurant_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, login, role`,
      [payload.login, passwordHash, payload.role, req.user.restaurantId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authenticate, authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const payload = updateStaffSchema.parse(req.body);
    const values = [payload.login, payload.role, req.params.id, req.user.restaurantId];
    let query = `UPDATE users
                 SET login = $1, role = $2
                 WHERE id = $3 AND restaurant_id = $4 AND role IN ('cashier', 'kitchen', 'tv_display')
                 RETURNING id, login, role`;

    if (payload.password) {
      const passwordHash = await bcrypt.hash(payload.password, 10);
      values.splice(2, 0, passwordHash);
      query = `UPDATE users
               SET login = $1, password_hash = $2, role = $3
               WHERE id = $4 AND restaurant_id = $5 AND role IN ('cashier', 'kitchen', 'tv_display')
               RETURNING id, login, role`;
    }

    const { rows } = await pool.query(query, values);
    if (!rows[0]) {
      return res.status(404).json({ message: "Xodim topilmadi" });
    }
    return res.json(rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", authenticate, authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM users
       WHERE id = $1 AND restaurant_id = $2 AND role IN ('cashier', 'kitchen', 'tv_display')`,
      [req.params.id, req.user.restaurantId]
    );
    if (!rowCount) {
      return res.status(404).json({ message: "Xodim topilmadi" });
    }
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
