use axum::{extract::State, routing::get, Json, Router};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
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

// ============================ REPORTE GERENCIAL ============================

#[derive(Debug, Serialize, FromRow)]
struct Funnel {
    views: i64,
    likes: i64,
    supers: i64,
    matches: i64,
    chats: i64,
    exchanges: i64,
}

#[derive(Debug, Serialize, FromRow)]
struct TimelinePoint {
    month: DateTime<Utc>,
    users: i64,
    garments: i64,
    swipes: i64,
    matches: i64,
    messages: i64,
}

#[derive(Debug, Serialize, FromRow)]
struct LabelCount {
    label: String,
    total: i64,
}

#[derive(Debug, Serialize, FromRow)]
struct CatalogTotals {
    inventory_value: Option<Decimal>,
    avg_price: Option<Decimal>,
    for_sale: i64,
    with_photo: i64,
}

#[derive(Debug, Serialize)]
struct CatalogBlock {
    by_category: Vec<LabelCount>,
    by_size: Vec<LabelCount>,
    by_mode: Vec<LabelCount>,
    by_condition: Vec<LabelCount>,
    totals: CatalogTotals,
}

#[derive(Debug, Serialize, FromRow)]
struct AreaRow {
    label: String,
    users: i64,
    garments: i64,
    matches: i64,
}

#[derive(Debug, Serialize, FromRow)]
struct GeoTotals {
    avg_distance_km: Option<f64>,
    with_coords: i64,
    without_coords: i64,
}

#[derive(Debug, Serialize)]
struct GeoBlock {
    by_area: Vec<AreaRow>,
    by_zone: Vec<LabelCount>,
    by_city: Vec<LabelCount>,
    totals: GeoTotals,
}

#[derive(Debug, Serialize, FromRow)]
struct TopUser {
    username: String,
    full_name: String,
    avatar_url: Option<String>,
    rating_avg: f32,
    rating_count: i32,
    garments: i64,
}

#[derive(Debug, Serialize, FromRow)]
struct CommunityTotals {
    active_users: i64,
    suspended_users: i64,
    avg_rating: Option<f64>,
    total_reviews: i64,
    silent_matches: i64,
}

#[derive(Debug, Serialize)]
struct CommunityBlock {
    totals: CommunityTotals,
    rating_distribution: Vec<LabelCount>,
    top_users: Vec<TopUser>,
    by_intent: Vec<LabelCount>,
    by_match_status: Vec<LabelCount>,
}

