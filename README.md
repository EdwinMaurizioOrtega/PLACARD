# PLACARD S.A. — Plataforma web de moda circular

Aplicación tipo Tinder para descubrir, intercambiar y vender prendas de segunda mano en Cuenca.

- **Backend:** Rust (Axum + SQLx) sobre PostgreSQL
- **Frontend:** Angular 22 (standalone, signals, zoneless)
- **Base de datos:** `placard_db`

## Requisitos

Rust 1.80+, Node 20+, PostgreSQL 14+ en `localhost:5432`.

## 1. Base de datos

```bash
psql -h localhost -U postgres -c "CREATE DATABASE placard_db;"
```

Las migraciones, el catálogo base y los datos de demostración se aplican automáticamente al
arrancar la API. No hay que ejecutar nada a mano.

## 2. Backend (`Backend/`)

Configuración en `Backend/.env`:

```
DATABASE_URL=postgresql://postgres:ededed@localhost:5432/placard_db
JWT_SECRET=placard-dev-secret-change-me
JWT_HOURS=72
PORT=3000
CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
```

```bash
cd Backend
cargo run          # http://localhost:3000/api
```

Si aparece `Address already in use`, hay otra instancia viva:

```bash
lsof -ti tcp:3000 | xargs kill
```

## 3. Frontend (`Frontend/`)

```bash
cd Frontend
npm install
npm start          # http://localhost:4200
```

La URL de la API se define en `Frontend/.env` con `NG_APP_API_URL`. El script
`scripts/generate-env.mjs` la traduce a `src/environments/environment.ts` antes de cada
`start`, `build` y `test`, porque Angular no lee archivos `.env`.

## Usuarios de demostración

Contraseña de todos: `placard123`

| Correo | Rol |
| --- | --- |
| `admin@placard.ec` | administrador |
| `mariajose@placard.ec` | usuaria |
| `andrea@placard.ec` | usuaria |
| `camila@placard.ec` | usuaria |
| `daniela@placard.ec` | usuaria |
| `nicolas@placard.ec` | usuario |
| `valeria@placard.ec` | usuaria |

Además, `seed::demo()` genera **60 usuarios simulados** (`demo1`…`demo60`, misma contraseña) con
actividad repartida en los últimos 12 meses, para que la reportería del panel administrativo tenga
volumen. Solo corre mientras la base tiene menos de 200 swipes, así que no duplica datos en cada
arranque.

## Funcionalidades clave

### Match directo por anuncio

No hay reciprocidad: **el match se crea al instante al dar me gusta a un anuncio** y abre la
conversación con su dueño. Cada match es único por par `(interesado, anuncio)`, así que dos
anuncios del mismo vendedor generan dos conversaciones independientes.

Cada match lleva una **intención** derivada de la modalidad de la prenda:

| Modalidad del anuncio | Intención |
| --- | --- |
| `venta` | `venta` |
| `intercambio` | `intercambio` |
| `ambos` | la elige el interesado en un diálogo antes de enviar |

Al crearse, el sistema inserta un **mensaje automático** en el chat en nombre del interesado
("Me interesa comprar tu prenda X…"). Si ya existía conversación con ese anuncio, la API responde
`already: true` y no duplica nada.

### Super like como destacado

El botón ★ **no abre chat**: pone o quita un destacado público sobre el anuncio y muestra el
contador global de super likes. Se guarda en `swipes.direction = 'super'` y el trigger
`refresh_garment_likes` mantiene `garments.super_likes_count`.

### Baraja infinita

Cuando se agotan los anuncios nuevos, el feed se vuelve a repartir con `repeat=true` incluyendo los
ya evaluados, ordenados de menos a más vistos. Cada tarjeta muestra cuántas veces la has visto
(`swipes.times_seen`).

### Ubicación por sesión

Las coordenadas **se capturan al iniciar sesión**, no al registrarse, porque el usuario se mueve y
el feed depende de dónde está ahora. `AuthService.syncLocation()` pide la posición al navegador y
la guarda con `PUT /api/users/{id}`. Un indicador en la barra superior y un botón flotante permiten
activarla si el permiso está revocado; el estado real se vigila con la Permissions API.

### Parroquia deducida de las coordenadas

La parroquia no la escribe el usuario: la función SQL `nearest_parish(lat, lng)` busca la más
cercana entre las **36 parroquias de Cuenca** de la tabla `parishes` (15 urbanas, 21 rurales) con
la misma fórmula de Haversine que usa el feed. Se recalcula en cada login.

### Motor de recomendación del feed

`GET /api/garments/feed` excluye las prendas propias, las ocultas y las de usuarios bloqueados,
filtra por el radio máximo del usuario y ordena por:

1. Menos vistas primero
2. Afinidad: talla preferida (+3), estilo preferido (+2), historial de likes por categoría (×0,6) y por estilo (×0,4)
3. Distancia Haversine ascendente
4. Publicación más reciente

## Panel administrativo

`/admin` está dividido en cinco módulos con rutas propias y carga diferida:

