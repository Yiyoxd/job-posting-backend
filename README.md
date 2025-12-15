# 🏢 Job Posting Backend — API Completa (Jobs, Companies, Locations + Auth + Candidates + Applications)

Backend oficial del sistema **Job Posting**, diseñado para ser **modular, escalable y mantenible**, con un flujo claro por capas (**routes → controllers → services → models/utils**) y herramientas internas para búsqueda inteligente, paginación, filtros y pipelines de inicialización de base de datos.

Incluye:

- API REST para **Jobs**, **Companies**, **Locations**.
- Módulos de **Auth**, **Candidates**, **Applications (postulaciones)** y **Favorites**.
- Búsqueda avanzada con **rankers** (Locations Rank PRO + MinHeap, Companies Rank Ultra).
- Pipeline completo para **drop/seed/index/import/sync** en MongoDB.
- Pipeline de **logos** (normalización y servido con fallback).
- Pruebas masivas que generan JSON en `/Tests/outputs/`.

---

# 🚀 Tecnologías

- **Node.js + Express (ESM)**
- **MongoDB + Mongoose**
- **Sharp** (procesamiento de imágenes)
- **dotenv**, **cors**
- Utilidades internas: **Logger**, **ProgressBar**, **Prompt**, **MinHeap**, helpers de parsing, filtros, paginación y manejo de errores.

---

# ✅ Arquitectura por Capas (cómo fluye una request)

1) **Route** recibe la petición HTTP y aplica middlewares (auth/validación básica).  
2) **Controller**:
   - Lee params/query/body
   - Normaliza entrada
   - Llama al **service**
   - Formatea respuesta JSON consistente (incluyendo `meta` si es listado)
3) **Service**:
   - Aplica reglas de negocio (permisos de negocio, validaciones finas, cálculos, ranking)
   - Orquesta queries contra **Models**
   - Usa **utils** (filtros, paginación, parsing, ranking, caches)
4) **Models** (Mongoose):
   - Representan colecciones
   - Reglas de esquema/índices a nivel BD
5) **Utils**:
   - Funciones reutilizables (rankers, heaps, parsing, paginación, manejo de errores, logs, etc.)

> Objetivo: que **routes** y **controllers** sean delgados, y que la lógica viva en **services**.

---

# 📂 Estructura Real del Proyecto (incluye `/data`)

