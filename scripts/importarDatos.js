import fs from "fs";
import path from "path";
import readline from "readline";

import Job from "../modelos/Job.js";
import Company from "../modelos/Company.js";
import EmployeeCount from "../modelos/EmployeeCount.js";

import { conectarDB } from "../conexion/db.js";

const __dirname = path.resolve();
const rutaDatos = path.join(__dirname, "data", "datos.json");
const LOTE = 1000;

// Confirmación flexible
const confirmar = (pregunta) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    return new Promise((resolve) => {
        rl.question(pregunta, (respuesta) => {
            rl.close();
            const r = respuesta.trim().toLowerCase();
            resolve(["y", "yes", "si", "s"].includes(r));
        });
    });
};

// Barra de progreso
const progreso = (actual, total) => {
    const porcentaje = ((actual / total) * 100).toFixed(2);
    const barra = Math.floor((porcentaje / 100) * 30);
    const visual = "█".repeat(barra) + "░".repeat(30 - barra);
    process.stdout.write(`\r${visual} ${porcentaje}%  (${actual}/${total})`);
};

const importarDatos = async () => {
    try {
        await conectarDB();

        const args = process.argv.slice(2);
        const modoAuto = args.includes("--auto");

        let respuesta = "n";

        if (modoAuto) {
            respuesta = "y";
        } else {
            respuesta = await confirmar("¿Deseas borrar los registros anteriores? (y/n): ");
        }

        if (!["y", "yes", "s", "si"].includes(respuesta.toLowerCase())) {
            console.log("Proceso cancelado.");
            process.exit(0);
        }


        const contenido = fs.readFileSync(rutaDatos, "utf-8");
        const documentos = JSON.parse(contenido);

        console.log("Borrando registros");
        await Job.deleteMany({});
        await Company.deleteMany({});
        await EmployeeCount.deleteMany({});

        let loteCompanies = [];
        let loteJobs = [];
        let loteEmployeeCounts = [];

        const total = documentos.length;
        let i = 0;

        console.log("\nImportando...\n");

        for (const doc of documentos) {
            const companyData = { ...doc.company };
            loteCompanies.push(companyData);

            const indexCompany = loteCompanies.length - 1;

            for (const emp of doc.company_employee_counts) {
                loteEmployeeCounts.push({
                    employee_count: emp.employee_count,
                    _companyIndex: indexCompany
                });
            }

            loteJobs.push({
                ...doc.job,
                _companyIndex: indexCompany
            });

            i++;
            progreso(i, total);

            if (i % LOTE === 0 || i === total) {
                const empresasInsertadas = await Company.insertMany(loteCompanies);

                const jobsLimpios = loteJobs.map(j => ({
                    ...j,
                    company: empresasInsertadas[j._companyIndex]._id
                }));

                const empleadosLimpios = loteEmployeeCounts.map(e => ({
                    company: empresasInsertadas[e._companyIndex]._id,
                    employee_count: e.employee_count
                }));

                await Job.insertMany(jobsLimpios);
                await EmployeeCount.insertMany(empleadosLimpios);

                loteCompanies = [];
                loteJobs = [];
                loteEmployeeCounts = [];
            }
        }

        console.log("\nImportación completada.");
        process.exit(0);

    } catch (error) {
        console.error("\nError:", error);
        process.exit(1);
    }
};

importarDatos();