| Módulo | Ruta | Contenido |
| --- | --- | --- |
| Resumen | `/admin/resumen` | KPIs generales y prendas por categoría |
| Reportería | `/admin/reporteria` | Cinco dashboards de inteligencia de negocios |
| Moderación | `/admin/moderacion` | Cola de reportes, ocultar prendas, suspender cuentas |
| Catálogo | `/admin/catalogo` | CRUD de categorías |
| Usuarios | `/admin/usuarios` | Búsqueda, suspensión y reactivación |

El módulo de **Reportería** consume `GET /api/stats/report` y presenta:

1. **Embudo de conversión** — vistas → me gusta → matches → chats → intercambios, con las tasas
   entre etapas; detecta y nombra la mayor fuga.
2. **Actividad mensual** — serie de 12 meses con `generate_series`, de modo que los meses sin
   movimiento aparecen en cero en lugar de desaparecer.
3. **Catálogo e inventario** — valor total, precio promedio, y desglose por categoría, modalidad,
   talla y estado.
4. **Geografía** — matches, usuarios y prendas por parroquia; reparto urbano/rural; distancia media
   real entre las dos partes de cada match.
5. **Comunidad y confianza** — calificación promedio, distribución 1–5 ⭐, matches sin mensajes y
   top de usuarios por reputación.

Los gráficos (`Frontend/src/app/shared/charts.ts`) son componentes SVG propios —barras, dona,
líneas, embudo y tarjetas KPI— sin dependencias externas.

## Módulos y endpoints

| Módulo | Endpoints |
| --- | --- |
| Autenticación | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Usuarios | `GET /api/users`, `GET/PUT/DELETE /api/users/{id}`, `PATCH /api/users/{id}/active` |
| Categorías | `GET/POST /api/categories`, `GET/PUT/DELETE /api/categories/{id}` |
| Prendas | `GET/POST /api/garments`, `GET /api/garments/mine`, `GET /api/garments/feed`, `GET/PUT/DELETE /api/garments/{id}`, `PATCH /api/garments/{id}/moderate` |
| Imágenes | `GET/POST /api/garments/{id}/images`, `DELETE /api/garments/{id}/images/{imageId}` |
| Swipes | `GET/POST /api/swipes`, `POST /api/swipes/super`, `GET /api/swipes/likes-received`, `DELETE /api/swipes/{id}` |
| Matches | `GET /api/matches`, `GET/PATCH/DELETE /api/matches/{id}` |
| Chat | `GET/POST /api/matches/{id}/messages`, `POST /api/matches/{id}/read`, `PUT/DELETE /api/messages/{id}` |
| Reputación | `GET/POST /api/reviews`, `GET /api/reviews/user/{id}`, `PUT/DELETE /api/reviews/{id}` |
| Moderación | `GET/POST /api/reports`, `PATCH /api/reports/{id}`, `GET/POST /api/blocks`, `DELETE /api/blocks/{id}` |
| Estadísticas | `GET /api/stats/overview`, `GET /api/stats/report` (solo admin) |

## Migraciones

| Archivo | Qué introduce |
| --- | --- |
| `0001_init.sql` | Esquema base: usuarios, categorías, prendas, imágenes, swipes, matches, mensajes, reseñas y triggers de reputación |
| `0002_moderation.sql` | Reportes y bloqueos entre usuarios |
| `0003_match_directo.sql` | `matches` pasa de par simétrico a conversación dirigida por anuncio (`interested_id`, `owner_id`, `garment_id`, `intent`) |
| `0004_baraja_infinita.sql` | `swipes.times_seen` |
| `0005_super_like_destacado.sql` | `garments.super_likes_count` y su trigger |
| `0006_parroquias.sql` | Tabla `parishes` y función `nearest_parish()` |

> Las migraciones ya aplicadas son **inmutables**: SQLx guarda su checksum y editarlas provoca
> `VersionMismatch`. Para cambiar algo, se crea una migración nueva.

## Aportación de cada asignatura

PLACARD S.A. es un proyecto integrador. Cada asignatura del sexto ciclo aporta una capa concreta
del sistema:

### 06_A Aplicaciones Web

Es el cuerpo del proyecto: la aplicación cliente-servidor completa.

- **Frontend Angular 22** con componentes *standalone*, *signals* para el estado reactivo y modo
  *zoneless*; enrutado con carga diferida y guards (`authGuard`, `adminGuard`, `guestGuard`).
- **API REST con Rust + Axum**: 11 grupos de rutas, verbos HTTP correctos y códigos de estado
  coherentes (400, 401, 403, 404).
- **Autenticación con JWT** y contraseñas cifradas con Argon2; interceptor HTTP que adjunta el
  token en el cliente.
- **CORS** configurable por entorno y variables de entorno traducidas a Angular con
  `scripts/generate-env.mjs`.
- **APIs del navegador**: Geolocation para la ubicación, Permissions API para vigilar el permiso y
  Pointer Events para el gesto de deslizar tarjetas.
- Interfaz responsive con sistema de diseño propio en CSS (variables, sin frameworks).

