# 🎫 TurnoConnect — Sistema Distribuido de Gestión de Turnos

**Examen Práctico — Primer Parcial**
**Asignatura:** Aplicaciones Distribuidas — ESPE
**Estudiante:** SANTIAGO GEOVANNY SANCHEZ CAMACHO
**NRC:** 37869

Sistema que integra **cuatro mecanismos de comunicación** sobre una única fuente de
datos en MongoDB:

| Mecanismo | Puerto | Función |
|---|---|---|
| **REST + JWT** (Express) | `3000` | Registro/login de usuarios y CRUD de turnos |
| **WebSockets** (Socket.IO) | `3000` | Actualización en tiempo real de la interfaz |
| **Sockets TCP** | `5000` | Consulta de turnos por código desde clientes de consola |
| **Sockets UDP** | `5001` | Consultas de estadísticas generales |

> **Idea central del diseño:** TCP, UDP, REST y WebSocket **no guardan datos propios**.
> Todos pasan por la capa `turnoService` → MongoDB. Así la información siempre es
> consistente entre los cuatro mecanismos (Parte 5 del examen).

---

## 📋 Requisitos previos

- **Node.js 18 o superior** — `node -v`
- **MongoDB** — ya incluido en el proyecto como instalación **portable** en `laboratorio\.mongodb\`
  (no requiere permisos de administrador ni servicios de Windows)
- **Postman** (para las pruebas de la API)
- *Opcional:* **Docker Desktop**, si prefiere ejecutar MongoDB en un contenedor

---

## 🚀 Instalación y ejecución

### 1. Iniciar MongoDB

El proyecto trae MongoDB 8.0.38 (LTS) portable en `.mongodb\`. Basta con ejecutar:

```bash
npm run mongo:start
```

Salida esperada:

```
  [OK] MongoDB activo en mongodb://127.0.0.1:27017/turnoconnect (2 s)
       PID 9292  -  Detener con: npm run mongo:stop
```

Para detenerlo:

```bash
npm run mongo:stop
```

> **¿Cómo se obtuvo?** Se descargó el ZIP oficial
> `mongodb-windows-x86_64-8.0.38.zip` desde <https://www.mongodb.com/try/download/community>,
> se extrajo en `.mongodb\server\` y los datos se guardan en `.mongodb\data\`.
> Los scripts `scripts\mongo-start.ps1` y `scripts\mongo-stop.ps1` automatizan el arranque
> y la detención. La carpeta `.mongodb\` está excluida del control de versiones y del ZIP de entrega.

#### Alternativa con Docker

Si tiene Docker Desktop instalado, puede usar el `docker-compose.yml` incluido:

```bash
# Solo MongoDB
docker compose up -d

# MongoDB + Mongo Express (interfaz web para ver los documentos en http://localhost:8081)
docker compose --profile ui up -d

# Todo el sistema en contenedores (MongoDB + Mongo Express + aplicación)
docker compose --profile full up -d --build
```

> En ese caso, mantenga `MONGODB_URI=mongodb://127.0.0.1:27017/turnoconnect` en el `.env`
> para el modo local, o `mongodb://mongo:27017/turnoconnect` si la app corre en el perfil `full`.

### 2. Instalar dependencias

```bash
npm install
```

### 3. Crear el archivo de entorno

```bash
copy .env.example .env
```

Editar `.env` y colocar un `JWT_SECRET` propio. Se puede generar con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 4. Cargar datos de prueba (opcional pero recomendado)

```bash
npm run seed
```

Crea los usuarios **`santiago / Santiago2026*`** y **`maria / Maria2026*`**,
más cuatro turnos de ejemplo.

### 5. Iniciar el sistema completo

```bash
npm start
```

Salida esperada:

```
══════════════════════════════════════════════════════════════════
  TurnoConnect — Sistema Distribuido de Gestión de Turnos
  Estudiante : SANTIAGO GEOVANNY SANCHEZ CAMACHO
  NRC        : 37869
  Asignatura : Aplicaciones Distribuidas — ESPE
══════════════════════════════════════════════════════════════════
[BD] Conectado a MongoDB → base de datos "turnoconnect" en 127.0.0.1:27017
[TCP] Servidor TCP escuchando en 0.0.0.0:5000
[UDP] Servidor UDP escuchando en 0.0.0.0:5001
──────────────────────────────────────────────────────────────────
✔ SERVICIOS ACTIVOS
  REST API     →  http://localhost:3000/api
  Interfaz web →  http://localhost:3000
  WebSocket    →  ws://localhost:3000  (Socket.IO)
  Socket TCP   →  tcp://localhost:5000
  Socket UDP   →  udp://localhost:5001
──────────────────────────────────────────────────────────────────
```

