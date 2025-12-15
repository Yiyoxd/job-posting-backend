// middlewares/authActor.js
import jwt from "jsonwebtoken";

/**
 * authActor(options)
 *
 * - required=false: no exige token; si viene lo valida y llena req.actor.
 * - required=true: exige token válido.
 * - roles: lista de tipos permitidos ("admin", "company", "candidate")
 *
 * req.actor:
 *   {
 *     user_id: number,
 *     type: "admin" | "company" | "candidate",
 *     company_id?: number,
 *     candidate_id?: number
 *   }
 */
export function authActor(options = {}) {
    const { required = true, roles = null } = options;

    return function authActorMiddleware(req, res, next) {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ")
            ? header.slice(7).trim()
            : null;

        if (!token) {
            req.actor = null;

            if (required) {
                return res.status(401).json({
                    error: "UNAUTHORIZED",
                    message: "Missing Authorization: Bearer <token>",
                });
            }
            return next();
        }

        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return res.status(500).json({
                    error: "SERVER_MISCONFIG",
                    message: "JWT_SECRET is not configured",
                });
            }

            const payload = jwt.verify(token, secret);

            const actor = {
                user_id: payload.user_id ?? null,
                type: payload.type ?? null,
                company_id: payload.company_id ?? null,
                candidate_id: payload.candidate_id ?? null,
            };

            if (!actor.user_id || !actor.type) {
                return res.status(401).json({
                    error: "UNAUTHORIZED",
                    message: "Invalid token payload",
                });
            }

            if (Array.isArray(roles) && roles.length > 0) {
                if (!roles.includes(actor.type)) {
                    return res.status(403).json({
                        error: "FORBIDDEN",
                        message: "Insufficient role",
                    });
                }
            }

            req.actor = actor;
            return next();
        } catch (_err) {
            return res.status(401).json({
                error: "UNAUTHORIZED",
                message: "Invalid or expired token",
            });
        }
    };
}
