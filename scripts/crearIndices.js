import { conectarDB } from "../conexion/db.js";
import Job from "../modelos/Job.js";
import Company from "../modelos/Company.js";
import EmployeeCount from "../modelos/EmployeeCount.js";

const log = (msg) => console.log(`   • ${msg}`);
const ok = (msg) => console.log(`✔ ${msg}`);
const fail = (msg) => console.log(`❌ ${msg}`);

const crearIndices = async () => {
    const t0 = Date.now();

    try {
        await conectarDB();
        console.log("\n⚙️  Creando índices...\n");

        const resultados = [];

        const crear = async (coleccion, descripcion, campos, opciones = {}) => {
            const inicio = Date.now();
            try {
                await coleccion.createIndex(campos, opciones);
                const ms = Date.now() - inicio;
                ok(`${descripcion} (${ms} ms)`);
                resultados.push({ descripcion, estado: "OK", tiempo: ms });
            } catch (err) {
                fail(`${descripcion} — ${err.message}`);
                resultados.push({ descripcion, estado: "ERROR", tiempo: null });
            }
        };

        // JOBS
        log("Jobs...");
        await crear(Job.collection, "job_id (único)", { job_id: 1 }, { unique: true });
        await crear(Job.collection, "company", { company: 1 });
        await crear(Job.collection, "búsqueda por texto", { title: "text", description: "text" });
        await crear(Job.collection, "location + salary", { location: 1, min_salary: 1, max_salary: 1 });

        // COMPANIES
        log("\nCompanies...");
        await crear(Company.collection, "name (text)", { name: "text" });
        await crear(Company.collection, "country + city", { country: 1, city: 1 });

        // EMPLOYEE COUNTS
        log("\nEmployeeCounts...");
        await crear(EmployeeCount.collection, "company", { company: 1 });
        await crear(EmployeeCount.collection, "employee_count desc", { employee_count: -1 });

        console.log("✔ Índices creados correctamente.\n");

        process.exit(0);

    } catch (error) {
        console.error("\n❌ Error general:", error);
        process.exit(1);
    }
};

crearIndices();
