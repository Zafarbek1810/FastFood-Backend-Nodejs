export function notFound(req, res) {
  res.status(404).json({ message: "Endpoint topilmadi" });
}

export function errorHandler(error, req, res, next) {
  const status = error.status || 500;
  const message = error.message || "Server xatosi";

  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }

  res.status(status).json({ message });
}
