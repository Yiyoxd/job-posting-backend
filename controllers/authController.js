// controllers/authController.js

import { loginService } from "../services/authService.js";

/**
 * POST /api/auth/login
 * -----------------------------------------------------------------------------
 * Endpoint de inicio de sesión.
 *
 * Entrada:
 * {
 *   email: string,
 *   password: string
 * }
 *
 * Salida (200):
 * {
 *   token: string,
 *   actor: { ... }
 * }
 */
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        const { token, actor } = await loginService({ email, password });

        return res.status(200).json({ token, actor });
    } catch (err) {
        if (err.message === "INVALID_CREDENTIALS") {
            return res.status(401).json({
                error: "UNAUTHORIZED",
                message: "Credenciales inválidas",
            });
        }

        if (err.message === "JWT_SECRET_NOT_CONFIGURED") {
            return res.status(500).json({
                error: "SERVER_MISCONFIG",
                message: "JWT_SECRET no está configurado",
            });
        }

        return res.status(500).json({
            error: "INTERNAL_ERROR",
            message: "Error inesperado en autenticación",
        });
    }
}
