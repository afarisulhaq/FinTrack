import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET ?? "fintrack-dev-secret";
export function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
export function extractToken(authorization) {
    if (!authorization)
        return null;
    return authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : authorization;
}
