use std::collections::HashMap;

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult},
    models::{
        FeedQuery, Garment, GarmentImage, GarmentInput, GarmentQuery, GarmentRow, GarmentUpdate,
        ImageInput, Page, GARMENT_COLUMNS,
    },
    state::AppState,
};

const FROM_JOIN: &str = "FROM garments g \
     JOIN users u ON u.id = g.owner_id \
     LEFT JOIN categories c ON c.id = g.category_id";

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/mine", get(mine))
        .route("/feed", get(feed))
        .route("/{id}", get(get_one).put(update).delete(remove))
        .route("/{id}/images", get(list_images).post(add_image))
        .route("/{id}/images/{image_id}", axum::routing::delete(delete_image))
}

/// Adjunta las imagenes correspondientes a un conjunto de prendas.
pub async fn attach_images(db: &PgPool, rows: Vec<GarmentRow>) -> AppResult<Vec<Garment>> {
    if rows.is_empty() {
        return Ok(Vec::new());
    }
    let ids: Vec<Uuid> = rows.iter().map(|r| r.id).collect();
    let images: Vec<GarmentImage> = sqlx::query_as(
        "SELECT * FROM garment_images WHERE garment_id = ANY($1) ORDER BY position, created_at",
    )
    .bind(&ids)
    .fetch_all(db)
    .await?;

    let mut grouped: HashMap<Uuid, Vec<GarmentImage>> = HashMap::new();
    for image in images {
        grouped.entry(image.garment_id).or_default().push(image);
    }

    Ok(rows
        .into_iter()
        .map(|garment| {
            let images = grouped.remove(&garment.id).unwrap_or_default();
            Garment { garment, images }
        })
        .collect())
}

async fn fetch_garment(db: &PgPool, id: Uuid) -> AppResult<Garment> {
    let row: GarmentRow = sqlx::query_as(&format!(
        "SELECT {GARMENT_COLUMNS}, NULL::float8 AS distance_km {FROM_JOIN} WHERE g.id = $1"
    ))
    .bind(id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::NotFound("Prenda no encontrada".into()))?;

    Ok(attach_images(db, vec![row]).await?.remove(0))
}

async fn owner_of(db: &PgPool, id: Uuid) -> AppResult<Uuid> {
    let row: Option<(Uuid,)> = sqlx::query_as("SELECT owner_id FROM garments WHERE id = $1")
        .bind(id)
        .fetch_optional(db)
        .await?;
    row.map(|r| r.0)
        .ok_or_else(|| AppError::NotFound("Prenda no encontrada".into()))
}

async fn list(
    State(state): State<AppState>,
    Query(q): Query<GarmentQuery>,
) -> AppResult<Json<Page<Garment>>> {
    let page = q.page.unwrap_or(1).max(1);
    let per_page = q.per_page.unwrap_or(12).clamp(1, 60);
    let offset = (page - 1) * per_page;
    let search = q.q.map(|s| format!("%{}%", s.trim().to_lowercase()));

    let filter = "WHERE ($1::text IS NULL OR lower(g.title) LIKE $1 \
            OR lower(COALESCE(g.description, '')) LIKE $1 \
            OR lower(COALESCE(g.brand, '')) LIKE $1) \
        AND ($2::uuid IS NULL OR g.category_id = $2) \
        AND ($3::uuid IS NULL OR g.owner_id = $3) \
        AND ($4::text IS NULL OR g.size = $4) \
        AND ($5::text IS NULL OR g.condition = $5) \
        AND ($6::text IS NULL OR g.mode = $6 OR g.mode = 'ambos') \
        AND ($7::text IS NULL OR g.status = $7) \
        AND ($8::numeric IS NULL OR g.price >= $8) \
        AND ($9::numeric IS NULL OR g.price <= $9)";

    let total: (i64,) = sqlx::query_as(&format!("SELECT COUNT(*) {FROM_JOIN} {filter}"))
        .bind(search.as_deref())
        .bind(q.category_id)
        .bind(q.owner_id)
        .bind(q.size.as_deref())
        .bind(q.condition.as_deref())
        .bind(q.mode.as_deref())
        .bind(q.status.as_deref())
        .bind(q.min_price)
        .bind(q.max_price)
        .fetch_one(&state.db)
        .await?;

    let rows: Vec<GarmentRow> = sqlx::query_as(&format!(
        "SELECT {GARMENT_COLUMNS}, NULL::float8 AS distance_km {FROM_JOIN} {filter} \
         ORDER BY g.created_at DESC LIMIT $10 OFFSET $11"
    ))
    .bind(search.as_deref())
    .bind(q.category_id)
    .bind(q.owner_id)
    .bind(q.size.as_deref())
    .bind(q.condition.as_deref())
    .bind(q.mode.as_deref())
    .bind(q.status.as_deref())
    .bind(q.min_price)
    .bind(q.max_price)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(Page {
        items: attach_images(&state.db, rows).await?,
        total: total.0,
        page,
        per_page,
    }))
}

