use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult},
    models::{MatchRow, Swipe, SwipeInput, SwipeResult},
    state::AppState,
};

/// Consulta reutilizable de matches vista desde el usuario $1.
pub const MATCH_SELECT: &str = "SELECT m.id, m.user_a, m.user_b, m.garment_a, m.garment_b, \
        m.status, m.created_at, o.id AS other_user_id, o.username AS other_username, \
        o.full_name AS other_full_name, o.avatar_url AS other_avatar_url, \
        o.rating_avg AS other_rating, lm.body AS last_message, \
        lm.created_at AS last_message_at, COALESCE(un.total, 0) AS unread_count \
     FROM matches m \
     JOIN users o ON o.id = CASE WHEN m.user_a = $1 THEN m.user_b ELSE m.user_a END \
     LEFT JOIN LATERAL (SELECT body, created_at FROM messages \
        WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) lm ON TRUE \
     LEFT JOIN LATERAL (SELECT COUNT(*) AS total FROM messages \
        WHERE match_id = m.id AND sender_id <> $1 AND read_at IS NULL) un ON TRUE";

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
         WHERE g.owner_id = $1 AND s.direction IN ('like', 'super') \
         ORDER BY s.created_at DESC",
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(items))
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

    let owner: Option<(Uuid,)> = sqlx::query_as("SELECT owner_id FROM garments WHERE id = $1")
        .bind(input.garment_id)
        .fetch_optional(&state.db)
        .await?;
    let owner_id = owner
        .ok_or_else(|| AppError::NotFound("Prenda no encontrada".into()))?
        .0;

    if owner_id == auth.id {
        return Err(AppError::BadRequest(
            "No puedes evaluar tus propias prendas".into(),
        ));
    }

    let swipe: Swipe = sqlx::query_as(
        "INSERT INTO swipes (user_id, garment_id, direction) VALUES ($1, $2, $3) \
         ON CONFLICT (user_id, garment_id) \
         DO UPDATE SET direction = EXCLUDED.direction, created_at = now() RETURNING *",
    )
    .bind(auth.id)
    .bind(input.garment_id)
    .bind(&input.direction)
    .fetch_one(&state.db)
    .await?;

    if input.direction == "pass" {
        return Ok(Json(SwipeResult {
            swipe,
            matched: false,
            match_info: None,
        }));
    }

    // Reciprocidad: el dueño ya dio like a alguna prenda mia.
    let reciprocal: Option<(Uuid,)> = sqlx::query_as(
        "SELECT s.garment_id FROM swipes s \
         JOIN garments g ON g.id = s.garment_id \
         WHERE s.user_id = $1 AND g.owner_id = $2 AND s.direction IN ('like', 'super') \
         ORDER BY s.created_at DESC LIMIT 1",
    )
    .bind(owner_id)
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?;

    let Some((my_garment,)) = reciprocal else {
        return Ok(Json(SwipeResult {
            swipe,
            matched: false,
            match_info: None,
        }));
    };

    // user_a siempre es el UUID menor para respetar la unicidad del par.
    let (user_a, user_b, garment_a, garment_b) = if auth.id < owner_id {
        (auth.id, owner_id, my_garment, input.garment_id)
    } else {
        (owner_id, auth.id, input.garment_id, my_garment)
    };

    let (match_id,): (Uuid,) = sqlx::query_as(
        "INSERT INTO matches (user_a, user_b, garment_a, garment_b) VALUES ($1, $2, $3, $4) \
         ON CONFLICT (user_a, user_b) DO UPDATE SET status = 'activo' RETURNING id",
    )
    .bind(user_a)
    .bind(user_b)
    .bind(garment_a)
    .bind(garment_b)
    .fetch_one(&state.db)
    .await?;

    let info = fetch_match(&state.db, auth.id, match_id).await?;

    Ok(Json(SwipeResult {
        swipe,
        matched: true,
        match_info: Some(info),
    }))
}

pub async fn fetch_match(db: &PgPool, viewer: Uuid, match_id: Uuid) -> AppResult<MatchRow> {
    sqlx::query_as(&format!(
        "{MATCH_SELECT} WHERE m.id = $2 AND (m.user_a = $1 OR m.user_b = $1)"
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
