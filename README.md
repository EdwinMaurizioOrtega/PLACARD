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

Las migraciones y los datos de demostración se aplican automáticamente al arrancar la API.

## 2. Backend (`Backend/`)

Configuración en `Backend/.env`:

```
DATABASE_URL=postgresql://postgres:ededed@localhost:5432/placard_db
JWT_SECRET=placard-dev-secret-change-me
PORT=8080
CORS_ORIGINS=http://localhost:4200
```

```bash
cd Backend
cargo run          # http://localhost:8080/api
```

## 3. Frontend (`Frontend/`)

```bash
cd Frontend
npm install
npm start          # http://localhost:4200
```

La URL de la API se configura en `Frontend/src/app/core/api.service.ts` (`API_URL`).

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

## Módulos y endpoints

| Módulo | Endpoints |
| --- | --- |
| Autenticación | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Usuarios | `GET/PUT/DELETE /api/users/{id}`, `GET /api/users` |
| Categorías | `GET/POST /api/categories`, `GET/PUT/DELETE /api/categories/{id}` |
| Prendas | `GET/POST /api/garments`, `GET /api/garments/mine`, `GET /api/garments/feed`, `GET/PUT/DELETE /api/garments/{id}` |
| Imágenes | `GET/POST /api/garments/{id}/images`, `DELETE /api/garments/{id}/images/{imageId}` |
| Swipes | `GET/POST /api/swipes`, `GET /api/swipes/likes-received`, `DELETE /api/swipes/{id}` |
| Matches | `GET /api/matches`, `GET/PATCH/DELETE /api/matches/{id}` |
| Chat | `GET/POST /api/matches/{id}/messages`, `POST /api/matches/{id}/read`, `PUT/DELETE /api/messages/{id}` |
| Reputación | `GET/POST /api/reviews`, `GET /api/reviews/user/{id}`, `PUT/DELETE /api/reviews/{id}` |
| Estadísticas | `GET /api/stats/overview` |

## Lógica de match

Un *match* se crea cuando dos usuarios dieron `like` (o `super`) a alguna prenda del otro. El par
se almacena de forma única ordenando los UUID, y a partir de ahí se habilita el chat, el cambio de
estado del intercambio y la calificación mutua.

El feed (`/api/garments/feed`) excluye las prendas propias y las ya evaluadas, y las ordena por
coincidencia de talla, coincidencia de estilo preferido y distancia haversine a la ubicación del
usuario.
