/**
 * Utils de texto (reusables).
 */

export function normalize(str = "") {
    return String(str)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // quitar acentos
        .replace(/[^a-z0-9\s]/g, " ")    // sustituir símbolos por espacio
        .replace(/\s+/g, " ")            // colapsar espacios
        .trim();
}

export function normalizeSearchTerm(q) {
    if (q === undefined || q === null) return null;
    const s = String(q)
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
    return s.length ? s : null;
}

export function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function tokenize(str = "") {
    const n = normalize(str);
    if (!n) return [];
    const parts = n.split(" ").filter(Boolean);
    return [...new Set(parts)];
}
