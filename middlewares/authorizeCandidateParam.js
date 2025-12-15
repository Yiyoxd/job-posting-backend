// middlewares/authorizeCandidateParam.js

function toInt(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/**
 * authorizeCandidateParam({ param })
 * - Admin: permitido
 * - Candidate: permitido solo si req.actor.candidate_id === req.params[param]
 */
export function authorizeCandidateParam({ param }) {
    return function (req, res, next) {
        const actor = req.actor;

        if (!actor) {
            return res.status(401).json({ error: "UNAUTHORIZED", message: "Missing actor" });
        }

        if (actor.role === "admin") return next();

        if (actor.role !== "candidate") {
            return res.status(403).json({ error: "FORBIDDEN", message: "Candidate role required" });
        }

        const target = toInt(req.params[param]);
        const mine = toInt(actor.candidate_id);

        if (!target || !mine) {
            return res.status(400).json({ error: "BAD_REQUEST", message: "Invalid candidate_id" });
        }

        if (target !== mine) {
            return res.status(403).json({
                error: "FORBIDDEN",
                message: "Cannot access another candidate resource",
            });
        }

        return next();
    };
}
