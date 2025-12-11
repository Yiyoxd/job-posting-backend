# 🏢 Job Posting Backend – Proyecto Final Full Stack

Este repositorio contiene el **backend** del proyecto **Job Posting**, desarrollado como **proyecto final de la materia de Full Stack**.

Además de exponer una **API REST** para consultar ofertas de empleo, el backend incluye:

* Un **pipeline de inicialización de base de datos** (drop + seed + índices).
* Un sistema para **procesar y estandarizar logos de empresas**.
* Utilidades reutilizables para **logs**, **confirmaciones en CLI** y **barras de progreso**.

---

## 🎯 Objetivos del Proyecto

* Diseñar e implementar una **API REST** para un sistema de **ofertas de empleo (job posting)**.
* Aplicar de forma integrada:

    * Servidor en **Node.js + Express**.
    * Organización del backend por **capas y módulos** (rutas, controladores, modelos, middleware, scripts, utilidades).
    * Consumo de **MongoDB** con **Mongoose**.
    * Uso de **variables de entorno** con `dotenv`.
    * Scripts de **automatización** para:

        * Eliminar la base de datos.
        * Insertar datos de un dataset grande.
        * Crear índices de búsqueda.
        * Procesar logos de empresas.
* Dejar un backend listo para ser consumido por un **frontend** (por ejemplo, React).

---

## 🧱 Tecnologías Utilizadas

**Core backend**

* Node.js (ES Modules, `type: "module"`)
* Express.js
* MongoDB
* Mongoose

**Utilidades**

* dotenv (variables de entorno)
* cors (CORS para frontend)
* nodemon (modo desarrollo)
* sharp (procesamiento de imágenes)
* readline (entradas interactivas en CLI)
* child_process (orquestar otros scripts desde Node)

---

## 📂 Estructura del Proyecto

Estructura general (simplificada):

```bash
backend/
├── package.json
├── .env
├── server.js / app.js / index.js         # Punto de entrada HTTP (Express)
│
├── connection/
│   └── db.js                             # Conexión a MongoDB (Mongoose)
│
├── models/
│   ├── Job.js                            # Modelo de oferta de trabajo
│   ├── Company.js                        # Modelo de empresa
│   └── EmployeeCount.js                  # Tamaño de empresa por periodo
│
├── controllers/
│   └── jobController.js                 # Lógica de /api/jobs
│
├── routes/
│   └── jobRoutes.js                     # Rutas para recursos Job
│
├── middleware/
│   └── (futuros middlewares: auth, errores, etc.)
│
├── scripts/
│   ├── deleteDb.js                       # Elimina toda la BD
│   ├── insertData.js                     # Inserta el dataset JSON
│   ├── createIndexes.js                  # Crea índices en Mongo
│   ├── startDb.js                        # Orquesta: drop + seed + indexes
│   ├── standardize_logos.js              # Procesa y estandariza logos
│   └── setupEverything.js                # Setup completo + opción de `npm run dev`
│
├── utils/
│   ├── logger.js                         # Logger unificado (INFO, SUCCESS, WARN, ERROR)
│   ├── prompt.js                         # Confirmaciones (y/n) con soporte a --auto
│   ├── progressBar.js                    # Barras de progreso simples en CLI
│   └── imageProcessor.js                 # Función standardizeLogo()
│
└── data/
    ├── dataset_jobs.json                 # Dataset de empleos, empresas y empleados
    └── company_logos/
        ├── original/                     # Logos de entrada (raw)
        └── processed/                    # Logos procesados 200x200 PNG
```

> Los nombres concretos de algunos archivos de entrada (`server.js`, `index.js`, etc.) pueden variar, pero la organización por módulos se mantiene.

---

## 🗄️ Conexión a Base de Datos

El archivo `connection/db.js` centraliza la configuración de Mongoose.
Ejemplo conceptual (simplificado):

```js
// connection/db.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_MONGO_URI = "mongodb://localhost:27017/job_posting_db";

export const connectDB = async () => {
    const MONGO_URI = process.env.MONGO_URI ?? DEFAULT_MONGO_URI;

    try {
        mongoose.set("strictQuery", true);

        await mongoose.connect(MONGO_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
        });

        console.log("✔ MongoDB connected");
    } catch (err) {
        console.error("❌ MongoDB error:", err.message);
        process.exit(1);
    }
};
```

* Si **no** hay `MONGO_URI` en `.env`, se usa por defecto:

  ```text
  mongodb://localhost:27017/job_posting_db
  ```

---

## 🧬 Modelos Principales

