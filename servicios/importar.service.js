import fs from "fs";
import Job from "../modelos/Job.js";
import Company from "../modelos/Company.js";
import EmployeeCount from "../modelos/EmployeeCount.js";

/**
 * Recibe el JSON exportado y lo inserta en MongoDB usando los modelos.
 */
export async function importarDatosDesdeJSON(path) {
    const raw = fs.readFileSync(path, "utf8");
    const documentos = JSON.parse(raw);

    const jobs = [];
    const companies = [];
    const empCounts = [];

    for (const doc of documentos) {
        const { job, company, company_employee_counts } = doc;

        jobs.push({
            ...job,
            job_id: doc.job_id,
            company_id: doc.company_id,
        });

        companies.push({
            company_id: doc.company_id,
            ...company,
        });

        for (const item of company_employee_counts) {
            empCounts.push(item);
        }
    }

    await Job.insertMany(jobs, { ordered: false });
    await Company.insertMany(companies, { ordered: false });
    await EmployeeCount.insertMany(empCounts, { ordered: false });

    return {
        jobs: jobs.length,
        companies: companies.length,
        counts: empCounts.length,
    };
}
