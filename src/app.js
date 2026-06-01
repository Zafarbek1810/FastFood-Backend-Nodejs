import express from "express";
import cors from "cors";
import { pool } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import restaurantRoutes from "./routes/restaurantRoutes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Fast Food API ishlayapti",
    health: "/api/health",
    login: "POST /api/auth/login",
  });
});

app.get("/health", (req, res) => {
  res.redirect(307, "/api/health");
});

app.get("/api/health", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, message: "API ishlayapti" });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/restaurants", restaurantRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
