pub mod auth_routes;
pub mod categories;
pub mod garments;
pub mod matches;
pub mod reviews;
pub mod stats;
pub mod swipes;
pub mod users;

use axum::{routing::get, Json, Router};

use crate::state::AppState;

pub fn api_router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .nest("/auth", auth_routes::router())
        .nest("/users", users::router())
        .nest("/categories", categories::router())
        .nest("/garments", garments::router())
        .nest("/swipes", swipes::router())
        .nest("/matches", matches::router())
        .nest("/messages", matches::messages_router())
        .nest("/reviews", reviews::router())
        .nest("/stats", stats::router())
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "service": "placard-api" }))
}
