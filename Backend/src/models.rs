use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================ USUARIOS ============================

#[derive(Debug, Serialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub full_name: String,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub phone: Option<String>,
    pub city: String,
    pub neighborhood: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub preferred_sizes: Vec<String>,
    pub preferred_styles: Vec<String>,
    pub max_distance_km: i32,
    pub role: String,
    pub rating_avg: f32,
    pub rating_count: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub const USER_COLUMNS: &str = "id, email, username, full_name, bio, avatar_url, phone, city, \
     neighborhood, latitude, longitude, preferred_sizes, preferred_styles, max_distance_km, role, \
     rating_avg, rating_count, is_active, created_at, updated_at";

/// Vista de terceros: coordenadas redondeadas a ~1 km y sin datos de contacto.
pub const USER_PUBLIC_COLUMNS: &str = "id, ''::text AS email, username, full_name, bio, avatar_url, \
     NULL::text AS phone, city, neighborhood, \
     round(latitude::numeric, 2)::float8 AS latitude, \
     round(longitude::numeric, 2)::float8 AS longitude, \
     preferred_sizes, preferred_styles, max_distance_km, role, rating_avg, rating_count, \
     is_active, created_at, updated_at";

#[derive(Debug, Deserialize)]
pub struct RegisterInput {
    pub email: String,
    pub username: String,
    pub password: String,
    pub full_name: String,
    pub city: Option<String>,
    pub phone: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub preferred_sizes: Option<Vec<String>>,
    pub preferred_styles: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserInput {
    pub full_name: Option<String>,
    pub username: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub phone: Option<String>,
    pub city: Option<String>,
    pub neighborhood: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub preferred_sizes: Option<Vec<String>>,
    pub preferred_styles: Option<Vec<String>>,
    pub max_distance_km: Option<i32>,
    pub password: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}

// ============================ CATEGORIAS ============================

#[derive(Debug, Serialize, FromRow)]
pub struct Category {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub icon: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CategoryInput {
    pub name: String,
    pub slug: Option<String>,
    pub icon: Option<String>,
}

// ============================ PRENDAS ============================

#[derive(Debug, Serialize, FromRow)]
pub struct GarmentImage {
    pub id: Uuid,
    pub garment_id: Uuid,
    pub url: String,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct GarmentRow {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub brand: Option<String>,
    pub color: Option<String>,
    pub style: Option<String>,
    pub size: String,
    pub condition: String,
    pub mode: String,
    pub status: String,
    pub price: Option<Decimal>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub views: i32,
    pub likes_count: i32,
    pub super_likes_count: i32,
    pub is_hidden: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub owner_username: String,
    pub owner_full_name: String,
    pub owner_avatar_url: Option<String>,
    pub owner_rating: f32,
    pub category_name: Option<String>,
    pub distance_km: Option<f64>,
    /// Veces que el usuario ya paso por este anuncio en la baraja.
    pub times_seen: i32,
    /// El usuario que consulta tiene su super like puesto en este anuncio.
    pub i_super_liked: bool,
}

#[derive(Debug, Serialize)]
pub struct Garment {
    #[serde(flatten)]
    pub garment: GarmentRow,
    pub images: Vec<GarmentImage>,
}

/// Columnas comunes para todas las consultas de prendas (alias g / u / c).
/// Las coordenadas se redondean a dos decimales (~1 km) para no exponer el domicilio.
pub const GARMENT_COLUMNS: &str = "g.id, g.owner_id, g.category_id, g.title, g.description, \
     g.brand, g.color, g.style, g.size, g.condition, g.mode, g.status, g.price, \
     round(g.latitude::numeric, 2)::float8 AS latitude, \
     round(g.longitude::numeric, 2)::float8 AS longitude, \
     g.views, g.likes_count, g.super_likes_count, g.is_hidden, g.created_at, g.updated_at, \
     u.username AS owner_username, u.full_name AS owner_full_name, \
     u.avatar_url AS owner_avatar_url, u.rating_avg AS owner_rating, c.name AS category_name";

#[derive(Debug, Deserialize)]
pub struct GarmentInput {
    pub title: String,
    pub description: Option<String>,
    pub category_id: Option<Uuid>,
    pub brand: Option<String>,
    pub color: Option<String>,
    pub style: Option<String>,
    pub size: String,
    pub condition: Option<String>,
    pub mode: Option<String>,
    pub status: Option<String>,
    pub price: Option<Decimal>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub images: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct GarmentUpdate {
    pub title: Option<String>,
    pub description: Option<String>,
    pub category_id: Option<Uuid>,
    pub brand: Option<String>,
    pub color: Option<String>,
    pub style: Option<String>,
    pub size: Option<String>,
    pub condition: Option<String>,
    pub mode: Option<String>,
    pub status: Option<String>,
    pub price: Option<Decimal>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub images: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct GarmentQuery {
    pub q: Option<String>,
    pub category_id: Option<Uuid>,
    pub owner_id: Option<Uuid>,
    pub size: Option<String>,
    pub condition: Option<String>,
    pub mode: Option<String>,
    pub status: Option<String>,
    pub min_price: Option<Decimal>,
    pub max_price: Option<Decimal>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct FeedQuery {
    pub mode: Option<String>,
    pub category_id: Option<Uuid>,
    pub limit: Option<i64>,
    /// Vuelve a repartir anuncios ya evaluados cuando se agota la baraja.
    pub repeat: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct ImageInput {
    pub url: String,
    pub position: Option<i32>,
}

// ============================ SWIPES / MATCHES ============================

#[derive(Debug, Serialize, FromRow)]
pub struct Swipe {
    pub id: Uuid,
    pub user_id: Uuid,
    pub garment_id: Uuid,
    pub direction: String,
    pub times_seen: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SwipeInput {
    pub garment_id: Uuid,
    pub direction: String,
    /// Solo obligatorio cuando la prenda admite venta e intercambio.
    pub intent: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct MatchRow {
    pub id: Uuid,
    pub interested_id: Uuid,
    pub owner_id: Uuid,
    pub garment_id: Uuid,
    pub intent: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub other_user_id: Uuid,
    pub other_username: String,
    pub other_full_name: String,
    pub other_avatar_url: Option<String>,
    pub other_rating: f32,
    pub garment_title: String,
    pub garment_mode: String,
    pub garment_price: Option<Decimal>,
    pub garment_image: Option<String>,
    pub last_message: Option<String>,
    pub last_message_at: Option<DateTime<Utc>>,
    pub unread_count: i64,
}

#[derive(Debug, Serialize)]
pub struct SwipeResult {
    pub swipe: Swipe,
    pub matched: bool,
    /// Ya existia una conversacion con este anuncio, no se creo otra.
    pub already: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub match_info: Option<MatchRow>,
}

#[derive(Debug, Deserialize)]
pub struct MatchStatusInput {
    pub status: String,
}

// ============================ MENSAJES ============================

#[derive(Debug, Serialize, FromRow)]
pub struct Message {
    pub id: Uuid,
    pub match_id: Uuid,
    pub sender_id: Uuid,
    pub body: String,
    pub read_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct MessageInput {
    pub body: String,
}

// ============================ REPUTACION ============================

#[derive(Debug, Serialize, FromRow)]
pub struct Review {
    pub id: Uuid,
    pub match_id: Option<Uuid>,
    pub reviewer_id: Uuid,
    pub reviewee_id: Uuid,
    pub rating: i32,
    pub comment: Option<String>,
    pub created_at: DateTime<Utc>,
    pub reviewer_username: String,
    pub reviewer_avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewInput {
    pub match_id: Option<Uuid>,
    pub reviewee_id: Uuid,
    pub rating: i32,
    pub comment: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewUpdate {
    pub rating: Option<i32>,
    pub comment: Option<String>,
}

// ============================ ESTADISTICAS ============================

#[derive(Debug, Serialize, FromRow)]
pub struct Overview {
    pub total_users: i64,
    pub total_garments: i64,
    pub available_garments: i64,
    pub total_swipes: i64,
    pub total_matches: i64,
    pub total_messages: i64,
    pub pending_reports: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct CategoryStat {
    pub category: String,
    pub total: i64,
}

// ============================ MODERACION ============================

#[derive(Debug, Serialize, FromRow)]
pub struct Report {
    pub id: Uuid,
    pub reporter_id: Uuid,
    pub target_user_id: Option<Uuid>,
    pub target_garment_id: Option<Uuid>,
    pub reason: String,
    pub details: Option<String>,
    pub status: String,
    pub resolution: Option<String>,
    pub created_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reporter_username: String,
    pub target_username: Option<String>,
    pub target_garment_title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReportInput {
    pub target_user_id: Option<Uuid>,
    pub target_garment_id: Option<Uuid>,
    pub reason: String,
    pub details: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReportResolution {
    pub status: String,
    pub resolution: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReportQuery {
    pub status: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct BlockedUser {
    pub blocked_id: Uuid,
    pub username: String,
    pub full_name: String,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct BlockInput {
    pub user_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct ActiveInput {
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct HiddenInput {
    pub is_hidden: bool,
}

pub const REPORT_REASONS: [&str; 6] = [
    "spam",
    "fraude",
    "contenido_inapropiado",
    "prenda_no_corresponde",
    "acoso",
    "otro",
];
