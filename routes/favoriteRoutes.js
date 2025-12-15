// routes/favoriteRoutes.js

/**
 * ============================================================================
 * favoriteRoutes.js — Rutas de Favoritos
 * ============================================================================
 *
 * Reglas:
 * - Solo candidatos pueden usar favoritos.
 * - Requiere authActor({ required:true, roles:["candidate"] }).
 *
 * Endpoints:
 * - POST   /api/favorites/:job_id   -> agrega favorito
 * - DELETE /api/favorites/:job_id   -> quita favorito
 * - GET    /api/favorites           -> lista favoritos del candidato (paginado)
 * ============================================================================
 */

import express from "express";
import {
    addFavoriteController,
    removeFavoriteController,
    listFavoritesController
} from "../controllers/favoriteController.js";

import { authActor } from "../middlewares/authActor.js";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/*                              SOLO CANDIDATE                                */
/* -------------------------------------------------------------------------- */

router.post(
    "/:job_id",
    authActor({ required: true, roles: ["candidate"] }),
    addFavoriteController
);

router.delete(
    "/:job_id",
    authActor({ required: true, roles: ["candidate"] }),
    removeFavoriteController
);

router.get(
    "/",
    authActor({ required: true, roles: ["candidate"] }),
    listFavoritesController
);

export default router;
