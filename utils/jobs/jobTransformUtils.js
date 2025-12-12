// utils/jobs/jobTransformUtils.js

/**
 * Transformaciones reutilizables para documentos Job.
 * Este módulo no depende de Express. Puede trabajar con docs de Mongoose o plain objects.
 */

/**
 * Convierte un documento (Mongoose) u objeto a un plain object.
 * @param {any} doc
 * @returns {Object|null}
 */
export function toPlainObject(doc) {
    if (!doc) return null;

    if (typeof doc.toObject === "function") return doc.toObject();
    if (typeof doc.toJSON === "function") return doc.toJSON();
    return { ...doc };
}

/**
 * Remueve un conjunto de llaves de un objeto.
 * @param {Object} obj
 * @param {string[]} keys
 * @returns {Object}
 */
export function omitKeys(obj, keys = []) {
    const clone = { ...obj };
    for (const k of keys) delete clone[k];
    return clone;
}

/**
 * Adjunta un objeto `company` consistente en cada job, usando CompanyModel para hidratar
 * datos cuando exista en la colección. Si no existe, aplica un fallback mínimo.
 *
 * @param {Array} rawJobs
 * @param {Object} options
 * @param {any} options.CompanyModel - Modelo Mongoose (Company) con find().lean()
 * @param {(companyId:any)=>string|null} options.buildLogoFullPath
 * @param {string[]} options.internalJobFields
 * @returns {Promise<Array>}
 */
export async function attachCompanyAndFormatJobs(
    rawJobs = [],
    { CompanyModel, buildLogoFullPath, internalJobFields = [] } = {}
) {
    if (!Array.isArray(rawJobs) || rawJobs.length === 0) return [];
    if (!CompanyModel) throw new Error("attachCompanyAndFormatJobs: CompanyModel es requerido.");
    if (typeof buildLogoFullPath !== "function") {
        throw new Error("attachCompanyAndFormatJobs: buildLogoFullPath debe ser una función.");
    }

    const jobs = rawJobs
        .map((job) => omitKeys(toPlainObject(job) || {}, internalJobFields))
        .filter((j) => j && Object.keys(j).length > 0);

    const companyIds = [
        ...new Set(
            jobs
                .map((j) => j.company_id)
                .filter((id) => id !== undefined && id !== null)
        )
    ];

    const companyMap = new Map();

    if (companyIds.length > 0) {
        const companies = await CompanyModel.find({ company_id: { $in: companyIds } }).lean();

        for (const c of companies) {
            if (!c) continue;

            const { _id, __v, createdAt, updatedAt, ...rest } = c;

            companyMap.set(rest.company_id, {
                name: rest.name ?? null,
                company_id: rest.company_id ?? null,
                description: rest.description ?? null,
                country: rest.country ?? null,
                state: rest.state ?? null,
                city: rest.city ?? null,
                address: rest.address ?? null,
                company_size_min: rest.company_size_min ?? null,
                company_size_max: rest.company_size_max ?? null,
                logo: buildLogoFullPath(rest.company_id)
            });
        }
    }

    return jobs.map((job) => {
        const companyId = job.company_id;

        if (companyId !== undefined && companyId !== null) {
            const fromDb = companyMap.get(companyId);

            if (fromDb) {
                return { ...job, company: { ...fromDb } };
            }

            return {
                ...job,
                company: {
                    name: null,
                    company_id: companyId,
                    description: null,
                    country: job.country ?? null,
                    state: job.state ?? null,
                    city: job.city ?? null,
                    address: null,
                    company_size_min: null,
                    company_size_max: null,
                    logo: buildLogoFullPath(companyId)
                }
            };
        }

        return { ...job, company: null };
    });
}
