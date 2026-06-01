import jwt from "jsonwebtoken";

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({ message: "Token topilmadi" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token yaroqsiz" });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Foydalanuvchi aniqlanmadi" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Ruxsat berilmagan" });
    }

    return next();
  };
}
