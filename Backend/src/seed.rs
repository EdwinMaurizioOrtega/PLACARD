use sqlx::PgPool;

use crate::auth::hash_password;

const CATEGORIES: &[(&str, &str, &str)] = &[
    ("Camisetas", "camisetas", "👕"),
    ("Camisas", "camisas", "🧥"),
    ("Pantalones", "pantalones", "👖"),
    ("Vestidos", "vestidos", "👗"),
    ("Chaquetas", "chaquetas", "🧥"),
    ("Zapatos", "zapatos", "👟"),
    ("Accesorios", "accesorios", "👜"),
    ("Deportivo", "deportivo", "🏃"),
];

const USERS: &[(&str, &str, &str, &str, f64, f64, &str)] = &[
    ("admin@placard.ec", "admin", "Administrador PLACARD", "El Centro", -2.9001, -79.0059, "admin"),
    ("mariajose@placard.ec", "majo", "Maria Jose Astudillo", "El Vergel", -2.9075, -79.0021, "user"),
    ("andrea@placard.ec", "andreas", "Andrea Salinas", "Yanuncay", -2.9128, -79.0245, "user"),
    ("camila@placard.ec", "camilat", "Camila Torres", "Totoracocha", -2.8938, -78.9820, "user"),
    ("daniela@placard.ec", "danip", "Daniela Paredes", "El Ejido", -2.9036, -79.0107, "user"),
    ("nicolas@placard.ec", "nicoc", "Nicolas Cordero", "Challuabamba", -2.8617, -78.9339, "user"),
    ("valeria@placard.ec", "valem", "Valeria Mendez", "Monay", -2.8993, -78.9721, "user"),
];

// (usuario, categoria, titulo, talla, estado, modo, precio, estilo, marca)
const GARMENTS: &[(&str, &str, &str, &str, &str, &str, Option<f64>, &str, &str)] = &[
    ("majo", "vestidos", "Vestido midi floral", "M", "como_nuevo", "ambos", Some(18.0), "casual", "Zara"),
    ("majo", "chaquetas", "Chaqueta de jean oversize", "L", "buen_estado", "intercambio", None, "streetwear", "Levis"),
    ("majo", "zapatos", "Botines de cuero cafe", "38", "buen_estado", "venta", Some(25.0), "formal", "Bata"),
    ("andreas", "camisetas", "Camiseta oversize blanca", "M", "nuevo", "ambos", Some(9.0), "streetwear", "H&M"),
    ("andreas", "pantalones", "Jean mom fit tiro alto", "S", "como_nuevo", "ambos", Some(15.0), "casual", "Bershka"),
    ("andreas", "accesorios", "Bolso tejido artesanal", "U", "buen_estado", "intercambio", None, "boho", "Local"),
    ("camilat", "camisas", "Camisa de lino beige", "L", "buen_estado", "venta", Some(12.0), "formal", "Pull&Bear"),
    ("camilat", "deportivo", "Licra deportiva negra", "S", "como_nuevo", "ambos", Some(11.0), "deportivo", "Nike"),
    ("danip", "vestidos", "Vestido negro de gala", "M", "como_nuevo", "venta", Some(30.0), "formal", "Mango"),
    ("danip", "chaquetas", "Abrigo largo gris", "M", "buen_estado", "ambos", Some(28.0), "formal", "Stradivarius"),
    ("danip", "zapatos", "Zapatillas urbanas blancas", "40", "buen_estado", "intercambio", None, "streetwear", "Adidas"),
    ("nicoc", "camisetas", "Polo clasico azul", "L", "buen_estado", "ambos", Some(10.0), "casual", "Lacoste"),
    ("nicoc", "pantalones", "Chino beige slim", "32", "como_nuevo", "venta", Some(16.0), "formal", "Dockers"),
    ("valem", "accesorios", "Gorra vintage", "U", "usado", "intercambio", None, "streetwear", "New Era"),
    ("valem", "camisas", "Blusa satinada verde", "S", "nuevo", "ambos", Some(14.0), "formal", "Shein"),
    ("valem", "deportivo", "Cortavientos running", "M", "buen_estado", "ambos", Some(20.0), "deportivo", "Puma"),
];