#[derive(Debug, Serialize)]
struct AdminReport {
    funnel: Funnel,
    timeline: Vec<TimelinePoint>,
    catalog: CatalogBlock,
    geo: GeoBlock,
    community: CommunityBlock,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/overview", get(overview))
        .route("/report", get(report))
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
                (SELECT COUNT(*) FROM messages) AS total_messages, \
                (SELECT COUNT(*) FROM reports WHERE status = 'pendiente') AS pending_reports",
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
                (SELECT COUNT(*) FROM matches WHERE interested_id = $1 OR owner_id = $1) AS my_matches, \
                (SELECT COUNT(*) FROM messages m JOIN matches mt ON mt.id = m.match_id \
                    WHERE (mt.interested_id = $1 OR mt.owner_id = $1) AND m.sender_id <> $1 \
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

/// Reporte gerencial completo: embudo, series mensuales, catalogo, geografia y comunidad.
async fn report(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<AdminReport>> {
    auth.require_admin()?;

    let funnel: Funnel = sqlx::query_as(
        "SELECT COALESCE((SELECT SUM(views) FROM garments), 0)::int8 AS views, \
                (SELECT COUNT(*) FROM swipes WHERE direction IN ('like', 'super')) AS likes, \
                (SELECT COUNT(*) FROM swipes WHERE direction = 'super') AS supers, \
                (SELECT COUNT(*) FROM matches) AS matches, \
                (SELECT COUNT(DISTINCT match_id) FROM messages) AS chats, \
                (SELECT COUNT(*) FROM matches WHERE status = 'cerrado') AS exchanges",
    )
    .fetch_one(&state.db)
    .await?;

    // generate_series evita que los meses sin actividad desaparezcan de la serie.
    let timeline: Vec<TimelinePoint> = sqlx::query_as(
        "WITH meses AS ( \
            SELECT generate_series( \
                date_trunc('month', now()) - interval '11 months', \
                date_trunc('month', now()), \
                interval '1 month') AS month \
         ) \
         SELECT m.month, \
            (SELECT COUNT(*) FROM users u \
                WHERE date_trunc('month', u.created_at) = m.month) AS users, \
            (SELECT COUNT(*) FROM garments g \
                WHERE date_trunc('month', g.created_at) = m.month) AS garments, \
            (SELECT COUNT(*) FROM swipes s \
                WHERE date_trunc('month', s.created_at) = m.month) AS swipes, \
            (SELECT COUNT(*) FROM matches mt \
                WHERE date_trunc('month', mt.created_at) = m.month) AS matches, \
            (SELECT COUNT(*) FROM messages ms \
                WHERE date_trunc('month', ms.created_at) = m.month) AS messages \
         FROM meses m ORDER BY m.month",
    )
    .fetch_all(&state.db)
    .await?;

    let by_category: Vec<LabelCount> = sqlx::query_as(
        "SELECT COALESCE(c.name, 'Sin categoria') AS label, COUNT(g.id) AS total \
         FROM garments g LEFT JOIN categories c ON c.id = g.category_id \
         GROUP BY 1 ORDER BY 2 DESC",
    )
    .fetch_all(&state.db)
    .await?;

    let by_size: Vec<LabelCount> =
        sqlx::query_as("SELECT size AS label, COUNT(*) AS total FROM garments GROUP BY 1 ORDER BY 2 DESC")
            .fetch_all(&state.db)
            .await?;

    let by_mode: Vec<LabelCount> =
        sqlx::query_as("SELECT mode AS label, COUNT(*) AS total FROM garments GROUP BY 1 ORDER BY 2 DESC")
            .fetch_all(&state.db)
            .await?;

    let by_condition: Vec<LabelCount> = sqlx::query_as(
        "SELECT condition AS label, COUNT(*) AS total FROM garments GROUP BY 1 ORDER BY 2 DESC",
    )
    .fetch_all(&state.db)
    .await?;

    let catalog_totals: CatalogTotals = sqlx::query_as(
        "SELECT COALESCE(SUM(price), 0) AS inventory_value, \
                ROUND(AVG(price), 2) AS avg_price, \
                COUNT(*) FILTER (WHERE price IS NOT NULL) AS for_sale, \
                COUNT(*) FILTER (WHERE EXISTS ( \
                    SELECT 1 FROM garment_images i WHERE i.garment_id = g.id)) AS with_photo \
         FROM garments g",
    )
    .fetch_one(&state.db)
    .await?;

    // El barrio (parroquia) es la unidad util: toda la operacion vive en una sola ciudad.
    let by_area: Vec<AreaRow> = sqlx::query_as(
        "SELECT COALESCE(NULLIF(u.neighborhood, ''), 'Sin barrio') AS label, \
                COUNT(DISTINCT u.id) AS users, \
                COUNT(DISTINCT g.id) AS garments, COUNT(DISTINCT m.id) AS matches \
         FROM users u \
         LEFT JOIN garments g ON g.owner_id = u.id \
         LEFT JOIN matches m ON m.interested_id = u.id \
         GROUP BY 1 ORDER BY 4 DESC, 2 DESC LIMIT 16",
    )
    .fetch_all(&state.db)
    .await?;

    let by_city: Vec<LabelCount> = sqlx::query_as(
        "SELECT city AS label, COUNT(*) AS total FROM users GROUP BY 1 ORDER BY 2 DESC LIMIT 10",
    )
    .fetch_all(&state.db)
    .await?;

    let by_zone: Vec<LabelCount> = sqlx::query_as(
        "SELECT CASE WHEN p.is_urban THEN 'Urbana' ELSE 'Rural' END AS label, \
                COUNT(m.id) AS total \
         FROM matches m \
         JOIN users u ON u.id = m.interested_id \
         JOIN parishes p ON p.name = u.neighborhood \
         GROUP BY 1 ORDER BY 2 DESC",
    )
    .fetch_all(&state.db)
    .await?;

    // Distancia real entre las dos partes de cada match, con la misma formula del feed.
    let geo_totals: GeoTotals = sqlx::query_as(
        "SELECT (SELECT ROUND(AVG(6371 * acos(LEAST(1, GREATEST(-1, \
                    cos(radians(a.latitude)) * cos(radians(b.latitude)) * \
                    cos(radians(b.longitude) - radians(a.longitude)) + \
                    sin(radians(a.latitude)) * sin(radians(b.latitude))))))::numeric, 2)::float8 \
                 FROM matches m \
                 JOIN users a ON a.id = m.interested_id \
                 JOIN users b ON b.id = m.owner_id \
                 WHERE a.latitude IS NOT NULL AND b.latitude IS NOT NULL) AS avg_distance_km, \
                (SELECT COUNT(*) FROM users WHERE latitude IS NOT NULL) AS with_coords, \
                (SELECT COUNT(*) FROM users WHERE latitude IS NULL) AS without_coords",
    )
    .fetch_one(&state.db)
    .await?;

    let community_totals: CommunityTotals = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM users WHERE is_active) AS active_users, \
                (SELECT COUNT(*) FROM users WHERE NOT is_active) AS suspended_users, \
                (SELECT ROUND(AVG(rating), 2)::float8 FROM reviews) AS avg_rating, \
                (SELECT COUNT(*) FROM reviews) AS total_reviews, \
                (SELECT COUNT(*) FROM matches m WHERE NOT EXISTS ( \
                    SELECT 1 FROM messages ms WHERE ms.match_id = m.id)) AS silent_matches",
    )
    .fetch_one(&state.db)
    .await?;

    let rating_distribution: Vec<LabelCount> = sqlx::query_as(
        "SELECT s.n::text AS label, COUNT(r.id) AS total \
         FROM generate_series(1, 5) AS s(n) \
         LEFT JOIN reviews r ON r.rating = s.n \
         GROUP BY 1 ORDER BY 1",
    )
    .fetch_all(&state.db)
    .await?;

    let top_users: Vec<TopUser> = sqlx::query_as(
        "SELECT u.username, u.full_name, u.avatar_url, u.rating_avg, u.rating_count, \
                COUNT(g.id) AS garments \
         FROM users u LEFT JOIN garments g ON g.owner_id = u.id \
         GROUP BY u.id \
         ORDER BY u.rating_avg DESC, u.rating_count DESC LIMIT 10",
    )
    .fetch_all(&state.db)
    .await?;

    let by_intent: Vec<LabelCount> = sqlx::query_as(
        "SELECT intent AS label, COUNT(*) AS total FROM matches GROUP BY 1 ORDER BY 2 DESC",
    )
    .fetch_all(&state.db)
    .await?;

    let by_match_status: Vec<LabelCount> = sqlx::query_as(
        "SELECT status AS label, COUNT(*) AS total FROM matches GROUP BY 1 ORDER BY 2 DESC",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(AdminReport {
        funnel,
        timeline,
        catalog: CatalogBlock {
            by_category,
            by_size,
            by_mode,
            by_condition,
            totals: catalog_totals,
        },
        geo: GeoBlock {
            by_area,
            by_zone,
            by_city,
            totals: geo_totals,
        },
        community: CommunityBlock {
            totals: community_totals,
            rating_distribution,
            top_users,
            by_intent,
            by_match_status,
        },
    }))
}