### 06_A Diseño y Arquitectura de Software

Las decisiones estructurales que sostienen el código.

- **Arquitectura en capas** en el backend: `routes/` (controladores), `models.rs` (contratos),
  `auth.rs` (seguridad transversal), `error.rs` (errores centralizados con `AppError` →
  respuesta HTTP), `state.rs` (inyección del pool de conexiones).
- **Modelado de datos y sus invariantes**: el rediseño de `matches` de par simétrico a conversación
  dirigida por anuncio, con `UNIQUE (interested_id, garment_id)` para que la regla de negocio
  "una conversación por anuncio" la garantice la base de datos y no el código.
- **Migraciones versionadas e inmutables** como historia del esquema.
- **Integridad delegada al motor**: `CHECK`, claves foráneas `ON DELETE CASCADE` y triggers
  (`refresh_user_rating`, `refresh_garment_likes`) que mantienen los contadores derivados.
- **Componentes reutilizables** en el frontend: la librería de gráficos SVG
  (`shared/charts.ts`) se consume por composición, sin dependencias externas.
- **Separación de responsabilidades en el panel admin**: un *shell* con rutas hijas en lugar de un
  componente monolítico.

### 06_A Gestión Empresarial y Emprendimiento

El proyecto no es solo software: es un modelo de negocio.

- **Propuesta de valor**: economía circular textil en Cuenca — alargar la vida útil de la ropa
  conectando a quien ya no la usa con quien la necesita.
- **Doble modalidad de transacción** (venta e intercambio) y la intención explícita del interesado
  como dato de negocio, no solo de producto.
- **Mecanismos de confianza** entre desconocidos: reputación con reseñas mutuas, reportes,
  bloqueos y suspensión de cuentas.
- **Segmentación geográfica** por parroquia y por zona urbana/rural para decidir dónde invertir en
  puntos de entrega y campañas.
- **Lecturas gerenciales** generadas automáticamente bajo cada gráfico de la reportería, que
  traducen el dato en una recomendación de acción.

### 06_A Inteligencia Artificial

El motor de recomendación que ordena la baraja de Descubrir.

- **Sistema de recomendación híbrido** basado en contenido y en señales implícitas de
  comportamiento, implementado en la consulta del feed:
  - *Preferencias declaradas*: coincidencia de talla (+3) y de estilo (+2).
  - *Aprendizaje del comportamiento*: historial de likes agregado por categoría (×0,6) y por
    estilo (×0,4), con tope para evitar la sobreespecialización.
  - *Contexto geográfico*: distancia real con la fórmula de Haversine y filtro por radio máximo.
  - *Exploración*: las prendas menos vistas se muestran primero, para no encerrar al usuario en un
    único tipo de resultado.
- **Clasificación geoespacial**: `nearest_parish()` asigna la parroquia por vecino más cercano
  sobre 36 centroides.
- Es un modelo **basado en reglas ponderadas**, no un modelo entrenado: la evolución natural sería
  sustituir los pesos fijos por filtrado colaborativo aprendido del historial real de swipes.

### 06_A Inteligencia de Negocios

El módulo de reportería del panel administrativo (`/admin/reporteria`).

- **Cinco dashboards** que responden a preguntas de negocio: embudo, evolución temporal, catálogo,
  geografía y comunidad.
- **Embudo de conversión** con las tasas entre etapas y detección automática de la mayor fuga.
- **Series temporales** de 12 meses construidas con `generate_series`, para que los periodos sin
  actividad se muestren en cero y no distorsionen la tendencia.
- **KPIs calculados**: valor de inventario, precio promedio, distancia media por match, cobertura
  de ubicación, calificación promedio, matches sin conversación.
- **Segmentación**: por categoría, talla, modalidad, estado, parroquia, tipo de zona e intención.
- **ETL ligero**: todas las métricas se agregan en SQL en una sola petición
  (`GET /api/stats/report`), sin duplicar datos en almacenes externos.
- Los datos alimentan un dataset equivalente al analizado en Power BI para la defensa.

### 06_A Proyectos Informáticos

La gestión del ciclo de vida del proyecto.

- **Desarrollo incremental**: cada funcionalidad se planificó, se implementó y se verificó antes de
  pasar a la siguiente (match directo → baraja infinita → super like → ubicación → reportería).
- **Control de versiones** y organización del repositorio en `Backend/`, `Frontend/` y `docs/`.
- **Gestión de entornos y configuración** por variables (`.env` en ambos lados) para separar
  desarrollo de producción.
- **Datos de prueba reproducibles**: `seed.rs` para el catálogo base y `demo.sql` para generar
  volumen realista, ambos idempotentes.
- **Documentación técnica** en este README y diagramas de arquitectura en `docs/`.
- **Verificación**: compilación de ambos proyectos, pruebas manuales de los flujos críticos y
  validación del esquema en la base antes de dar por cerrada cada entrega.
- **Despliegue**: frontend en Vercel, con CORS del backend ya preparado para ese origen.
