mod auth;
mod error;
mod models;
mod routes;
mod seed;
mod state;

use std::time::Duration;

use axum::http::{HeaderValue, Method};
use sqlx::postgres::PgPoolOptions;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::state::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Se resuelve contra la raiz del crate para que funcione desde cualquier cwd.
    dotenvy::from_path_override(concat!(env!("CARGO_MANIFEST_DIR"), "/.env")).ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "placard_api=debug,tower_http=info".into()),
        )
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:ededed@localhost:5432/placard_db".into());
    let jwt_secret =
        std::env::var("JWT_SECRET").unwrap_or_else(|_| "placard-dev-secret-change-me".into());
    let jwt_hours: i64 = std::env::var("JWT_HOURS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(72);
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(80);

    let db = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(10))
        .connect(&database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&db).await?;
    seed::run(&db).await?;

    let allowed_origins = std::env::var("CORS_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:4200,http://127.0.0.1:4200".into());
    let origins: Vec<HeaderValue> = allowed_origins
        .split(',')
        .filter_map(|o| o.trim().parse().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(tower_http::cors::Any);

    let state = AppState {
        db,
        jwt_secret,
        jwt_hours,
    };

    let app = axum::Router::new()
        .nest("/api", routes::api_router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    tracing::info!("PLACARD API iniciada correctamente y ejecutandose");
    tracing::info!("Puerto: {port}");
    tracing::info!("PLACARD API escuchando en http://localhost:{port}/api");
    axum::serve(listener, app).await?;
    Ok(())
}
