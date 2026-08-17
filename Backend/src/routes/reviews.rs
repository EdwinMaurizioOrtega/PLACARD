use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult},
    models::{Review, ReviewInput, ReviewUpdate},
    state::AppState,
};

const REVIEW_SELECT: &str = "SELECT r.id, r.match_id, r.reviewer_id, r.reviewee_id, r.rating, \
        r.comment, r.created_at, u.username AS reviewer_username, \
        u.avatar_url AS reviewer_avatar_url \
     FROM reviews r JOIN users u ON u.id = r.reviewer_id";

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_mine).post(create))
        .route("/user/{id}", get(list_for_user))
        .route("/{id}", axum::routing::put(update).delete(remove))
}

async fn list_for_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<Review>>> {
    let items: Vec<Review> = sqlx::query_as(&format!(
        "{REVIEW_SELECT} WHERE r.reviewee_id = $1 ORDER BY r.created_at DESC"
    ))
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(items))
}

async fn list_mine(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<Vec<Review>>> {
    let items: Vec<Review> = sqlx::query_as(&format!(
        "{REVIEW_SELECT} WHERE r.reviewer_id = $1 ORDER BY r.created_at DESC"
    ))
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(items))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<ReviewInput>,
) -> AppResult<Json<Review>> {
    if !(1..=5).contains(&input.rating) {
        return Err(AppError::BadRequest("La calificacion debe ir de 1 a 5".into()));
    }
    if input.reviewee_id == auth.id {
        return Err(AppError::BadRequest("No puedes calificarte a ti mismo".into()));
    }

    let (id,): (Uuid,) = sqlx::query_as(
        "INSERT INTO reviews (match_id, reviewer_id, reviewee_id, rating, comment) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(input.match_id)
    .bind(auth.id)
    .bind(input.reviewee_id)
    .bind(input.rating)
    .bind(input.comment)
    .fetch_one(&state.db)
    .await?;

    let review: Review = sqlx::query_as(&format!("{REVIEW_SELECT} WHERE r.id = $1"))
        .bind(id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(review))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<ReviewUpdate>,
) -> AppResult<Json<Review>> {
    if let Some(rating) = input.rating {
        if !(1..=5).contains(&rating) {
            return Err(AppError::BadRequest("La calificacion debe ir de 1 a 5".into()));
        }
    }
    let updated: Option<(Uuid,)> = sqlx::query_as(
        "UPDATE reviews SET rating = COALESCE($3::int4, rating), \
            comment = COALESCE($4::text, comment) \
         WHERE id = $1 AND reviewer_id = $2 RETURNING id",
    )
    .bind(id)
    .bind(auth.id)
    .bind(input.rating)
    .bind(input.comment)
    .fetch_optional(&state.db)
    .await?;

    updated.ok_or_else(|| AppError::NotFound("Resena no encontrada".into()))?;

    let review: Review = sqlx::query_as(&format!("{REVIEW_SELECT} WHERE r.id = $1"))
        .bind(id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(review))
}

async fn remove(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let res = sqlx::query("DELETE FROM reviews WHERE id = $1 AND reviewer_id = $2")
        .bind(id)
        .bind(auth.id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("Resena no encontrada".into()));
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}
