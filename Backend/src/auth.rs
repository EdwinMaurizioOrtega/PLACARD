use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::FromRequestParts, http::request::Parts};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Clone, Copy)]
pub struct AuthUser {
    pub id: Uuid,
    pub is_admin: bool,
}

impl AuthUser {
    /// Solo el dueño del recurso o un administrador pueden modificarlo.
    pub fn require_owner(&self, owner_id: Uuid) -> Result<(), AppError> {
        if self.id == owner_id || self.is_admin {
            Ok(())
        } else {
            Err(AppError::Forbidden(
                "No tienes permisos sobre este recurso".into(),
            ))
        }
    }

    pub fn require_admin(&self) -> Result<(), AppError> {
        if self.is_admin {
            Ok(())
        } else {
            Err(AppError::Forbidden("Se requiere rol administrador".into()))
        }
    }
}

pub fn hash_password(plain: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(plain.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| AppError::Internal)
}

pub fn verify_password(plain: &str, hash: &str) -> Result<(), AppError> {
    let parsed = PasswordHash::new(hash).map_err(|_| AppError::Internal)?;
    Argon2::default()
        .verify_password(plain.as_bytes(), &parsed)
        .map_err(|_| AppError::Unauthorized("Credenciales invalidas".into()))
}

pub fn create_token(secret: &str, user_id: Uuid, role: &str, hours: i64) -> Result<String, AppError> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        role: role.to_string(),
        iat: now.timestamp(),
        exp: (now + Duration::hours(hours)).timestamp(),
    };
    Ok(encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?)
}

fn decode_bearer(parts: &Parts, secret: &str) -> Result<AuthUser, AppError> {
    let header = parts
        .headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Falta el encabezado Authorization".into()))?;

    let token = header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Formato de token invalido".into()))?;

    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;

    let id = Uuid::parse_str(&data.claims.sub)
        .map_err(|_| AppError::Unauthorized("Token invalido".into()))?;

    Ok(AuthUser {
        id,
        is_admin: data.claims.role == "admin",
    })
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        decode_bearer(parts, &state.jwt_secret)
    }
}
