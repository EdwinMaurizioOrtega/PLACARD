use axum::{extract::State, routing::{get, post}, Json, Router};

use crate::{
    auth::{create_token, hash_password, verify_password, AuthUser},
    error::{AppError, AppResult},
    models::{AuthResponse, LoginInput, RegisterInput, User, USER_COLUMNS},
    state::AppState,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/me", get(me))
}

async fn register(
    State(state): State<AppState>,
    Json(input): Json<RegisterInput>,
) -> AppResult<Json<AuthResponse>> {
    if input.password.len() < 8 {
        return Err(AppError::BadRequest(
            "La contrasena debe tener al menos 8 caracteres".into(),
        ));
    }
    if !input.email.contains('@') {
        return Err(AppError::BadRequest("Correo electronico invalido".into()));
    }
    if input.username.trim().len() < 3 {
        return Err(AppError::BadRequest(
            "El nombre de usuario debe tener al menos 3 caracteres".into(),
        ));
    }

    let password_hash = hash_password(&input.password)?;
    let sql = format!(
        "INSERT INTO users (email, username, password_hash, full_name, city, phone, bio, \
         avatar_url, latitude, longitude, preferred_sizes, preferred_styles) \
         VALUES ($1, $2, $3, $4, COALESCE($5::text, 'Cuenca'), $6, $7, $8, $9, $10, \
         COALESCE($11::text[], '{{}}'), COALESCE($12::text[], '{{}}')) RETURNING {USER_COLUMNS}"
    );

    let user: User = sqlx::query_as(&sql)
        .bind(input.email.trim().to_lowercase())
        .bind(input.username.trim().to_lowercase())
        .bind(password_hash)
        .bind(input.full_name.trim())
        .bind(input.city)
        .bind(input.phone)
        .bind(input.bio)
        .bind(input.avatar_url)
        .bind(input.latitude)
        .bind(input.longitude)
        .bind(input.preferred_sizes)
        .bind(input.preferred_styles)
        .fetch_one(&state.db)
        .await?;

    let token = create_token(&state.jwt_secret, user.id, &user.role, state.jwt_hours)?;
    Ok(Json(AuthResponse { token, user }))
}

async fn login(
    State(state): State<AppState>,
    Json(input): Json<LoginInput>,
) -> AppResult<Json<AuthResponse>> {
    let row: Option<(uuid::Uuid, String, bool)> =
        sqlx::query_as("SELECT id, password_hash, is_active FROM users WHERE email = $1")
            .bind(input.email.trim().to_lowercase())
            .fetch_optional(&state.db)
            .await?;

    let (id, hash, is_active) =
        row.ok_or_else(|| AppError::Unauthorized("Credenciales invalidas".into()))?;

    verify_password(&input.password, &hash)?;

    if !is_active {
        return Err(AppError::Forbidden("La cuenta esta desactivada".into()));
    }

    let user: User = sqlx::query_as(&format!(
        "SELECT {USER_COLUMNS} FROM users WHERE id = $1"
    ))
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    let token = create_token(&state.jwt_secret, user.id, &user.role, state.jwt_hours)?;
    Ok(Json(AuthResponse { token, user }))
}

async fn me(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<User>> {
    let user: User = sqlx::query_as(&format!(
        "SELECT {USER_COLUMNS} FROM users WHERE id = $1"
    ))
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(user))
}