Abrir la interfaz web en **dos navegadores distintos**: <http://localhost:3000>

---

## 🗂️ Estructura del proyecto

```
laboratorio/
├── package.json
├── docker-compose.yml          # MongoDB (+ Mongo Express opcional)
├── Dockerfile                  # Imagen de la app (perfil "full")
├── .env.example                # Variables de entorno de EJEMPLO
├── README.md
│
├── .mongodb/                   # MongoDB 8.0.38 portable (no se entrega)
│   ├── server/bin/mongod.exe   #   binarios oficiales
│   ├── data/                   #   archivos de la base de datos
│   └── logs/mongod.log         #   registro del servidor
│
├── src/
│   ├── server.js               # Arranca REST + WS + TCP + UDP
│   ├── app.js                  # Configuración de Express
│   ├── config/
│   │   ├── env.js              # Lectura y validación del .env
│   │   └── db.js               # Conexión única a MongoDB
│   ├── models/
│   │   ├── Usuario.js          # Usuario con contraseña cifrada (bcrypt)
│   │   ├── Turno.js            # Documento central del sistema
│   │   └── Contador.js         # Generación atómica de códigos T-001
│   ├── services/
│   │   ├── turnoService.js     # ★ FUENTE ÚNICA DE VERDAD
│   │   ├── authService.js      # Registro, login y JWT
│   │   └── eventBus.js         # Eventos internos → WebSockets
│   ├── middleware/
│   │   ├── auth.middleware.js  # Verificación del token Bearer
│   │   └── errorHandler.middleware.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   └── turnos.routes.js    # Todas protegidas con JWT
│   ├── sockets/
│   │   └── turno.socket.js     # Difusión en tiempo real
│   ├── tcp/
│   │   ├── tcpServer.js        # Servidor TCP concurrente
│   │   └── runTcpServer.js     # Arranque independiente (npm run tcp)
│   └── udp/
│       ├── udpServer.js        # Servidor UDP de estadísticas
│       └── runUdpServer.js     # Arranque independiente (npm run udp)
│
├── clientes/
│   ├── clienteTCP.js           # Cliente TCP (menú o consulta directa)
│   └── clienteUDP.js           # Cliente UDP (consulta o menú)
│
├── public/                     # Interfaz web
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
│
├── postman/
│   └── TurnoConnect.postman_collection.json
│
└── scripts/
    ├── seed.js                 # Datos de prueba
    ├── mongo-start.ps1         # Arranca MongoDB portable
    └── mongo-stop.ps1          # Detiene MongoDB portable
```

---

## 🔌 API REST

Todas las rutas de turnos requieren el encabezado:

```
Authorization: Bearer <token>
```

### Autenticación

| Método | Ruta | Descripción | Código |
|---|---|---|---|
| POST | `/api/auth/registro` | Registrar usuario | 201 / 400 / 409 |
| POST | `/api/auth/login` | Autenticar y obtener token | 200 / 401 |
| GET | `/api/auth/perfil` | Datos del usuario autenticado | 200 / 401 |

**Cuerpo del registro / login:**

```json
{ "nombre": "santiago", "password": "Santiago2026*" }
```

**Respuesta del login:**

