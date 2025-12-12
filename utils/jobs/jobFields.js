// utils/jobs/jobFields.js

/**
 * Campos internos que no deben exponerse al frontend.
 * Incluye metadatos de Mongo/Mongoose y campos auxiliares del ranking.
 */

export const INTERNAL_JOB_FIELDS = [
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
    "textScore",
    "titleLower",
    "descLower",
    "listedTimeMs",
    "titleTermScore",
    "descTermScore",
    "allTermsInTitle",
    "phraseInTitle",
    "phraseInDesc",
    "recencyBoost",
    "finalScore"
];
