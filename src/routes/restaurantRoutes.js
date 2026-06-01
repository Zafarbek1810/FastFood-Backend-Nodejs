import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

const staffRoles = ["admin", "cashier", "kitchen", "tv_display"];
const superAdminOnly = [authenticate, authorize("super_admin")];

router.get("/me", authenticate, authorize(...staffRoles), async (req, res, next) => {
  try {
    if (!req.user.restaurantId) {
      return res.status(404).json({ message: "Restoran topilmadi" });
    }

    const { rows } = await pool.query(
      "SELECT id, name, phone FROM restaurants WHERE id = $1",
      [req.user.restaurantId]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Restoran topilmadi" });
    }

    return res.json(rows[0]);
  } catch (error) {
    return next(error);
  }
});

const statusSchema = z.enum(["active", "blocked"]);

const createRestaurantSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  adminLogin: z.string().min(3),
  adminPassword: z.string().min(3),
  status: statusSchema.default("active"),
});

const updateRestaurantSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  adminLogin: z.string().min(3),
  adminPassword: z.string().min(3).optional(),
  status: statusSchema,
});

router.get("/", ...superAdminOnly, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.name, r.phone, r.status, u.login AS "adminLogin"
       FROM restaurants r
       LEFT JOIN users u ON u.restaurant_id = r.id AND u.role = 'admin'
       ORDER BY r.id ASC`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post("/", ...superAdminOnly, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const payload = createRestaurantSchema.parse(req.body);
    await client.query("BEGIN");

    const { rows: restaurantRows } = await client.query(
      `INSERT INTO restaurants (name, phone, status)
       VALUES ($1, $2, $3)
       RETURNING id, name, phone, status`,
      [payload.name, payload.phone, payload.status]
    );
    const restaurant = restaurantRows[0];

    const passwordHash = await bcrypt.hash(payload.adminPassword, 10);
    await client.query(
      `INSERT INTO users (login, password_hash, role, restaurant_id)
       VALUES ($1, $2, 'admin', $3)`,
      [payload.adminLogin, passwordHash, restaurant.id]
    );

    await client.query("COMMIT");
    res.status(201).json({ ...restaurant, adminLogin: payload.adminLogin });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "Bu login allaqachon mavjud" });
    }
    return next(error);
  } finally {
    client.release();
  }
});

router.patch("/:id", ...superAdminOnly, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const payload = updateRestaurantSchema.parse(req.body);
    await client.query("BEGIN");

    const { rows: restaurantRows } = await client.query(
      `UPDATE restaurants
       SET name = $1, phone = $2, status = $3
       WHERE id = $4
       RETURNING id, name, phone, status`,
      [payload.name, payload.phone, payload.status, req.params.id]
    );

    if (!restaurantRows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Restoran topilmadi" });
    }

    const { rows: adminRows } = await client.query(
      `SELECT id FROM users WHERE restaurant_id = $1 AND role = 'admin' LIMIT 1`,
      [req.params.id]
    );

    if (adminRows[0]) {
      if (payload.adminPassword) {
        const passwordHash = await bcrypt.hash(payload.adminPassword, 10);
        await client.query(
          `UPDATE users SET login = $1, password_hash = $2 WHERE id = $3`,
          [payload.adminLogin, passwordHash, adminRows[0].id]
        );
      } else {
        await client.query(`UPDATE users SET login = $1 WHERE id = $2`, [
          payload.adminLogin,
          adminRows[0].id,
        ]);
      }
    } else {
      const passwordHash = await bcrypt.hash(payload.adminPassword || "123456", 10);
      await client.query(
        `INSERT INTO users (login, password_hash, role, restaurant_id)
         VALUES ($1, $2, 'admin', $3)`,
        [payload.adminLogin, passwordHash, req.params.id]
      );
    }

    await client.query("COMMIT");
    return res.json({ ...restaurantRows[0], adminLogin: payload.adminLogin });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "Bu login allaqachon mavjud" });
    }
    return next(error);
  } finally {
    client.release();
  }
});

router.delete("/:id", ...superAdminOnly, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM users WHERE restaurant_id = $1", [req.params.id]);
    const { rowCount } = await client.query("DELETE FROM restaurants WHERE id = $1", [
      req.params.id,
    ]);
    await client.query("COMMIT");

    if (!rowCount) {
      return res.status(404).json({ message: "Restoran topilmadi" });
    }
    return res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

export default router;