async fn mine(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<Vec<Garment>>> {
    let rows: Vec<GarmentRow> = sqlx::query_as(&format!(
        "SELECT {GARMENT_COLUMNS}, NULL::float8 AS distance_km {FROM_JOIN} \
         WHERE g.owner_id = $1 ORDER BY g.created_at DESC"
    ))
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(attach_images(&state.db, rows).await?))
}

/// Baraja de descubrimiento: prendas no evaluadas, priorizadas por talla,
/// estilo preferido y cercania geografica al usuario.
async fn feed(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<FeedQuery>,
) -> AppResult<Json<Vec<Garment>>> {
    let limit = q.limit.unwrap_or(20).clamp(1, 50);

    let me: (Option<f64>, Option<f64>, Vec<String>, Vec<String>, i32) = sqlx::query_as(
        "SELECT latitude, longitude, preferred_sizes, preferred_styles, max_distance_km \
         FROM users WHERE id = $1",
    )
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    let sql = format!(
        "SELECT {GARMENT_COLUMNS}, \
            CASE WHEN $2::float8 IS NOT NULL AND g.latitude IS NOT NULL THEN \
                6371 * acos(LEAST(1, GREATEST(-1, \
                    cos(radians($2::float8)) * cos(radians(g.latitude)) * \
                    cos(radians(g.longitude) - radians($3::float8)) + \
                    sin(radians($2::float8)) * sin(radians(g.latitude))))) \
            END AS distance_km \
         {FROM_JOIN} \
         WHERE g.owner_id <> $1 AND g.status = 'disponible' AND u.is_active \
           AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.user_id = $1 AND s.garment_id = g.id) \
           AND ($4::text IS NULL OR g.mode = $4 OR g.mode = 'ambos') \
           AND ($5::uuid IS NULL OR g.category_id = $5) \
         ORDER BY (g.size = ANY($6::text[])) DESC, \
                  (COALESCE(g.style, '') = ANY($7::text[])) DESC, \
                  distance_km ASC NULLS LAST, g.created_at DESC \
         LIMIT $8"
    );

    let rows: Vec<GarmentRow> = sqlx::query_as(&sql)
        .bind(auth.id)
        .bind(me.0)
        .bind(me.1)
        .bind(q.mode.as_deref())
        .bind(q.category_id)
        .bind(&me.2)
        .bind(&me.3)
        .bind(limit)
        .fetch_all(&state.db)
        .await?;

    Ok(Json(attach_images(&state.db, rows).await?))
}