```json
{
  "ok": true,
  "mensaje": "Bienvenido santiago",
  "datos": {
    "usuario": { "id": "...", "nombre": "santiago", "email": null, "rol": "usuario" },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Turnos (protegidas con JWT)

| Método | Ruta | Descripción | Código |
|---|---|---|---|
| GET | `/api/turnos` | Listar turnos (`?estado=Pendiente`) | 200 |
| GET | `/api/turnos/estadisticas` | Contadores por estado | 200 |
| GET | `/api/turnos/codigo/:codigo` | Consultar por código (`T-001`) | 200 / 404 |
| GET | `/api/turnos/:id` | Consultar turno específico | 200 / 404 |
| POST | `/api/turnos` | Registrar turno | 201 / 400 |
| PATCH | `/api/turnos/:id/iniciar` | Pendiente → En atención | 200 / 409 |
| PATCH | `/api/turnos/:id/finalizar` | En atención → Finalizado | 200 / 409 |
| PATCH | `/api/turnos/:id/estado` | Cambiar estado (valida transición) | 200 / 400 / 409 |
| DELETE | `/api/turnos/:id` | Eliminar turno | 200 / 404 |
| GET | `/api/health` | Diagnóstico del servicio | 200 |

**Cuerpo para crear un turno:**

```json
{ "solicitante": "Ana Torres", "tipoAtencion": "General" }
```

**Códigos de error usados:**

| Código | Significado en este sistema |
|---|---|
| 400 | Datos inválidos o estado/transición no permitida |
| 401 | Falta el token o es inválido/expirado |
| 404 | Turno no encontrado |
| 409 | Conflicto: el turno ya fue tomado o la transición no aplica |
| 500 | Error interno |

---

## 🖧 Protocolo TCP (puerto 5000)

Los mensajes son **objetos JSON terminados en salto de línea `\n`**.

### Cliente → Servidor

```json
{"tipo":"LOGIN","usuario":"santiago"}
{"tipo":"CONSULTAR","codigo":"T-001"}
{"tipo":"LISTAR"}
{"tipo":"AYUDA"}
{"tipo":"PING"}
{"tipo":"SALIR"}
```

### Servidor → Cliente

```json
{"tipo":"BIENVENIDA","mensaje":"...","requiere":"LOGIN","estudiante":"..."}
{"tipo":"LOGIN_OK","usuario":"santiago","mensaje":"Bienvenido santiago"}
{"tipo":"TURNO","turno":{"codigo":"T-001","solicitante":"Ana Torres","estado":"Pendiente"}}
{"tipo":"TURNOS","total":4,"turnos":[...]}
{"tipo":"ERROR","mensaje":"Debe identificarse primero con LOGIN"}
{"tipo":"ADIOS","mensaje":"..."}
```

### Requerimientos cubiertos

| Requerimiento | Implementación |
|---|---|
| 1. Múltiples clientes simultáneos | Cada socket se guarda en un `Map`; nodo es asíncrono por evento |
| 2. Identificación por nombre de usuario | Comando `LOGIN` obligatorio antes de consultar |
| 3. Consulta por código | Comando `CONSULTAR` → `turnoService.consultarPorCodigo` |
| 4. Respuesta con código, solicitante y estado | Objeto `turno` en la respuesta |
| 5. Desconexión gestionada | Eventos `close` y `error`, timeout de 5 min por inactividad |

### Usar el cliente TCP

```bash
# Consulta directa (ideal para capturas)
node clientes/clienteTCP.js santiago T-001

# Menú interactivo
node clientes/clienteTCP.js
```

---

## 📡 Protocolo UDP (puerto 5001)

Un datagrama JSON por consulta; la respuesta va a la IP/puerto del remitente.

### Cliente → Servidor

```json
{"tipo":"ESTADISTICAS","cliente":"santiago"}
{"tipo":"PENDIENTES","cliente":"maria"}
{"tipo":"EN_ATENCION","cliente":"maria"}
{"tipo":"FINALIZADOS","cliente":"santiago"}
```

### Servidor → Cliente

```json
{
  "tipo": "ESTADISTICAS",
  "pendientes": 3,
  "enAtencion": 1,
  "finalizados": 0,
  "total": 4,
  "cliente": "santiago",
  "protocolo": "UDP",
  "hora": "16/11/2026, 18:45:12"
}
```

### Usar el cliente UDP

```bash
# Todas las consultas de una vez
node clientes/clienteUDP.js santiago

# Consulta puntual
node clientes/clienteUDP.js maria PENDIENTES

