use axum::{
    extract::{Path, Query, State},
    routing::{delete, get},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    auth::{hash_password, AuthUser},
    error::{AppError, AppResult},
    models::{Page, UpdateUserInput, User, USER_COLUMNS},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct UserQuery {
    pub q: Option<String>,
    pub city: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_users))
        .route("/{id}", get(get_user).put(update_user))
        .route("/{id}", delete(delete_user))
}

async fn list_users(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<UserQuery>,
) -> AppResult<Json<Page<User>>> {
    let page = q.page.unwrap_or(1).max(1);
    let per_page = q.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;
    let search = q.q.map(|s| format!("%{}%", s.trim().to_lowercase()));

    let filter = "WHERE is_active \
        AND ($1::text IS NULL OR lower(username) LIKE $1 OR lower(full_name) LIKE $1) \
        AND ($2::text IS NULL OR city = $2)";

    let total: (i64,) = sqlx::query_as(&format!("SELECT COUNT(*) FROM users {filter}"))
        .bind(search.as_deref())
        .bind(q.city.as_deref())
        .fetch_one(&state.db)
        .await?;

    let items: Vec<User> = sqlx::query_as(&format!(
        "SELECT {USER_COLUMNS} FROM users {filter} ORDER BY created_at DESC LIMIT $3 OFFSET $4"
    ))
    .bind(search.as_deref())
    .bind(q.city.as_deref())
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(Page {
        items,
        total: total.0,
        page,
        per_page,
    }))
}

async fn get_user(State(state): State<AppState>, Path(id): Path<Uuid>) -> AppResult<Json<User>> {
    let user: User = sqlx::query_as(&format!("SELECT {USER_COLUMNS} FROM users WHERE id = $1"))
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Usuario no encontrado".into()))?;
    Ok(Json(user))
}

async fn update_user(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateUserInput>,
) -> AppResult<Json<User>> {
    auth.require_owner(id)?;

    let password_hash = match input.password.as_deref() {
        Some(p) if p.len() < 8 => {
            return Err(AppError::BadRequest(
                "La contrasena debe tener al menos 8 caracteres".into(),
            ))
        }
        Some(p) => Some(hash_password(p)?),
        None => None,
    };

    let user: User = sqlx::query_as(&format!(
        "UPDATE users SET \
            full_name = COALESCE($2::text, full_name), \
            username = COALESCE($3::text, username), \
            bio = COALESCE($4::text, bio), \
            avatar_url = COALESCE($5::text, avatar_url), \
            phone = COALESCE($6::text, phone), \
            city = COALESCE($7::text, city), \
            neighborhood = COALESCE($8::text, neighborhood), \
            latitude = COALESCE($9::float8, latitude), \
            longitude = COALESCE($10::float8, longitude), \
            preferred_sizes = COALESCE($11::text[], preferred_sizes), \
            preferred_styles = COALESCE($12::text[], preferred_styles), \
            max_distance_km = COALESCE($13::int4, max_distance_km), \
            password_hash = COALESCE($14::text, password_hash), \
            updated_at = now() \
         WHERE id = $1 RETURNING {USER_COLUMNS}"
    ))
    .bind(id)
    .bind(input.full_name)
    .bind(input.username.map(|u| u.trim().to_lowercase()))
    .bind(input.bio)
    .bind(input.avatar_url)
    .bind(input.phone)
    .bind(input.city)
    .bind(input.neighborhood)
    .bind(input.latitude)
    .bind(input.longitude)
    .bind(input.preferred_sizes)
    .bind(input.preferred_styles)
    .bind(input.max_distance_km)
    .bind(password_hash)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Usuario no encontrado".into()))?;

    Ok(Json(user))
}

async fn delete_user(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    auth.require_owner(id)?;
    let res = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("Usuario no encontrado".into()));
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}