async fn get_one(State(state): State<AppState>, Path(id): Path<Uuid>) -> AppResult<Json<Garment>> {
    sqlx::query("UPDATE garments SET views = views + 1 WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(fetch_garment(&state.db, id).await?))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<GarmentInput>,
) -> AppResult<Json<Garment>> {
    if input.title.trim().is_empty() {
        return Err(AppError::BadRequest("El titulo es obligatorio".into()));
    }
    if input.size.trim().is_empty() {
        return Err(AppError::BadRequest("La talla es obligatoria".into()));
    }

    let mut tx = state.db.begin().await?;

    let (id,): (Uuid,) = sqlx::query_as(
        "INSERT INTO garments (owner_id, category_id, title, description, brand, color, style, \
            size, condition, mode, status, price, latitude, longitude) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::text, 'buen_estado'), \
            COALESCE($10::text, 'ambos'), COALESCE($11::text, 'disponible'), $12, \
            COALESCE($13::float8, (SELECT latitude FROM users WHERE id = $1)), \
            COALESCE($14::float8, (SELECT longitude FROM users WHERE id = $1))) \
         RETURNING id",
    )
    .bind(auth.id)
    .bind(input.category_id)
    .bind(input.title.trim())
    .bind(input.description)
    .bind(input.brand)
    .bind(input.color)
    .bind(input.style)
    .bind(input.size.trim())
    .bind(input.condition)
    .bind(input.mode)
    .bind(input.status)
    .bind(input.price)
    .bind(input.latitude)
    .bind(input.longitude)
    .fetch_one(&mut *tx)
    .await?;

    for (index, url) in input.images.unwrap_or_default().iter().enumerate() {
        sqlx::query("INSERT INTO garment_images (garment_id, url, position) VALUES ($1, $2, $3)")
            .bind(id)
            .bind(url)
            .bind(index as i32)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok(Json(fetch_garment(&state.db, id).await?))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<GarmentUpdate>,
) -> AppResult<Json<Garment>> {
    auth.require_owner(owner_of(&state.db, id).await?)?;

    let mut tx = state.db.begin().await?;

    sqlx::query(
        "UPDATE garments SET \
            title = COALESCE($2::text, title), \
            description = COALESCE($3::text, description), \
            category_id = COALESCE($4::uuid, category_id), \
            brand = COALESCE($5::text, brand), \
            color = COALESCE($6::text, color), \
            style = COALESCE($7::text, style), \
            size = COALESCE($8::text, size), \
            condition = COALESCE($9::text, condition), \
            mode = COALESCE($10::text, mode), \
            status = COALESCE($11::text, status), \
            price = COALESCE($12::numeric, price), \
            latitude = COALESCE($13::float8, latitude), \
            longitude = COALESCE($14::float8, longitude), \
            updated_at = now() \
         WHERE id = $1",
    )
    .bind(id)
    .bind(input.title)
    .bind(input.description)
    .bind(input.category_id)
    .bind(input.brand)
    .bind(input.color)
    .bind(input.style)
    .bind(input.size)
    .bind(input.condition)
    .bind(input.mode)
    .bind(input.status)
    .bind(input.price)
    .bind(input.latitude)
    .bind(input.longitude)
    .execute(&mut *tx)
    .await?;

    if let Some(images) = input.images {
        sqlx::query("DELETE FROM garment_images WHERE garment_id = $1")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        for (index, url) in images.iter().enumerate() {
            sqlx::query(
                "INSERT INTO garment_images (garment_id, url, position) VALUES ($1, $2, $3)",
            )
            .bind(id)
            .bind(url)
            .bind(index as i32)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(Json(fetch_garment(&state.db, id).await?))
}

async fn remove(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    auth.require_owner(owner_of(&state.db, id).await?)?;
    sqlx::query("DELETE FROM garments WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn list_images(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<GarmentImage>>> {
    let images: Vec<GarmentImage> = sqlx::query_as(
        "SELECT * FROM garment_images WHERE garment_id = $1 ORDER BY position, created_at",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(images))
}

async fn add_image(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<ImageInput>,
) -> AppResult<Json<GarmentImage>> {
    auth.require_owner(owner_of(&state.db, id).await?)?;
    let image: GarmentImage = sqlx::query_as(
        "INSERT INTO garment_images (garment_id, url, position) \
         VALUES ($1, $2, COALESCE($3::int4, \
            (SELECT COUNT(*) FROM garment_images WHERE garment_id = $1)::int4)) RETURNING *",
    )
    .bind(id)
    .bind(input.url)
    .bind(input.position)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(image))
}

async fn delete_image(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, image_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    auth.require_owner(owner_of(&state.db, id).await?)?;
    let res = sqlx::query("DELETE FROM garment_images WHERE id = $1 AND garment_id = $2")
        .bind(image_id)
        .bind(id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("Imagen no encontrada".into()));
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}