Actualmente están definidos 3 modelos base en `models/`:

### `Job`

Representa una **oferta de trabajo**. Ejemplos de campos típicos:

* `job_id` (string único)
* `title`
* `description`
* `location`
* `min_salary`, `max_salary`
* `company` (ObjectId → `Company`)

Además se crean índices en:

* `job_id` (único)
* `company`
* `title` (text search)
* `location + min_salary + max_salary`

---

### `Company`

Representa una **empresa** asociada a uno o varios empleos.

* `name`
* `country`
* `city`
* Otros campos derivados del dataset.

Índices:

* `name` (text)
* `country + city`

---

### `EmployeeCount`

Representa el **tamaño de la empresa** (número de empleados) por periodo o registro.

* `company` (ObjectId → `Company`)
* `employee_count`

Índice:

* `company`
* `employee_count` (orden descendente)

---

## 🌐 API Actual

Por ahora la API expone un endpoint básico de lectura de empleos, pensado como primer paso para el frontend.

### GET `/api/jobs`

Definido en:

* Ruta: `routes/jobRoutes.js`
* Controlador: `controllers/jobController.js`

Ejemplo de implementación del controlador:

```js
// controllers/jobController.js
import Job from "../models/Job.js";

export async function getJobs(req, res) {
    const jobs = await Job.find().limit(50);
    res.json(jobs);
}
```

Ejemplo de uso de la ruta en el servidor:

```js
// server.js (ejemplo)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {connectDB} from "./connection/db.js";
import jobRoutes from "./jobRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

connectDB();

app.use("/api/jobs", jobRoutes);

app.get("/", (req, res) => {
    res.json({message: "Backend running"});
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
```

---

## ⚙️ Variables de Entorno

Archivo `.env` (no se sube a Git):

```env
PORT=8000
MONGO_URI=mongodb://localhost:27017/job_posting_db
# Futuro:
# JWT_SECRET=change_me
```

Si `MONGO_URI` no se define, se utiliza automáticamente la URL por defecto hacia `job_posting_db`.

---

## 📜 Scripts de npm

Ejemplo de sección `"scripts"` en `package.json`:

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",

  "deletedb": "node scripts/deleteDb.js",
  "insertdata": "node scripts/insertData.js",
  "createindexes": "node scripts/createIndexes.js",
  "startdb": "node scripts/startDb.js",

  "logos": "node scripts/standardize_logos.js",
  "setup": "node scripts/setupEverything.js"
}
```

### Resumen de cada script

* `npm run dev`
  Levanta el servidor en modo desarrollo usando `nodemon`.

* `npm run deletedb`
  Elimina **toda la base de datos** (tablas, datos e índices) asociada al `MONGO_URI`.
  Pide confirmación, salvo que se use `--auto`.

* `npm run insertdata`
  Inserta el dataset desde `data/dataset_jobs.json` sin dropear la base.
  Útil para pruebas o re-seed parcial.

* `npm run createindexes`
  Crea los índices de las colecciones `Job`, `Company` y `EmployeeCount`.

* `npm run startdb`
  Orquestador de base de datos:

    1. `deleteDb` (con `--auto`)
    2. `insertData` (con `--auto`)
    3. `createIndexes`

* `npm run logos`
  Procesa todos los logos en `data/company_logos/original/` y genera versiones estandarizadas (200x200 PNG) en `data/company_logos/processed/`, con una barra de progreso limpia.

* `npm run setup`
  Pipeline completo:

    1. Ejecuta `startDb` (drop + seed + índices).
    2. Estandariza logos (`standardize_logos.js`).
    3. Pregunta si quieres ejecutar `npm run dev`.

---

## 🧮 Scripts de Base de Datos (detalle)

### `scripts/deleteDb.js`

* Conecta a Mongo.
* Pide confirmación (`y/n`) salvo que se invoque con `--auto`.
* Llama a `mongoose.connection.dropDatabase()`.
* Loguea el tiempo en ms.

Uso directo:

```bash
node scripts/deleteDb.js
node scripts/deleteDb.js --auto
```

---

### `scripts/insertData.js`

* Lee `data/dataset_jobs.json`.
* Valida que sea un arreglo.
* Inserta en **batches** de tamaño configurable (`BATCH_SIZE`, por defecto 1000).
* Crea primero las empresas del batch, luego:

    * Jobs referenciando a la empresa mediante `_companyIndex`.
    * Registros de `EmployeeCount` referenciando de la misma forma.
* Muestra una barra de progreso en consola.

La confirmación la maneja `Prompt`:

```bash
node scripts/insertData.js
node scripts/insertData.js --auto
```

---

### `scripts/createIndexes.js`

Crea índices en:

* `Job`:

    * `job_id` (único)
    * `company`
    * `title` (text search)
    * `location + min_salary + max_salary`
* `Company`:

    * `name` (text)
    * `country + city`
* `EmployeeCount`:

    * `company`
    * `employee_count` (descendente)

Puede ejecutarse en cualquier momento, incluso con colecciones vacías:

```bash
node scripts/createIndexes.js
```

---

### `scripts/startDb.js`

Orquestador de base de datos:

```bash
node scripts/startDb.js
```

Flujo interno:

1. `deleteDb.js --auto`
2. `insertData.js --auto`
3. `createIndexes.js`

Al final, deja la base:

* Limpia.
* Poblada con el dataset.
* Indexada para consultas.

---

## 🖼️ Pipeline de Logos

### `data/company_logos/`

* `original/` → Aquí se colocan los logos **raw** (png, jpg, jpeg, webp, gif).
* `processed/` → Aquí se generan las versiones estandarizadas:

    * Formato: PNG.
    * Tamaño: 200x200 px.
    * Fondo transparente.
    * Imagen centrada, respetando proporciones.

### `scripts/standardize_logos.js`

* Valida que las carpetas `data/company_logos`, `original` y `processed` existan (si no, las crea).
* Recorre todos los archivos de `original/`.
* Solo procesa extensiones válidas.
* Usa `sharp` para validar y transformar.
* Renombra salida con un nombre seguro + timestamp.
* Muestra una barra de progreso (sin spam por archivo).

Uso:

```bash
npm run logos
# o
node scripts/standardize_logos.js
```

---

## 🧰 Utilidades Compartidas

### `utils/logger.js`

Logger centralizado con formato:

```text
[HH:MM:SS] [LEVEL] mensaje
```

Niveles:

* `logger.info(msg)`
* `logger.success(msg)`
* `logger.warn(msg)`
* `logger.error(msg)`
* `logger.section(title)` → para marcar secciones importantes de ejecución.

---

### `utils/prompt.js`

Wrapper para preguntas `(y/n)` en CLI con soporte para `--auto`.

Uso típico en scripts:

```js
const prompt = createPromptFromArgs(process.argv);

