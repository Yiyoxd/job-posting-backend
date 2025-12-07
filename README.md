# 🏢 Job Posting Backend – Proyecto Final Full Stack

Este repositorio contiene el **backend** del proyecto **Job Posting**, desarrollado como **proyecto final de la materia de Full Stack**.  
El objetivo es aplicar de forma integrada todo lo visto en el semestre: Node.js, Express, manejo de dependencias con npm, organización por capas (rutas, controladores, modelos, middleware), consumo de base de datos y uso de variables de entorno.

> ⚠️ Nota: Por ahora el backend solo tiene la estructura base y un servidor mínimo.  
> La lógica (rutas reales, modelos, controladores, autenticación, etc.) se irá implementando sobre esta estructura.

---

## 🎯 Objetivos del Proyecto

- Diseñar una **API REST** para gestionar un sistema de **ofertas de empleo (job posting)**.
- Aplicar:
  - Servidor en **Node.js + Express**.
  - Organización de código en **capas** (rutas, controladores, modelos, middleware).
  - Uso de **variables de entorno** con `dotenv`.
  - Manejo de dependencias con **npm**.
  - Ejecución en modo desarrollo con **nodemon**.
- Dejar un backend listo para ser consumido por un **frontend** (por ejemplo, en React).

---

## 🧱 Tecnologías Utilizadas

- **Node.js** (entorno de ejecución de JavaScript)
- **Express.js** (framework para servidor HTTP y API REST)
- **Cors** (habilitar peticiones desde el frontend)
- **Dotenv** (manejo de variables de entorno)
- **Nodemon** (reinicio automático en desarrollo)

Listas para usarse más adelante en el proyecto:

- **Mongoose** (modelado de datos con MongoDB)
- **JSON Web Tokens (JWT)** (autenticación y autorización)
- **bcryptjs** (hash de contraseñas)
- **express-async-handler** (manejo de errores en funciones async)

---

## 📂 Estructura del Proyecto

La estructura actual del backend es la siguiente:

```bash
backend/
├── server.js          # Punto de entrada del servidor Express
├── package.json         # Configuración del proyecto y scripts de npm
├── package-lock.json    # Detalle de las dependencias instaladas (generado por npm)
├── .env                 # Variables de entorno (NO se sube a Git)
├── .gitignore           # Archivos y carpetas que Git debe ignorar
├── routes/               # Rutas de la API (endpoints)
├── models/             # Modelos de datos (p. ej. Usuario, Vacante, Empresa)
├── controllers/       # Lógica de negocio para cada ruta
├── middleware/          # Middlewares (autenticación, manejo de errores, etc.)
└── connection/            # Módulo de conexión a la base de datos
```

### Explicación por carpeta

- **`server.js`**  
  Archivo principal donde se:
  - Crea la aplicación de Express.
  - Configuran middlewares globales (`cors`, `express.json`, etc.).
  - Definen rutas base.
  - Levanta el servidor en el puerto configurado.

- **`rutas/`**  
  Aquí irán archivos como:
  - `usuariosRutas.js`
  - `vacantesRutas.js`
  - `postulacionesRutas.js`  
  Cada archivo define los endpoints y los enlaza con sus controladores.

- **`modelos/`**  
  Aquí se definirán los esquemas de MongoDB usando Mongoose, por ejemplo:
  - `Usuario.js`
  - `Empresa.js`
  - `Vacante.js`
  - `Postulacion.js`

- **`controladores/`**  
  Contendrá la lógica de negocio, por ejemplo:
  - `usuariosController.js`
  - `vacantesController.js`  
  Cada función se asociará a una ruta específica (crear usuario, listar vacantes, etc.).

- **`middleware/`**  
  Aquí se colocarán middlewares reutilizables:
  - `errorMiddleware.js` – manejo centralizado de errores.
  - `authMiddleware.js` – verificación de JWT cuando se implemente autenticación.

- **`conexion/`**  
  Módulo que se encargará de conectarse a la base de datos (por ejemplo, `dbConexion.js` con Mongoose).

---

## ⚙️ Requisitos Previos

Antes de clonar y ejecutar el proyecto necesitas:

- **Node.js** (versión recomendada: 18.x o superior)  
  Verificar versión:

  ```bash
  node -v
  ```

- **npm** (se instala junto con Node):

  ```bash
  npm -v
  ```

- (Más adelante) **Instancia de MongoDB** local o en la nube, cuando se configure la base de datos.

---

## 📥 Instalación y Configuración

Sigue estos pasos para instalar y correr el backend en tu máquina.

### 1️⃣ Clonar el repositorio

```bash
git clone https://github.com/Yiyoxd/job-posting-backend.git
cd job-posting-backend
# En algunos entornos la carpeta puede llamarse simplemente 'backend'
```

### 2️⃣ Instalar dependencias

Dentro de la carpeta del backend:

```bash
npm install
```

Esto instalará todas las dependencias definidas en `package.json` y generará `node_modules/` y `package-lock.json`.

### 3️⃣ Crear archivo `.env`

En la raíz del backend (donde está `server.js`), crea un archivo llamado `.env`:

