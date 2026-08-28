use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult},
    models::{MatchRow, Swipe, SwipeInput, SwipeResult},
    state::AppState,
};

/// Consulta reutilizable de matches vista desde el usuario $1.
pub const MATCH_SELECT: &str = "SELECT m.id, m.interested_id, m.owner_id, m.garment_id, \
        m.intent, m.status, m.created_at, o.id AS other_user_id, o.username AS other_username, \
        o.full_name AS other_full_name, o.avatar_url AS other_avatar_url, \
        o.rating_avg AS other_rating, g.title AS garment_title, g.mode AS garment_mode, \
        g.price AS garment_price, gi.url AS garment_image, lm.body AS last_message, \
        lm.created_at AS last_message_at, COALESCE(un.total, 0) AS unread_count \
     FROM matches m \
     JOIN users o ON o.id = CASE WHEN m.interested_id = $1 THEN m.owner_id ELSE m.interested_id END \
     JOIN garments g ON g.id = m.garment_id \
     LEFT JOIN LATERAL (SELECT url FROM garment_images \
        WHERE garment_id = g.id ORDER BY position, created_at LIMIT 1) gi ON TRUE \
     LEFT JOIN LATERAL (SELECT body, created_at FROM messages \
        WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) lm ON TRUE \
     LEFT JOIN LATERAL (SELECT COUNT(*) AS total FROM messages \
        WHERE match_id = m.id AND sender_id <> $1 AND read_at IS NULL) un ON TRUE";

#[derive(Debug, Deserialize)]
struct SuperLikeInput {
    garment_id: Uuid,
}

#[derive(Debug, Serialize)]
struct SuperLikeResult {
    active: bool,
    super_likes: i32,
}

#[derive(Debug, Serialize, FromRow)]
struct LikeReceived {
    swipe_id: Uuid,
    direction: String,
    created_at: DateTime<Utc>,
    garment_id: Uuid,
    garment_title: String,
    user_id: Uuid,
    username: String,
    full_name: String,
    avatar_url: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/likes-received", get(likes_received))
        .route("/super", axum::routing::post(toggle_super))
        .route("/{id}", axum::routing::delete(remove))
}