const confirmed = await prompt.confirm(
  "This will drop the entire database. Continue? (y/n): "
);
```

Si el script se ejecuta con `--auto`, `confirm()` responde automáticamente como “sí” sin preguntar por consola.

---

### `utils/progressBar.js`

Implementa una barra de progreso simple:

```text
███████████████░░░░░░░  65.00% (42394/65224)
```

Utilizada por `insertData.js` y `standardize_logos.js`.

---

## ▶️ Flujo Típico de Trabajo

1. Clonar el repositorio:

   ```bash
   git clone https://github.com/Yiyoxd/job-posting-backend.git
   cd job-posting-backend
   ```

2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Crear `.env`:

   ```env
   PORT=8000
   MONGO_URI=mongodb://localhost:27017/job_posting_db
   ```

4. Ejecutar setup completo (BD + logos) y opcionalmente levantar el servidor:

   ```bash
   npm run setup
   ```

   El script:

    * Reinicia la base (`startdb` interno).
    * Procesa logos.
    * Pregunta si deseas ejecutar `npm run dev`.

5. Probar la API:

    * `GET http://localhost:8000/` → mensaje simple del backend.
    * `GET http://localhost:8000/api/jobs` → primeras ofertas de empleo (limit 50).

---

## 📌 Estado Actual

* ✅ Conexión a MongoDB configurada.
* ✅ Modelos base: `Job`, `Company`, `EmployeeCount`.
* ✅ Endpoint `/api/jobs` funcionando.
* ✅ Scripts de administración de base de datos (drop, seed, índices).
* ✅ Pipeline de procesamiento de logos.
* ✅ Utilidades genericas para logs, prompts y barras de progreso.
* ⏳ Pendiente: autenticación (JWT), usuarios, permisos y más endpoints.
* ⏳ Pendiente: filtros avanzados de búsqueda de trabajos, paginación, etc.

---

## 👥 Autores

Proyecto desarrollado por:

* **Alfredo Palacios** – [@Yiyoxd](https://github.com/Yiyoxd)
* **Daniela Aldaco** – [@danielaaldaco](https://github.com/danielaaldaco)
* **Sofía Gutiérrez** – [@soofigw](https://github.com/soofigw)

Materia: **Full Stack**
Institución: **Instituto Tecnológico de la Laguna**