# 🏢 Job Posting Backend – API Completa con Jobs, Companies y Locations

Este repositorio contiene el **backend oficial del sistema Job Posting**, totalmente modularizado, escalable, con servicios inteligentes de búsqueda y un pipeline completo de inicialización, procesamiento de logos y reconstrucción de base de datos.

Incluye:

- API REST profesional con **Jobs**, **Companies** y **Locations**.  
- Capas limpias: **routes → controllers → services → utils**.  
- Buscador de ubicaciones con **Rank PRO Inteligente + MinHeap**.  
- Buscador de empresas con **Rank Ultra Inteligente + FullPath**.  
- Pipeline completo para **crear, borrar, poblar e indexar** la BD.  
- Procesador de logos automático con `sharp`.  
- Scripts de pruebas masivas para **Jobs**, **Companies** y **Locations**.

---

# 🚀 Tecnologías

- **Node.js + Express (ESM)**
- **MongoDB + Mongoose**
- **Sharp** (procesamiento de imágenes)
- **dotenv**, **cors**
- **MinHeap personalizado** (rankers inteligentes)
- **Logger propio**, **ProgressBars**, **Prompts auto-confirm**

---

# 📂 Estructura Real del Proyecto

```bash
backend/
├── connection/
│   └── db.js
│
├── controllers/
│   ├── companyController.js
│   ├── jobController.js
│   └── locationController.js
│
├── data/
│   ├── jobs.json
│   ├── locations.json
│   └── company_logos/
│       ├── original/
│       └── processed/
│
├── middleware/
│   └── middleware.js
│
├── models/
│   ├── Company.js
│   ├── Job.js
│   └── Location.js
│
├── routes/
│   ├── companyRoutes.js
│   ├── jobRoutes.js
│   └── locationRoutes.js
│
├── scripts/
│   ├── createIndexes.js
│   ├── deleteDb.js
│   ├── importLocations.js
│   ├── insertData.js
│   ├── setupEverything.js
│   ├── standardize_logos.js
│   └── startDb.js
│
├── services/
│   ├── companyService.js
│   ├── jobService.js
│   └── locationService.js
│
├── Tests/
│   ├── outputs/
│   ├── ejecutarCompanies.js
│   ├── ejecutarJobs.js
│   └── ejecutarLocations.js
│
├── utils/
│   ├── logger.js
│   ├── minHeap.js
│   ├── locationCache.js
│   ├── imageProcessor.js
│   └── progressBar.js
│
├── server.js
└── package.json
````

---

# 🌐 API REST

### 🚩 `/api/jobs`

* Filtros avanzados: texto, país, estado, ciudad, salario real y normalizado
* Paginación y ordenamiento
* Ranker inteligente para búsqueda

### 🚩 `/api/companies`

* Búsqueda con **Rank Ultra** (name/description/country/state/city/fullpath)
* FullPath incluido en cada empresa para mejor matching
* Filtros por tamaño, ubicación, texto
* Listado, detalle, CRUD, jobs de empresa
* Endpoints:

    * `GET /api/companies`
    * `GET /api/companies/:id`
    * `GET /api/companies/:id/jobs`
    * `GET /api/companies/filters/options`
    * `POST /api/companies`
    * `PUT /api/companies/:id`
    * `DELETE /api/companies/:id`

### 🚩 `/api/locations`

* Cache completo en memoria (ultra rápido)
* Rank PRO inteligente con MinHeap
* Endpoints:

    * `GET /api/locations/countries`
    * `GET /api/locations/:country/states`
    * `GET /api/locations/:country/:state/cities`
    * `GET /api/locations/search?q=...`

---

# 🔍 Rankers Inteligentes

### ✨ Locations (Rank PRO + tokens + fullpath)

* Exact match
* Prefix match
* Token coverage
* FullPath coverage
* Type weight (city > state > country)

### ✨ Companies (Rank Ultra + descripción + ubicación + fullpath)

* Exact + Prefix + Contains
* Match por tokens en:

    * name
    * description
    * country/state/city
    * fullpath
* Penalización por longitud
* Boost inteligente por ciudad/estado

---

# 🖼️ Logos de Empresas

Pipeline en:

`scripts/standardize_logos.js`

* Lee `data/company_logos/original/`
* Valida imágenes
* Produce PNG 200x200 cuadrados
* Se sirven automáticamente desde:

```
http://localhost:8000/company_logos/processed/<id>.png
```

---

# 🛠️ Scripts Importantes

| Script                    | Función                                 |
| ------------------------- | --------------------------------------- |
| `npm run deletedb`        | Elimina toda la base                    |
| `npm run insertdata`      | Inserta jobs + companies                |
| `npm run importlocations` | Reconstruye la colección de ubicaciones |
| `npm run createindexes`   | Crea índices óptimos                    |
| `npm run startdb`         | drop + seed + index                     |
| `npm run logos`           | Procesa logos                           |
| `npm run setup`           | Setup completo + correr servidor        |

---

# ▶️ Flujo de Inicialización

```bash
npm install
cp .env.example .env
npm run setup
```

El sistema:

1. Borra DB
2. Inserta dataset
3. Crea índices
4. Importa Locations
5. Procesa logos
6. Arranca el servidor

---

# ⚙️ server.js

* Monta rutas Jobs, Locations, Companies
* Sirve logos estáticos
* Conecta a Mongo
* Arranca Express

---

# 🧪 Pruebas Masivas

En `/Tests`:

* `ejecutarJobs.js`
* `ejecutarCompanies.js`
* `ejecutarLocations.js`

Generan JSON automáticos en `/Tests/outputs/`.

---

# 📌 Estado del Proyecto

* ✅ API Jobs avanzada
* ✅ API Companies con Rank Ultra
* ✅ API Locations con Rank PRO
* ✅ Pipeline DB completo
* ✅ Sistema de logos
* ✅ Scripts automatizados
* 🧩 En progreso: autenticación JWT + panel admin

---

# 👥 Autores

* **Alfredo Palacios (Yiyo)**
* **Daniela Aldaco**
* **Sofía Gutiérrez**

Instituto Tecnológico de la Laguna – Full Stack

```md
```
