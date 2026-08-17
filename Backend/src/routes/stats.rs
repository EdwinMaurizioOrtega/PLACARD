use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use sqlx::FromRow;

use crate::{
    auth::AuthUser,
    error::AppResult,
    models::{CategoryStat, Overview},
    state::AppState,
};

#[derive(Debug, Serialize, FromRow)]
struct MyStats {
    my_garments: i64,
    my_likes_received: i64,
    my_matches: i64,
    unread_messages: i64,
}

#[derive(Debug, Serialize)]
struct StatsResponse {
    overview: Overview,
    by_category: Vec<CategoryStat>,
    mine: MyStats,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/overview", get(overview))
}

async fn overview(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<StatsResponse>> {
    let overview: Overview = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM users) AS total_users, \
                (SELECT COUNT(*) FROM garments) AS total_garments, \
                (SELECT COUNT(*) FROM garments WHERE status = 'disponible') AS available_garments, \
                (SELECT COUNT(*) FROM swipes) AS total_swipes, \
                (SELECT COUNT(*) FROM matches) AS total_matches, \
                (SELECT COUNT(*) FROM messages) AS total_messages",
    )
    .fetch_one(&state.db)
    .await?;

    let by_category: Vec<CategoryStat> = sqlx::query_as(
        "SELECT COALESCE(c.name, 'Sin categoria') AS category, COUNT(g.id) AS total \
         FROM garments g LEFT JOIN categories c ON c.id = g.category_id \
         GROUP BY 1 ORDER BY 2 DESC",
    )
    .fetch_all(&state.db)
    .await?;

    let mine: MyStats = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM garments WHERE owner_id = $1) AS my_garments, \
                (SELECT COUNT(*) FROM swipes s JOIN garments g ON g.id = s.garment_id \
                    WHERE g.owner_id = $1 AND s.direction IN ('like', 'super')) AS my_likes_received, \
                (SELECT COUNT(*) FROM matches WHERE user_a = $1 OR user_b = $1) AS my_matches, \
                (SELECT COUNT(*) FROM messages m JOIN matches mt ON mt.id = m.match_id \
                    WHERE (mt.user_a = $1 OR mt.user_b = $1) AND m.sender_id <> $1 \
                    AND m.read_at IS NULL) AS unread_messages",
    )
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(StatsResponse {
        overview,
        by_category,
        mine,
    }))
}
