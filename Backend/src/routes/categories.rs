use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult},
    models::{Category, CategoryInput},
    state::AppState,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/{id}", get(get_one).put(update).delete(remove))
}

fn slugify(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'â' => 'a',
            'é' | 'è' | 'ë' | 'ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' => 'o',
            'ú' | 'ù' | 'ü' | 'û' => 'u',
            'ñ' => 'n',
            c if c.is_alphanumeric() => c,
            _ => '-',
        })
        .collect()
}

async fn list(State(state): State<AppState>) -> AppResult<Json<Vec<Category>>> {
    let items: Vec<Category> = sqlx::query_as("SELECT * FROM categories ORDER BY name")
        .fetch_all(&state.db)
        .await?;
    Ok(Json(items))
}

async fn get_one(State(state): State<AppState>, Path(id): Path<Uuid>) -> AppResult<Json<Category>> {
    let item: Category = sqlx::query_as("SELECT * FROM categories WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Categoria no encontrada".into()))?;
    Ok(Json(item))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CategoryInput>,
) -> AppResult<Json<Category>> {
    auth.require_admin()?;
    let slug = input.slug.unwrap_or_else(|| slugify(&input.name));
    let item: Category =
        sqlx::query_as("INSERT INTO categories (name, slug, icon) VALUES ($1, $2, $3) RETURNING *")
            .bind(input.name.trim())
            .bind(slug)
            .bind(input.icon)
            .fetch_one(&state.db)
            .await?;
    Ok(Json(item))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<CategoryInput>,
) -> AppResult<Json<Category>> {
    auth.require_admin()?;
    let slug = input.slug.unwrap_or_else(|| slugify(&input.name));
    let item: Category = sqlx::query_as(
        "UPDATE categories SET name = $2, slug = $3, icon = COALESCE($4::text, icon) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(input.name.trim())
    .bind(slug)
    .bind(input.icon)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Categoria no encontrada".into()))?;
    Ok(Json(item))
}

async fn remove(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    auth.require_admin()?;
    let res = sqlx::query("DELETE FROM categories WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("Categoria no encontrada".into()));
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}
