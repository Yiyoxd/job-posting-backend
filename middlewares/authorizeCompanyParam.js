// middlewares/authorizeCompanyParam.js

function toInt(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/**
 * authorizeCompanyParam({ param })
 * - Admin: permitido
 * - Company: permitido solo si req.actor.company_id === req.params[param]
 */
export function authorizeCompanyParam({ param }) {
    return function (req, res, next) {
        const actor = req.actor;

        if (!actor) {
            return res.status(401).json({ error: "UNAUTHORIZED", message: "Missing actor" });
        }

        if (actor.type === "admin") return next();

        if (actor.type !== "company") {
            return res.status(403).json({ error: "FORBIDDEN", message: "Company role required" });
        }

        const target = toInt(req.params[param]);
        const mine = toInt(actor.company_id);

        if (!target || !mine) {
            return res.status(400).json({ error: "BAD_REQUEST", message: "Invalid company_id" });
        }

        if (target !== mine) {
            return res.status(403).json({
                error: "FORBIDDEN",
                message: "Cannot access another company resource",
            });
        }

        return next();
    };
}