# Menú interactivo
node clientes/clienteUDP.js
```

> Para la evidencia se deben mostrar **al menos dos clientes UDP** distintos.

---

## ⚡ Eventos WebSocket

| Evento | Dirección | Contenido |
|---|---|---|
| `estado:inicial` | servidor → cliente | `{ turnos, estadisticas, conectados, usuario }` |
| `turno:creado` | servidor → todos | `{ turno, usuario, mensaje, fecha }` |
| `turno:actualizado` | servidor → todos | `{ turno, usuario, accion, estadoAnterior, mensaje }` |
| `turno:eliminado` | servidor → todos | `{ turno, usuario, mensaje }` |
| `estadisticas` | servidor → todos | `{ pendientes, enAtencion, finalizados, total }` |
| `clientes:total` | servidor → todos | `{ conectados }` |
| `solicitar:estado` | cliente → servidor | Pide refresco completo |

**Requisitos de la Parte 3 y su implementación:**

| Requisito | Implementación |
|---|---|
| Visualizar turnos y estados | Tabla `public/index.html` + `app.js` |
| Seleccionar turno pendiente | Botón **Iniciar atención** |
| Finalizar atención | Botón **Finalizar** |
| Actualización automática en todos los navegadores | `io.emit()` en `turno.socket.js` |
| Colores distintos por estado | Ámbar / azul / verde en `styles.css` |
| Identificar al usuario que cambió el estado | Campos `iniciadoPor`, `finalizadoPor` e `historial` |
| No dos usuarios inician el mismo turno | `findOneAndUpdate` con filtro `{ estado: 'Pendiente' }` (atómico) → 409 al segundo |
| Validación del estado en el servidor | `turnoService` + matriz `TRANSICIONES` |
| Clientes tardíos reciben el estado actual | Evento `estado:inicial` al conectar |

---

## ▶️ Modos de ejecución

| Comando | Descripción |
|---|---|
| `npm run mongo:start` | **Arranca MongoDB portable** (`localhost:27017`) |
| `npm run mongo:stop` | Detiene MongoDB portable |
| `npm start` | **Todo el sistema** en un proceso (requiere MongoDB activo) |
| `npm run dev` | Igual, con recarga automática (nodemon) |
| `npm run seed` | Carga usuarios y turnos de prueba |
| `npm run tcp` | Solo el servidor TCP (demuestra independencia) |
| `npm run udp` | Solo el servidor UDP |
| `npm run cliente:tcp` | Cliente TCP interactivo |
| `npm run cliente:udp` | Cliente UDP interactivo |

### Secuencia completa desde cero

```bash
npm install          # 1. dependencias
copy .env.example .env   # 2. configuracion (colocar JWT_SECRET)
npm run mongo:start  # 3. base de datos
npm run seed         # 4. usuarios y turnos de prueba
npm start            # 5. sistema completo
```

---

## 🧪 Escenario de integración (Parte 5)

1. Registrar un usuario y **iniciar sesión** → Postman o interfaz web.
2. Crear **tres turnos** mediante la API REST (`POST /api/turnos`).
3. Consultar uno de los turnos con el **cliente TCP**:
   ```bash
   node clientes/clienteTCP.js santiago T-001
   ```
4. Consultar las **estadísticas por UDP**:
   ```bash
   node clientes/clienteUDP.js maria ESTADISTICAS
   ```
5. Abrir la interfaz web en **dos navegadores** (`http://localhost:3000`) con
   usuarios distintos (`santiago` y `maria`).
6. En el navegador 1, pulsar **Iniciar atención** sobre un turno pendiente.
   El navegador 2 debe mostrar el cambio **sin recargar**, junto con el nombre
   del usuario que lo realizó.
7. Consultar nuevamente ese turno por TCP y comprobar que el estado coincide
   con el de REST, UDP y la interfaz web.

---

## 🛡️ Seguridad

- Contraseñas cifradas con **bcrypt** (10 rondas); nunca se almacenan en texto plano.
- Tokens **JWT** con expiración configurable (`JWT_EXPIRES`).
- El archivo `.env` está en `.gitignore`; el repositorio solo incluye `.env.example`.
- Validación de todos los datos obligatorios antes de llegar a MongoDB.

---

## 🧰 Solución de problemas

| Síntoma | Causa / solución |
|---|---|
| `No fue posible conectar con MongoDB` | Ejecutar `npm run mongo:start` (o `docker compose up -d`) y verificar que el puerto 27017 responda |
| `[ERROR] No se encontro mongod.exe` | Falta la carpeta `.mongodb\server`; descargue el ZIP oficial y extráigalo según el paso 1 |
| MongoDB no arranca y no genera log | Falta el paquete Visual C++ Redistributable: ejecutar como administrador `.mongodb\server\bin\vc_redist.x64.exe` |
| `EADDRINUSE` en 3000/5000/5001 | Otro proceso usa el puerto: cerrarlo o cambiar el puerto en `.env` |
| `EADDRINUSE` en 27017 | Ya hay un `mongod` activo: `npm run mongo:stop` o cierre el servicio de MongoDB |
| `401 Token inválido` | El `JWT_SECRET` cambió: volver a iniciar sesión |
| La interfaz no muestra cambios | Verificar en DevTools → Network → WS que Socket.IO esté conectado |
| `No se recibió respuesta` en el cliente UDP | El servidor UDP debe estar activo (`npm start`) |
| Se duplican turnos al ejecutar `npm run seed` | El script no duplica; si desea reiniciar, detenga MongoDB y borre `.mongodb\data` |

---

## 📚 Bibliografía

- Node.js Foundation. 2024. *Node.js Documentation v20*. <https://nodejs.org/docs/>
- Socket.IO. 2024. *Socket.IO Documentation v4*. <https://socket.io/docs/v4/>
- MongoDB Inc. 2024. *Mongoose Documentation v8*. <https://mongoosejs.com/docs/>
- Jones M., Bradley J., Sakimura N. 2015. *JSON Web Token (JWT)*. RFC 7519, IETF.
- Express.js. 2024. *Express 4.x API Reference*. <https://expressjs.com/>