/// Carga catalogos y datos de demostracion la primera vez que arranca la API.
pub async fn run(db: &PgPool) -> Result<(), sqlx::Error> {
    for (name, slug, icon) in CATEGORIES {
        sqlx::query(
            "INSERT INTO categories (name, slug, icon) VALUES ($1, $2, $3) \
             ON CONFLICT (slug) DO NOTHING",
        )
        .bind(name)
        .bind(slug)
        .bind(icon)
        .execute(db)
        .await?;
    }

    let (users_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(db)
        .await?;
    if users_count > 0 {
        return Ok(());
    }

    let password_hash = hash_password("placard123").map_err(|_| sqlx::Error::WorkerCrashed)?;

    for (email, username, full_name, neighborhood, lat, lng, role) in USERS {
        sqlx::query(
            "INSERT INTO users (email, username, password_hash, full_name, neighborhood, \
                latitude, longitude, role, bio, avatar_url, preferred_sizes, preferred_styles) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
        )
        .bind(email)
        .bind(username)
        .bind(&password_hash)
        .bind(full_name)
        .bind(neighborhood)
        .bind(lat)
        .bind(lng)
        .bind(role)
        .bind(format!("Moda circular en Cuenca. Intercambio en {neighborhood}."))
        .bind(format!("https://picsum.photos/seed/placard-{username}/200/200"))
        .bind(vec!["S".to_string(), "M".to_string()])
        .bind(vec!["casual".to_string(), "streetwear".to_string()])
        .execute(db)
        .await?;
    }

    for (index, (owner, category, title, size, condition, mode, price, style, brand)) in
        GARMENTS.iter().enumerate()
    {
        let (id,): (uuid::Uuid,) = sqlx::query_as(
            "INSERT INTO garments (owner_id, category_id, title, description, brand, color, \
                style, size, condition, mode, price, latitude, longitude) \
             VALUES ((SELECT id FROM users WHERE username = $1), \
                     (SELECT id FROM categories WHERE slug = $2), \
                     $3, $4, $5, $6, $7, $8, $9, $10, $11, \
                     (SELECT latitude FROM users WHERE username = $1), \
                     (SELECT longitude FROM users WHERE username = $1)) RETURNING id",
        )
        .bind(owner)
        .bind(category)
        .bind(title)
        .bind(format!(
            "{title} en {condition}. Prenda cuidada, lista para seguir circulando en Cuenca."
        ))
        .bind(brand)
        .bind("multicolor")
        .bind(style)
        .bind(size)
        .bind(condition)
        .bind(mode)
        .bind(price.map(rust_decimal::Decimal::from_f64_retain).flatten())
        .fetch_one(db)
        .await?;

        for position in 0..2 {
            sqlx::query(
                "INSERT INTO garment_images (garment_id, url, position) VALUES ($1, $2, $3)",
            )
            .bind(id)
            .bind(format!(
                "https://picsum.photos/seed/placard-g{}-{}/600/800",
                index, position
            ))
            .bind(position)
            .execute(db)
            .await?;
        }
    }

    tracing::info!("Datos de demostracion cargados (password de todos los usuarios: placard123)");
    Ok(())
}

/// Genera actividad simulada repartida en 12 meses para que la reporteria del
/// panel administrativo tenga volumen. Solo corre mientras la base este vacia.
pub async fn demo(db: &PgPool) -> Result<(), sqlx::Error> {
    let (swipes,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM swipes")
        .fetch_one(db)
        .await?;
    if swipes >= 200 {
        return Ok(());
    }

    sqlx::raw_sql(include_str!("demo.sql")).execute(db).await?;
    tracing::info!("Actividad simulada generada para la reporteria del panel administrativo");
    Ok(())
}
