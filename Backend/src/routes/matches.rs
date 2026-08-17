use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult},
    models::{
        Garment, GarmentRow, MatchRow, MatchStatusInput, Message, MessageInput, GARMENT_COLUMNS,
    },
    routes::{garments::attach_images, swipes::fetch_match, swipes::MATCH_SELECT},
    state::AppState,
};

#[derive(Debug, Serialize)]
struct MatchDetail {
    #[serde(flatten)]
    info: MatchRow,
    garments: Vec<Garment>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list))
        .route("/{id}", get(detail).patch(update_status).delete(remove))
        .route("/{id}/messages", get(list_messages).post(send_message))
        .route("/{id}/read", post(mark_read))
}

async fn ensure_member(state: &AppState, auth: &AuthUser, match_id: Uuid) -> AppResult<()> {
    let exists: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM matches WHERE id = $1 AND (user_a = $2 OR user_b = $2)",
    )
    .bind(match_id)
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?;
    exists
        .map(|_| ())
        .ok_or_else(|| AppError::NotFound("Match no encontrado".into()))
}

async fn list(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<Vec<MatchRow>>> {
    let items: Vec<MatchRow> = sqlx::query_as(&format!(
        "{MATCH_SELECT} WHERE (m.user_a = $1 OR m.user_b = $1) \
         ORDER BY COALESCE(lm.created_at, m.created_at) DESC"
    ))
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(items))
}

async fn detail(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<MatchDetail>> {
    let info = fetch_match(&state.db, auth.id, id).await?;
    let ids: Vec<Uuid> = [info.garment_a, info.garment_b]
        .into_iter()
        .flatten()
        .collect();

    let rows: Vec<GarmentRow> = sqlx::query_as(&format!(
        "SELECT {GARMENT_COLUMNS}, NULL::float8 AS distance_km FROM garments g \
         JOIN users u ON u.id = g.owner_id \
         LEFT JOIN categories c ON c.id = g.category_id WHERE g.id = ANY($1)"
    ))
    .bind(&ids)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(MatchDetail {
        info,
        garments: attach_images(&state.db, rows).await?,
    }))
}

async fn update_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<MatchStatusInput>,
) -> AppResult<Json<MatchRow>> {
    if !["activo", "cerrado", "cancelado"].contains(&input.status.as_str()) {
        return Err(AppError::BadRequest(
            "El estado debe ser activo, cerrado o cancelado".into(),
        ));
    }
    ensure_member(&state, &auth, id).await?;
    sqlx::query("UPDATE matches SET status = $2 WHERE id = $1")
        .bind(id)
        .bind(&input.status)
        .execute(&state.db)
        .await?;
    Ok(Json(fetch_match(&state.db, auth.id, id).await?))
}

async fn remove(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_member(&state, &auth, id).await?;
    sqlx::query("DELETE FROM matches WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn list_messages(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<Message>>> {
    ensure_member(&state, &auth, id).await?;
    let items: Vec<Message> =
        sqlx::query_as("SELECT * FROM messages WHERE match_id = $1 ORDER BY created_at")
            .bind(id)
            .fetch_all(&state.db)
            .await?;
    Ok(Json(items))
}

async fn send_message(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<MessageInput>,
) -> AppResult<Json<Message>> {
    ensure_member(&state, &auth, id).await?;
    if input.body.trim().is_empty() {
        return Err(AppError::BadRequest("El mensaje no puede estar vacio".into()));
    }
    let message: Message = sqlx::query_as(
        "INSERT INTO messages (match_id, sender_id, body) VALUES ($1, $2, $3) RETURNING *",
    )
    .bind(id)
    .bind(auth.id)
    .bind(input.body.trim())
    .fetch_one(&state.db)
    .await?;
    Ok(Json(message))
}

async fn mark_read(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_member(&state, &auth, id).await?;
    let res = sqlx::query(
        "UPDATE messages SET read_at = now() \
         WHERE match_id = $1 AND sender_id <> $2 AND read_at IS NULL",
    )
    .bind(id)
    .bind(auth.id)
    .execute(&state.db)
    .await?;
    Ok(Json(serde_json::json!({ "updated": res.rows_affected() })))
}

pub fn messages_router() -> Router<AppState> {
    Router::new().route("/{id}", axum::routing::put(edit_message).delete(delete_message))
}

async fn edit_message(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<MessageInput>,
) -> AppResult<Json<Message>> {
    let message: Message = sqlx::query_as(
        "UPDATE messages SET body = $3 WHERE id = $1 AND sender_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(auth.id)
    .bind(input.body.trim())
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Mensaje no encontrado".into()))?;
    Ok(Json(message))
}

async fn delete_message(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let res = sqlx::query("DELETE FROM messages WHERE id = $1 AND sender_id = $2")
        .bind(id)
        .bind(auth.id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("Mensaje no encontrado".into()));
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}
