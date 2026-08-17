use axum::{
    extract::{Path, Query, State},
    routing::{delete, get},
    Json, Router,
};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult},
    models::{
        BlockInput, BlockedUser, Report, ReportInput, ReportQuery, ReportResolution,
        REPORT_REASONS,
    },
    state::AppState,
};

const REPORT_SELECT: &str = "SELECT r.id, r.reporter_id, r.target_user_id, r.target_garment_id, \
        r.reason, r.details, r.status, r.resolution, r.created_at, r.reviewed_at, \
        rep.username AS reporter_username, tu.username AS target_username, \
        tg.title AS target_garment_title \
     FROM reports r \
     JOIN users rep ON rep.id = r.reporter_id \
     LEFT JOIN users tu ON tu.id = r.target_user_id \
     LEFT JOIN garments tg ON tg.id = r.target_garment_id";

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/{id}", axum::routing::patch(resolve))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<ReportInput>,
) -> AppResult<Json<Report>> {
    if !REPORT_REASONS.contains(&input.reason.as_str()) {
        return Err(AppError::BadRequest("Motivo de reporte no valido".into()));
    }
    if input.target_user_id.is_none() && input.target_garment_id.is_none() {
        return Err(AppError::BadRequest(
            "Debes indicar el usuario o la prenda reportada".into(),
        ));
    }
    if input.target_user_id == Some(auth.id) {
        return Err(AppError::BadRequest("No puedes reportarte a ti mismo".into()));
    }

    let (id,): (Uuid,) = sqlx::query_as(
        "INSERT INTO reports (reporter_id, target_user_id, target_garment_id, reason, details) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(auth.id)
    .bind(input.target_user_id)
    .bind(input.target_garment_id)
    .bind(&input.reason)
    .bind(input.details)
    .fetch_one(&state.db)
    .await?;

    let report: Report = sqlx::query_as(&format!("{REPORT_SELECT} WHERE r.id = $1"))
        .bind(id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(report))
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ReportQuery>,
) -> AppResult<Json<Vec<Report>>> {
    auth.require_admin()?;
    let reports: Vec<Report> = sqlx::query_as(&format!(
        "{REPORT_SELECT} WHERE ($1::text IS NULL OR r.status = $1) \
         ORDER BY r.status = 'pendiente' DESC, r.created_at DESC"
    ))
    .bind(q.status.as_deref())
    .fetch_all(&state.db)
    .await?;
    Ok(Json(reports))
}

async fn resolve(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<ReportResolution>,
) -> AppResult<Json<Report>> {
    auth.require_admin()?;
    if !["pendiente", "revisado", "descartado"].contains(&input.status.as_str()) {
        return Err(AppError::BadRequest(
            "El estado debe ser pendiente, revisado o descartado".into(),
        ));
    }

    let res = sqlx::query(
        "UPDATE reports SET status = $2, resolution = $3, \
            reviewed_at = CASE WHEN $2 = 'pendiente' THEN NULL ELSE now() END \
         WHERE id = $1",
    )
    .bind(id)
    .bind(&input.status)
    .bind(input.resolution)
    .execute(&state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("Reporte no encontrado".into()));
    }

    let report: Report = sqlx::query_as(&format!("{REPORT_SELECT} WHERE r.id = $1"))
        .bind(id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(report))
}

pub fn blocks_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_blocks).post(block))
        .route("/{id}", delete(unblock))
}

async fn list_blocks(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<BlockedUser>>> {
    let items: Vec<BlockedUser> = sqlx::query_as(
        "SELECT b.blocked_id, u.username, u.full_name, u.avatar_url, b.created_at \
         FROM user_blocks b JOIN users u ON u.id = b.blocked_id \
         WHERE b.blocker_id = $1 ORDER BY b.created_at DESC",
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(items))
}

/// Bloquear elimina el match existente para que la conversacion no siga abierta.
async fn block(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<BlockInput>,
) -> AppResult<Json<serde_json::Value>> {
    if input.user_id == auth.id {
        return Err(AppError::BadRequest("No puedes bloquearte a ti mismo".into()));
    }

    let mut tx = state.db.begin().await?;

    sqlx::query(
        "INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) \
         ON CONFLICT DO NOTHING",
    )
    .bind(auth.id)
    .bind(input.user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "DELETE FROM matches WHERE (user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1)",
    )
    .bind(auth.id)
    .bind(input.user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "blocked": true })))
}

async fn unblock(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query("DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2")
        .bind(auth.id)
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "blocked": false })))
}