```bash
backend/
├── connection/
│   └── db.js
│
├── controllers/
│   ├── applicationController.js
│   ├── authController.js
│   ├── candidateController.js
│   ├── companyController.js
│   ├── companyFeaturedController.js
│   ├── favoriteControllers.js
│   ├── jobController.js
│   └── locationController.js
│
├── data/
│   ├── jobs.json
│   ├── locations.json
│   ├── seed_users.txt
│   └── company_logos/
│       ├── original/
│       └── processed/
│
├── middlewares/
│   ├── authActor.js
│   ├── authorizeCandidateParam.js
│   ├── authorizeCompanyParam.js
│   ├── middleware.js
│   └── uploadLogo.js
│
├── models/
│   ├── Application.js
│   ├── Candidate.js
│   ├── Company.js
│   ├── Counter.js
│   ├── Favorite.js
│   ├── FeaturedCompany.js
│   ├── Job.js
│   ├── Location.js
│   ├── User.js
│   └── sequence.js
│
├── routes/
│   ├── applicationRoutes.js
│   ├── authRoutes.js
│   ├── candidateRoutes.js
│   ├── companyCandidateRoutes.js
│   ├── companyRoutes.js
│   ├── favoriteRoutes.js
│   ├── jobRoutes.js
│   ├── locationRoutes.js
│   └── logoRoutes.js
│
├── scripts/
│   ├── createIndexes.js
│   ├── createUsers.js
│   ├── deleteDb.js
│   ├── featuredCompanies.js
│   ├── importLocations.js
│   ├── insertData.js
│   ├── setupEverything.js
│   ├── standardize_logos.js
│   ├── startDb.js
│   └── syncCounters.js
│
├── services/
│   ├── applicationService.js
│   ├── authService.js
│   ├── candidateService.js
│   ├── companyFeaturedService.js
│   ├── companyService.js
│   ├── favoriteService.js
│   ├── jobService.js
│   └── locationService.js
│
├── Tests/
│   ├── outputs/
│   │   ├── companies/
│   │   ├── jobs/
│   │   └── locations/
│   ├── ejecutarCompanies.js
│   ├── ejecutarJobs.js
│   └── ejecutarLocations.js
│
├── utils/
│   ├── assets/
│   │   └── logoUtils.js
│   ├── auth/
│   │   └── actorAccessUtils.js
│   ├── jobs/
│   │   ├── jobFields.js
│   │   └── jobTransformUtils.js
│   ├── accesControl.js
│   ├── imageProcessor.js
│   ├── locationCache.js
│   ├── logger.js
│   ├── minHeap.js
│   ├── mongoFilterUtils.js
│   ├── paginationUtils.js
│   ├── parsingUtils.js
│   ├── progressBar.js
│   ├── prompt.js
│   ├── serviceError.js
│   ├── text.js
│   └── (otros helpers)
│
├── .env
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── server.js
````

---

# 📦 Qué hace cada carpeta y archivo (explicación profunda)

## 1) `connection/`

### `connection/db.js`

Responsable de:

* Leer variables de entorno (URI, opciones).
* Conectarse a MongoDB usando Mongoose.
* Exponer una función/handler para conectar antes de levantar el server o antes de ejecutar scripts.

Por qué está separado:

* Permite que **server.js** y **scripts/** reutilicen la misma conexión sin duplicar lógica.

---

## 2) `models/` (Mongoose)

Define las colecciones y su estructura. Normalmente aquí viven:

* Esquemas (fields, tipos, defaults).
* Índices (para performance).
* Validaciones básicas a nivel DB.

Modelos principales:

* `Job.js`: vacantes.
* `Company.js`: empresas.
* `Location.js`: estructura país/estado/ciudad y/o nodos normalizados.
* `Candidate.js`: perfil del candidato.
* `Application.js`: postulaciones (relación candidate ↔ job ↔ company).
* `Favorite.js`: favoritos (candidate ↔ job).
* `User.js`: cuenta de login (credenciales y tipo de actor).
* `FeaturedCompany.js`: empresas destacadas para Home.
* `Counter.js` / `sequence.js`: soporte para IDs secuenciales / contadores.

    * `syncCounters.js` existe precisamente para mantener esos contadores consistentes con el dataset.

---

## 3) `services/` (reglas de negocio)

Aquí vive la lógica “real” del sistema.

### Ejemplos por archivo:

* `jobService.js`

    * Construye filtros a partir de `req.query` (ubicación, texto, salario, modalidad, etc.).
    * Aplica ranking/sorting.
    * Devuelve listados con `meta` (page, limit, total, totalPages).
* `companyService.js`

    * Implementa el buscador “Rank Ultra” (tokens + fullpath + boost por ubicación).
    * Resuelve listados y detalle.
    * Arma URLs de logo (si aplica) usando `utils/assets/logoUtils.js`.
* `locationService.js`

    * Carga/cachea ubicaciones.
    * Aplica búsqueda global con ranking y selección eficiente con `minHeap.js`.
* `authService.js`

    * Login/register.
    * Generación/verificación de tokens (según implementación).
    * Construcción del `actor` que consumen middlewares y permisos.
* `candidateService.js`

    * Reglas para acceso a perfil y CV.
* `applicationService.js`

    * Lógica completa del pipeline de postulaciones:

        * crear postulación
        * consultar estado por job/candidate
        * listar por candidato o empresa
        * update de status (empresa/admin)
        * retirar postulación (candidate)
* `favoriteService.js`

    * Garantiza que solo candidate use favoritos.
    * Agregar/quitar/listar con paginación.
* `companyFeaturedService.js`

    * CRUD de destacadas (admin) y lectura pública (Home).

---

## 4) `controllers/` (adaptadores HTTP)

Su responsabilidad es **HTTP**, no reglas de negocio:

* Lee params/query/body.
* Llama al service correspondiente.
* Controla códigos HTTP y estructura de respuesta.
* Convierte errores del service a respuestas consistentes (apoyado en `utils/serviceError.js` o middleware de errores).

Ejemplo típico:

* Controller “list” → llama service → responde `{ meta, data }`.
* Controller “detail” → responde objeto.
* Controller “create/update” → valida lo mínimo (inputs críticos) y delega lo demás al service.

---

## 5) `middlewares/` (seguridad, autorización y helpers HTTP)

### `middlewares/authActor.js`

Middleware central de autenticación/autorización.
Por el uso que ya tienes en rutas, soporta:

* `required: true|false` (si es obligatorio token).
* `roles: ["admin","company","candidate"]` (control por rol).
* Pone `req.actor` para que el resto de la app sepa quién está llamando.

**Punto clave del diseño**:

* El router “no decide negocio”; solo garantiza identidad/rol.
* La validación fina (p.ej. “¿este company puede ver este candidate?”) vive en service.

### `authorizeCompanyParam.js`

Protege rutas donde el `:id` o `:company_id` viene en URL:

* Si el actor es `company`, valida que el param pertenezca a su `company_id`.
* `admin` pasa siempre.
* Evita que una empresa edite/elimine otra empresa por URL.

### `authorizeCandidateParam.js`

Mismo patrón pero para `candidate_id`:

* Candidate solo su propio ID.
* Admin permitido.
* Company permitido solo si existe relación por postulación (según tu comentario en rutas).

### `uploadLogo.js`

Middleware para carga de archivos (normalmente con `multer`):

* Valida archivo (tipo, tamaño).
* Guarda temporalmente o manda buffer al controller/service.
* Se usa antes de `updateCompanyLogo`.

### `middleware.js`

Suele ser un módulo para agrupar configuración de Express:

* `cors`, `express.json()`, logs, etc.
* Manejo global de errores si aplica.

---

## 6) `routes/` (definición de endpoints)

Los routers definen:

* paths
* método HTTP
* middlewares por endpoint
* controller final

### `routes/authRoutes.js`

Endpoints:

* `POST /api/auth/login` → login
* `POST /api/auth/register` → register

Es público (sin `authActor`), porque justo genera credenciales/token.

---

### `routes/candidateRoutes.js`

Protegidas por `authActor` (según tus reglas):

* `GET /api/candidates/:candidate_id`

    * candidate: solo su perfil
    * company: solo si hay relación por postulación
    * admin: permitido
* `PATCH /api/candidates/:candidate_id`

    * candidate: solo su perfil
    * admin: permitido
* `GET /api/candidates/:candidate_id/cv`

    * candidate: solo su CV
    * company: solo si existe relación por postulación
    * admin: permitido

Esto permite:

* un candidato gestione su información.
* una empresa vea CV si hay interacción real (Application).

---

### `routes/companyCandidateRoutes.js`

Endpoint:

* `GET /api/companies/:company_id/candidates`
  Protegido:
* roles `["admin","company"]`
  y valida que company solo pueda ver sus candidatos.

---

### `routes/companyRoutes.js`

Incluye dos bloques:

**Empresas destacadas (Home)**

* `GET /api/companies/featured` (público)
* `POST /api/companies/featured` (admin)
* `DELETE /api/companies/featured/:companyId` (admin)

**Companies principales**

* Públicos:

    * `GET /api/companies`
    * `GET /api/companies/:id`
    * `GET /api/companies/:id/jobs`
* Protegidos:

    * `POST /api/companies` (admin)
    * `PUT /api/companies/:id` (admin/company + authorizeCompanyParam)
    * `DELETE /api/companies/:id` (admin/company + authorizeCompanyParam)
    * `PUT /api/companies/:id/logo` (admin/company + authorizeCompanyParam + uploadCompanyLogo)

---

### `routes/jobRoutes.js`

Públicos:

* `GET /api/jobs`
* `GET /api/jobs/filters/options`
* `GET /api/jobs/company/:companyId`
* `GET /api/jobs/recommendations/titles`
* `GET /api/jobs/:id`

Protegidos:

* `POST /api/jobs` (company/admin)
* `PUT /api/jobs/:id` (company/admin)
* `DELETE /api/jobs/:id` (company/admin)

---

### `routes/locationRoutes.js`

Públicos (consulta/catálogo):

* `GET /api/locations/countries`
* `GET /api/locations/:country/states`
* `GET /api/locations/:country/:state/cities`
* `GET /api/locations/search?q=texto&k=20`

Este módulo se apoya en cache y ranking para performance.

---

### `routes/favoriteRoutes.js`

Solo candidate:

* `POST   /api/favorites/:job_id` → agrega favorito
* `DELETE /api/favorites/:job_id` → quita favorito
* `GET    /api/favorites` → lista favoritos (paginado)

---

### `routes/logoRoutes.js`

Sirve logos ya procesados desde disco con fallback:

* `GET /company_logos/processed/:file`

Comportamiento:

* Solo `.png`
* Si el logo existe → lo sirve
* Si no existe → sirve `DEFAULT_LOGO.png`
* Si tampoco existe → 404

Este router trabaja contra:

* `data/company_logos/processed/`
* `DEFAULT_LOGO.png` dentro de ese mismo folder

---

### `routes/applicationRoutes.js` (Postulaciones)

Este router concentra las operaciones de postulaciones y vistas por actor.

**Base de Applications**

* `POST   /api/applications/` → crear postulación
* `GET    /api/applications/:application_id` → obtener por id
* `GET    /api/applications/status` → status de candidato para un job
* `POST   /api/applications/statuses` → status batch job_id → status
* `DELETE /api/applications/` → retirar postulación

**Vistas por Candidate**

* `GET /api/candidates/:candidate_id/applications` → lista postulaciones del candidato

**Vistas por Company**

* `GET   /api/companies/:company_id/applications`
* `GET   /api/companies/:company_id/applications_with_candidates`
* `GET   /api/companies/:company_id/applications/:application_id`
* `PATCH /api/companies/:company_id/applications/:application_id/status`
* `GET   /api/companies/:company_id/applications/pipeline_counts`

> Importante: este archivo define rutas con prefijos `"/candidates/..."` y `"/companies/..."`.
> Para que los paths queden exactamente como están escritos arriba, este router normalmente se monta en `app.use("/api", applicationRoutes);`.
> Si lo montas en `"/api/applications"`, entonces esas rutas quedarían como `"/api/applications/candidates/..."` (no suele ser lo deseado).

---

## 7) `data/` (datasets y activos locales)

Esta carpeta es la “fuente” para poblar y operar el sistema.

* `data/jobs.json`

    * Dataset principal para seed de vacantes.
    * Lo consume `scripts/insertData.js`.

* `data/locations.json`

    * Dataset para estructura de ubicaciones.
    * Lo consume `scripts/importLocations.js`.

* `data/seed_users.txt`

    * Lista de usuarios semilla (p.ej. admin/companies/candidates).
    * Lo consume `scripts/createUsers.js`.

* `data/company_logos/original/`

    * Imágenes “en bruto” (cualquier formato/size).

* `data/company_logos/processed/`

    * Salida normalizada del pipeline (PNG cuadrados).
    * Aquí también vive el `DEFAULT_LOGO.png` para fallback.
    * Lo produce `scripts/standardize_logos.js`.

---

## 8) `scripts/` (pipeline de BD y automatizaciones)

Scripts ejecutables (node) para resetear y preparar el entorno.

* `deleteDb.js`

    * Borra colecciones objetivo para empezar limpio.

* `insertData.js`

    * Inserta el dataset principal (jobs/companies) desde `data/`.

* `importLocations.js`

    * Reconstruye la colección de Locations desde `data/locations.json`.

* `createIndexes.js`

    * Crea índices en colecciones para acelerar filtros/búsquedas/rankers.

* `syncCounters.js`

    * Ajusta contadores/secuencias (cuando usas IDs numéricos y seeding).

* `createUsers.js`

    * Crea usuarios semilla a partir de `data/seed_users.txt`.

* `standardize_logos.js`

    * Normaliza imágenes en `data/company_logos/original/`
    * Genera PNGs en `data/company_logos/processed/`

* `featuredCompanies.js`

    * Marca o inserta empresas destacadas para Home.

* `startDb.js`

    * Orquestador (depende de cómo lo armes) que suele correr:

        * deleteDb → insertData → createIndexes → importLocations → syncCounters → logos

* `setupEverything.js`

    * Orquestador “todo en uno” para entorno completo y/o arranque.

---

## 9) `Tests/` (pruebas masivas y outputs)

* `ejecutarJobs.js`, `ejecutarCompanies.js`, `ejecutarLocations.js`

    * Disparan requests (con diferentes combinaciones de filtros/sorts)
    * Guardan resultados como JSON en:

        * `Tests/outputs/jobs/`
        * `Tests/outputs/companies/`
        * `Tests/outputs/locations/`

Esto sirve para:

* validar regresiones al cambiar filtros o rankers
* comparar performance
* tener “snapshots” de comportamiento esperado

---

## 10) `utils/` (infra reutilizable)

Piezas internas que sostienen la lógica sin duplicación.

* `utils/logger.js`

    * Logger propio (secciones, niveles, formato).

* `utils/progressBar.js`

    * Barras de progreso para scripts largos (seed/import).

* `utils/prompt.js`

    * Confirmaciones automáticas/seguras para scripts destructivos (drop db).

* `utils/serviceError.js`

    * Error estándar para services (código, mensaje, status).
    * Permite que controllers respondan consistente.

* `utils/paginationUtils.js`

    * Cálculo de `page/limit/skip` y armado de `meta`:
      `{ meta: { page, limit, total, totalPages }, data: [...] }`

* `utils/mongoFilterUtils.js`

    * Construcción de filtros Mongoose a partir de query params.

* `utils/parsingUtils.js` y `utils/text.js`

    * Normalización de strings, tokens, trimming, sanitización, etc.
    * Base para rankers (comparaciones consistentes).

* `utils/minHeap.js`

    * Heap para seleccionar top-K eficientemente (Locations Rank PRO).

* `utils/locationCache.js`

    * Cache en memoria para locations (evita reconsultar Mongo en cada request).

* `utils/jobs/jobFields.js`

    * Definición/whitelist de campos permitidos (filtros y sorts seguros).

* `utils/jobs/jobTransformUtils.js`

    * Normalización de salarios, formatos, y transformaciones de salida.

* `utils/imageProcessor.js`

    * Helpers de procesado/validación de imágenes (apoya logos).

* `utils/assets/logoUtils.js`

    * Helpers para construir URL final del logo (por ejemplo `logo_full_path`).

* `utils/auth/actorAccessUtils.js` y `utils/accesControl.js`

    * Utilidades para reglas de acceso por actor/rol (admin/company/candidate).

---

# 🌐 API REST (Resumen)

## Jobs — `/api/jobs`

* `GET /api/jobs` (listado + filtros + ranking + paginación)
* `GET /api/jobs/:id` (detalle)
* `GET /api/jobs/company/:companyId` (jobs por empresa)
* `GET /api/jobs/filters/options` (catálogos)
* `GET /api/jobs/recommendations/titles` (recomendación de títulos)
* `POST/PUT/DELETE` protegidos para company/admin

## Companies — `/api/companies`

* `GET /api/companies` (buscador Rank Ultra)
* `GET /api/companies/:id`
* `GET /api/companies/:id/jobs`
* `PUT /api/companies/:id/logo` (subida de logo)
* `GET /api/companies/featured` (home)

## Locations — `/api/locations`

* catálogo país/estado/ciudad
* búsqueda global `search?q=...&k=...`

## Auth — `/api/auth`

* `POST /api/auth/login`
* `POST /api/auth/register`

## Candidates — `/api/candidates`

* `GET /api/candidates/:candidate_id`
* `PATCH /api/candidates/:candidate_id`
* `GET /api/candidates/:candidate_id/cv`

## Applications (Postulaciones)

* Crear / consultar / retirar
* Listado por candidato
* Vistas y conteos por empresa
  (Ver detalle en `applicationRoutes.js`)

## Favorites — `/api/favorites`

* Agregar / quitar / listar (solo candidate)

---

# 🔐 Autenticación y permisos (modelo actor-based)

El backend trabaja con un `actor` que se coloca en `req.actor` por `authActor`:

* `admin`
* `company`
* `candidate`

El control se divide en 2 niveles:

1. **Middlewares**: garantizan que exista identidad y rol válido.
2. **Services**: aplican reglas de negocio finas (relación company↔candidate por postulación, etc.).

Esto evita:

* lógica duplicada en routes
* permisos dispersos en controllers

---

# 🖼️ Logos — Pipeline y servido con fallback

Carpetas:

* `data/company_logos/original/` (entrada)
* `data/company_logos/processed/` (salida)

Script:

* `scripts/standardize_logos.js`

    * transforma a PNG cuadrado y consistente
    * deja un fallback `DEFAULT_LOGO.png`

Servidor:

* `routes/logoRoutes.js`

    * `GET /company_logos/processed/:file`
    * si no existe → devuelve `DEFAULT_LOGO.png`

---

# 🛠️ Inicialización rápida

1. Instala dependencias:

```bash
npm install
```

2. Configura `.env` (ejemplo mínimo):

```env
PORT=8000
MONGO_URI=mongodb://localhost:27017/job_posting
JWT_SECRET=tu_secreto
```

3. Corre el pipeline (según tus scripts en `package.json`):

```bash
npm run setup
```

---

# 🧪 Pruebas masivas

* Ejecutables en `/Tests`
* Outputs en `/Tests/outputs/*`

Se usan para validar:

* filtros
* ordenamientos
* ranking
* consistencia de `meta` en paginación

---

# 👥 Autores

* **Alfredo Palacios (Yiyo)**
* **Daniela Aldaco**
* **Sofía Gutiérrez**

Instituto Tecnológico de la Laguna — Full Stack