async fn list(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<Vec<Swipe>>> {
    let items: Vec<Swipe> =
        sqlx::query_as("SELECT * FROM swipes WHERE user_id = $1 ORDER BY created_at DESC")
            .bind(auth.id)
            .fetch_all(&state.db)
            .await?;
    Ok(Json(items))
}

async fn likes_received(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<LikeReceived>>> {
    let items: Vec<LikeReceived> = sqlx::query_as(
        "SELECT s.id AS swipe_id, s.direction, s.created_at, g.id AS garment_id, \
                g.title AS garment_title, u.id AS user_id, u.username, u.full_name, u.avatar_url \
         FROM swipes s \
         JOIN garments g ON g.id = s.garment_id \
         JOIN users u ON u.id = s.user_id \
         WHERE g.owner_id = $1 AND s.direction = 'super' \
         ORDER BY s.created_at DESC",
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(items))
}

/// Valida que el usuario pueda interactuar con la prenda y devuelve (dueno, modalidad, titulo).
async fn interactable(
    state: &AppState,
    viewer: Uuid,
    garment_id: Uuid,
) -> AppResult<(Uuid, String, String)> {
    let owner: Option<(Uuid, String, String)> =
        sqlx::query_as("SELECT owner_id, mode, title FROM garments WHERE id = $1")
            .bind(garment_id)
            .fetch_optional(&state.db)
            .await?;
    let (owner_id, mode, title) =
        owner.ok_or_else(|| AppError::NotFound("Prenda no encontrada".into()))?;

    if owner_id == viewer {
        return Err(AppError::BadRequest(
            "No puedes evaluar tus propias prendas".into(),
        ));
    }

    let blocked: Option<(i64,)> = sqlx::query_as(
        "SELECT 1::int8 FROM user_blocks \
         WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) \
         LIMIT 1",
    )
    .bind(viewer)
    .bind(owner_id)
    .fetch_optional(&state.db)
    .await?;

    if blocked.is_some() {
        return Err(AppError::Forbidden(
            "No puedes interactuar con este usuario".into(),
        ));
    }

    Ok((owner_id, mode, title))
}

/// Pone o quita el super like del usuario sobre un anuncio. No abre conversacion.
async fn toggle_super(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<SuperLikeInput>,
) -> AppResult<Json<SuperLikeResult>> {
    interactable(&state, auth.id, input.garment_id).await?;

    let current: Option<(String,)> =
        sqlx::query_as("SELECT direction FROM swipes WHERE user_id = $1 AND garment_id = $2")
            .bind(auth.id)
            .bind(input.garment_id)
            .fetch_optional(&state.db)
            .await?;

    // Quitar el destacado deja el anuncio como descartado, sin perder el historial.
    let active = !matches!(current.as_ref(), Some((dir,)) if dir == "super");
    let direction = if active { "super" } else { "pass" };

    sqlx::query(
        "INSERT INTO swipes (user_id, garment_id, direction) VALUES ($1, $2, $3) \
         ON CONFLICT (user_id, garment_id) \
         DO UPDATE SET direction = EXCLUDED.direction, created_at = now(), \
                       times_seen = swipes.times_seen + 1",
    )
    .bind(auth.id)
    .bind(input.garment_id)
    .bind(direction)
    .execute(&state.db)
    .await?;

    let (super_likes,): (i32,) =
        sqlx::query_as("SELECT super_likes_count FROM garments WHERE id = $1")
            .bind(input.garment_id)
            .fetch_one(&state.db)
            .await?;

    Ok(Json(SuperLikeResult {
        active,
        super_likes,
    }))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<SwipeInput>,
) -> AppResult<Json<SwipeResult>> {
    if !["like", "pass", "super"].contains(&input.direction.as_str()) {
        return Err(AppError::BadRequest(
            "La direccion debe ser like, pass o super".into(),
        ));
    }

    let (owner_id, mode, title) = interactable(&state, auth.id, input.garment_id).await?;

    let swipe: Swipe = sqlx::query_as(
        "INSERT INTO swipes (user_id, garment_id, direction) VALUES ($1, $2, $3) \
         ON CONFLICT (user_id, garment_id) \
         DO UPDATE SET direction = EXCLUDED.direction, created_at = now(), \
                       times_seen = swipes.times_seen + 1 RETURNING *",
    )
    .bind(auth.id)
    .bind(input.garment_id)
    .bind(&input.direction)
    .fetch_one(&state.db)
    .await?;

    // Solo el 'me gusta' abre conversacion; 'pass' descarta y 'super' solo destaca.
    if input.direction != "like" {
        return Ok(Json(SwipeResult {
            swipe,
            matched: false,
            already: false,
            match_info: None,
        }));
    }

    // Ya habia conversacion abierta sobre este anuncio: no se duplica.
    let existing: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM matches WHERE interested_id = $1 AND garment_id = $2")
            .bind(auth.id)
            .bind(input.garment_id)
            .fetch_optional(&state.db)
            .await?;

    if let Some((match_id,)) = existing {
        let info = fetch_match(&state.db, auth.id, match_id).await?;
        return Ok(Json(SwipeResult {
            swipe,
            matched: false,
            already: true,
            match_info: Some(info),
        }));
    }

    let intent = resolve_intent(&mode, input.intent.as_deref())?;

    let (match_id,): (Uuid,) = sqlx::query_as(
        "INSERT INTO matches (interested_id, owner_id, garment_id, intent) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(auth.id)
    .bind(owner_id)
    .bind(input.garment_id)
    .bind(intent)
    .fetch_one(&state.db)
    .await?;

    let opening = if intent == "venta" {
        format!("¡Hola! Me interesa comprar tu prenda «{title}». ¿Sigue disponible?")
    } else {
        format!("¡Hola! Me interesa intercambiar tu prenda «{title}». ¿Te muestro mi clóset?")
    };

    sqlx::query("INSERT INTO messages (match_id, sender_id, body) VALUES ($1, $2, $3)")
        .bind(match_id)
        .bind(auth.id)
        .bind(&opening)
        .execute(&state.db)
        .await?;

    let info = fetch_match(&state.db, auth.id, match_id).await?;

    Ok(Json(SwipeResult {
        swipe,
        matched: true,
        already: false,
        match_info: Some(info),
    }))
}

/// La modalidad del anuncio manda; solo 'ambos' deja elegir al interesado.
fn resolve_intent<'a>(mode: &'a str, requested: Option<&'a str>) -> AppResult<&'a str> {
    match mode {
        "venta" => Ok("venta"),
        "intercambio" => Ok("intercambio"),
        _ => match requested {
            Some(value @ ("venta" | "intercambio")) => Ok(value),
            Some(_) => Err(AppError::BadRequest(
                "La intencion debe ser venta o intercambio".into(),
            )),
            None => Err(AppError::BadRequest(
                "Esta prenda admite venta e intercambio: indica cual te interesa".into(),
            )),
        },
    }
}

pub async fn fetch_match(db: &PgPool, viewer: Uuid, match_id: Uuid) -> AppResult<MatchRow> {
    sqlx::query_as(&format!(
        "{MATCH_SELECT} WHERE m.id = $2 AND (m.interested_id = $1 OR m.owner_id = $1)"
    ))
    .bind(viewer)
    .bind(match_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::NotFound("Match no encontrado".into()))
}

async fn remove(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let res = sqlx::query("DELETE FROM swipes WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(auth.id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("Swipe no encontrado".into()));
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}
