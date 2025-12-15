// controllers/authController.js

import { loginService, registerService } from "../services/authService.js";

/**
 * POST /api/auth/login
 * -----------------------------------------------------------------------------
 * Endpoint de inicio de sesión.
 *
 * Entrada:
 * {
 *   "email": string,
 *   "password": string
 * }
 *
 * Salida (200):
 * {
 *   "token": string,
 *   "actor": {
 *     "user_id": number,
 *     "type": "admin" | "company" | "candidate",
 *     "company_id": number | null,
 *     "candidate_id": number | null
 *   }
 * }
 *
 * Errores:
 * - 400: BAD_REQUEST (faltan campos)
 * - 401: UNAUTHORIZED (credenciales inválidas)
 * - 500: SERVER_MISCONFIG (JWT_SECRET no configurado)
 * - 500: INTERNAL_ERROR
 */
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        const { token, actor } = await loginService({ email, password });

        return res.status(200).json({ token, actor });
    } catch (err) {
        if (err.message === "BAD_REQUEST") {
            return res.status(400).json({
                error: "BAD_REQUEST",
                message: err.publicMessage || "Solicitud inválida",
            });
        }

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

/**
 * POST /api/auth/register
 * -----------------------------------------------------------------------------
 * Endpoint de registro (sirve para candidate y company).
 *
 * Crea:
 * - Un User (credenciales)
 * - Y dependiendo del type:
 *     type = "candidate" -> crea Candidate + enlaza user.candidate_id
 *     type = "company"   -> crea Company   + enlaza user.company_id
 *
 * Entrada (candidate):
 * {
 *   "type": "candidate",
 *   "email": "candidato@mail.com",
 *   "password": "secret",
 *   "candidate": {
 *     "full_name": "Juan Pérez",
 *     "contact": { "phone": "871..." , "email": "..." },
 *     "country": "Mexico",
 *     "state": "Coahuila",
 *     "city": "Torreón",
 *     "headline": "Backend Engineer"
 *   }
 * }
 *
 * Entrada (company):
 * {
 *   "type": "company",
 *   "email": "hr@empresa.com",
 *   "password": "secret",
 *   "company": {
 *     "name": "OpenAI",
 *     "description": "....",
 *     "country": "United States",
 *     "state": "California",
 *     "city": "San Francisco",
 *     "address": "San Francisco, CA",
 *     "company_size_min": 501,
 *     "company_size_max": 1000
 *   }
 * }
 *
 * Salida (201):
 * {
 *   "token": string,
 *   "actor": {
 *     "user_id": number,
 *     "type": "admin" | "company" | "candidate",
 *     "company_id": number | null,
 *     "candidate_id": number | null
 *   }
 * }
 *
 * Errores:
 * - 400: BAD_REQUEST (faltan campos / type inválido / falta candidate/company payload)
 * - 409: EMAIL_ALREADY_EXISTS
 * - 500: SERVER_MISCONFIG (JWT_SECRET)
 * - 500: INTERNAL_ERROR
 */
export async function register(req, res) {
    try {
        const { type, email, password, company, candidate } = req.body;

        const { token, actor } = await registerService({
            type,
            email,
            password,
            company,
            candidate,
        });

        return res.status(201).json({ token, actor });
    } catch (err) {
        if (err.message === "BAD_REQUEST") {
            return res.status(400).json({
                error: "BAD_REQUEST",
                message: err.publicMessage || "Solicitud inválida",
            });
        }

        if (err.message === "EMAIL_ALREADY_EXISTS") {
            return res.status(409).json({
                error: "CONFLICT",
                message: "El correo ya está registrado",
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
            message: "Error inesperado en registro",
        });
    }
}
