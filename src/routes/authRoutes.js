import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../config/db.js";

const router = express.Router();

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  role: z.enum(["super_admin", "admin", "cashier", "kitchen", "tv_display"]),
});

router.post("/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);

    const { rows } = await pool.query(
      "SELECT id, login, password_hash, role, restaurant_id FROM users WHERE login = $1 AND role = $2 LIMIT 1",
      [payload.login, payload.role]
    );

    if (!rows[0]) {
      return res.status(401).json({ message: "Login yoki parol noto'g'ri" });
    }

    const user = rows[0];
    const matched = await bcrypt.compare(payload.password, user.password_hash);

    if (!matched) {
      return res.status(401).json({ message: "Login yoki parol noto'g'ri" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        login: user.login,
        role: user.role,
        restaurantId: user.restaurant_id,
      },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        login: user.login,
        role: user.role,
        restaurantId: user.restaurant_id,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