```env
PUERTO=5000
# Cuando se agregue MongoDB:
# MONGO_URI=mongodb://localhost:27017/jobposting
# JWT_SECRET=un_secreto_muy_seguro
```

> El archivo `.env` **no se sube al repositorio**. Sus claves van listadas en `.gitignore`.

---

## ▶️ Ejecución del Servidor

En modo desarrollo se utiliza `nodemon` para que el servidor se reinicie automáticamente al detectar cambios en los archivos.

```bash
npm run dev
```

Si todo está correcto, deberías ver en la terminal algo como:

```bash
[nodemon] starting `node server.js`
Servidor corriendo en http://localhost:5000
```

### Probar que el backend responde

Abrir el navegador o una herramienta como Postman e ingresar:

- **GET** `http://localhost:5000/`

Respuesta esperada (actualmente):

```json
{
  "msg": "Backend iniciado"
}
```

> Esta respuesta puede cambiar cuando se agregue la lógica real del proyecto (por ejemplo, `"API Job Posting funcionando"`).

---

## 📜 Scripts definidos en `package.json`

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```

- **`npm start`**  
  Ejecuta el servidor una sola vez con Node (modo producción/simple).

- **`npm run dev`**  
  Ejecuta el servidor con `nodemon`, reiniciándolo automáticamente al detectar cambios en los archivos `.js`.

---

## 🧩 Diseño General de la API (Planeado)

Aunque todavía no se ha implementado la lógica completa, la idea general de la API es la siguiente:

### Entidades principales

- **Usuario**
  - Registro y autenticación (JWT).
  - Datos básicos del perfil.
  - Tipos de usuario (por ejemplo: candidato, empresa, admin).

- **Empresa**
  - Información básica de la empresa.
  - Relación con las vacantes que publica.

- **Vacante**
  - Información de un puesto de trabajo (título, descripción, salario, ubicación, tipo de contrato, etc.).
  - Publicada por una empresa.

- **Postulación**
  - Relación entre un usuario y una vacante.
  - Estado de la postulación (en revisión, aceptado, rechazado, etc.).

### Ejemplos de endpoints planeados

> *Nota: Esto es el diseño conceptual. La implementación se hará conforme avance el desarrollo.*

- `POST /api/usuarios/registro` – Registrar nuevo usuario.
- `POST /api/usuarios/login` – Iniciar sesión y obtener token JWT.
- `GET  /api/vacantes` – Listar vacantes disponibles.
- `POST /api/vacantes` – Crear vacante (solo empresas o admin).
- `POST /api/postulaciones` – Un usuario aplica a una vacante.
- `GET  /api/postulaciones/mias` – Ver postulaciones del usuario autenticado.

---

## 🧱 Manejo de Errores (Planeado)

Se utilizará un middleware centralizado para manejar errores.  
La idea es que, cuando ocurra un error en cualquier parte de la API, se devuelva una respuesta con formato consistente, por ejemplo:

```json
{
  "mensaje": "Recurso no encontrado",
  "detalle": "La vacante con id 123 no existe"
}
```

Este comportamiento se implementará en `middleware/errorMiddleware.js` y se registrará en `server.js` con:

```js
app.use(errorHandler);
```

---

## 🔐 Autenticación y Seguridad (Planeado)

Más adelante se integrará:

- **JWT (JSON Web Tokens)** para autenticación.
- **bcryptjs** para hash de contraseñas.
- Middlewares tipo `authMiddleware` para proteger rutas:

```js
// Ejemplo conceptual
app.get('/api/vacantes/protegidas', protegerRuta, obtenerVacantes);
```

Donde `protegerRuta` validará el token enviado en los headers.

---

## 🧪 Uso con el Frontend

El backend está pensado para ser consumido por un **frontend** (por ejemplo, en React), que hará peticiones HTTP a los endpoints de esta API:

- Uso de `fetch` o `axios` desde el frontend.
- Configuración de CORS desde el backend (`app.use(cors())`) para permitir el dominio del frontend.

---

## 📌 Estado Actual del Proyecto

- ✅ Servidor básico en Express funcionando.
- ✅ Estructura de carpetas organizada para un backend profesional.
- ✅ Dependencias principales instaladas y configuradas.
- ⏳ Pendiente: implementación de modelos, controladores, rutas reales y autenticación.
- ⏳ Pendiente: conexión real a MongoDB mediante Mongoose.

Este README sirve como **guía de referencia** para cualquier persona (profesor, revisor o compañero) que necesite:

- Entender la estructura del backend.
- Levantar el proyecto en su propia máquina.
- Continuar la implementación de las funcionalidades.

---

## 👥 Autores

Proyecto desarrollado por:

- **Alfredo Palacios** – [@Yiyoxd](https://github.com/Yiyoxd)
- **Daniela Aldaco** – [@danielaaldaco](https://github.com/danielaaldaco)
- **Sofía Gutiérrez** – [@soofigw](https://github.com/soofigw)

Materia: **Full Stack**  
Institución: **Instituto Tecnológico de la Laguna**

---
