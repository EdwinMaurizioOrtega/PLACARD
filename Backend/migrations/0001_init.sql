-- PLACARD S.A. - Esquema inicial de la plataforma de moda circular
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- USUARIOS
-- =====================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    bio             TEXT,
    avatar_url      TEXT,
    phone           TEXT,
    city            TEXT NOT NULL DEFAULT 'Cuenca',
    neighborhood    TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    preferred_sizes TEXT[] NOT NULL DEFAULT '{}',
    preferred_styles TEXT[] NOT NULL DEFAULT '{}',
    max_distance_km INTEGER NOT NULL DEFAULT 25,
    role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    rating_avg      REAL NOT NULL DEFAULT 0,
    rating_count    INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_city ON users (city);

-- =====================================================================
-- CATEGORIAS
-- =====================================================================
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    icon        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- PRENDAS
-- =====================================================================
CREATE TABLE garments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category_id   UUID REFERENCES categories (id) ON DELETE SET NULL,
    title         TEXT NOT NULL,
    description   TEXT,
    brand         TEXT,
    color         TEXT,
    style         TEXT,
    size          TEXT NOT NULL,
    condition     TEXT NOT NULL DEFAULT 'buen_estado'
                  CHECK (condition IN ('nuevo', 'como_nuevo', 'buen_estado', 'usado')),
    mode          TEXT NOT NULL DEFAULT 'ambos'
                  CHECK (mode IN ('venta', 'intercambio', 'ambos')),
    status        TEXT NOT NULL DEFAULT 'disponible'
                  CHECK (status IN ('disponible', 'reservado', 'cerrado')),
    price         NUMERIC(10, 2),
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION,
    views         INTEGER NOT NULL DEFAULT 0,
    likes_count   INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_garments_owner ON garments (owner_id);
CREATE INDEX idx_garments_status ON garments (status);
CREATE INDEX idx_garments_category ON garments (category_id);

-- =====================================================================
-- IMAGENES DE PRENDAS
-- =====================================================================
CREATE TABLE garment_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garment_id  UUID NOT NULL REFERENCES garments (id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_garment_images_garment ON garment_images (garment_id);

-- =====================================================================
-- SWIPES (mecanica tipo Tinder)
-- =====================================================================
CREATE TABLE swipes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    garment_id  UUID NOT NULL REFERENCES garments (id) ON DELETE CASCADE,
    direction   TEXT NOT NULL CHECK (direction IN ('like', 'pass', 'super')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, garment_id)
);

CREATE INDEX idx_swipes_user ON swipes (user_id);

-- =====================================================================
-- MATCHES
-- =====================================================================
CREATE TABLE matches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_b      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    garment_a   UUID REFERENCES garments (id) ON DELETE SET NULL,
    garment_b   UUID REFERENCES garments (id) ON DELETE SET NULL,
    status      TEXT NOT NULL DEFAULT 'activo'
                CHECK (status IN ('activo', 'cerrado', 'cancelado')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (user_a <> user_b),
    UNIQUE (user_a, user_b)
);

-- =====================================================================
-- MENSAJES
-- =====================================================================
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_match ON messages (match_id, created_at);

-- =====================================================================
-- REPUTACION
-- =====================================================================
CREATE TABLE reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID REFERENCES matches (id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (reviewer_id <> reviewee_id),
    UNIQUE (match_id, reviewer_id)
);

-- Recalcula la reputacion del usuario evaluado
CREATE OR REPLACE FUNCTION refresh_user_rating() RETURNS TRIGGER AS $$
DECLARE
    target UUID;
BEGIN
    target := COALESCE(NEW.reviewee_id, OLD.reviewee_id);
    UPDATE users u
    SET rating_avg = COALESCE(s.avg_rating, 0),
        rating_count = COALESCE(s.total, 0)
    FROM (
        SELECT AVG(rating)::REAL AS avg_rating, COUNT(*) AS total
        FROM reviews WHERE reviewee_id = target
    ) s
    WHERE u.id = target;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION refresh_user_rating();

-- Mantiene el contador de likes de cada prenda
CREATE OR REPLACE FUNCTION refresh_garment_likes() RETURNS TRIGGER AS $$
DECLARE
    target UUID;
BEGIN
    target := COALESCE(NEW.garment_id, OLD.garment_id);
    UPDATE garments g
    SET likes_count = (
        SELECT COUNT(*) FROM swipes
        WHERE garment_id = target AND direction IN ('like', 'super')
    )
    WHERE g.id = target;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_swipes_likes
AFTER INSERT OR UPDATE OR DELETE ON swipes
FOR EACH ROW EXECUTE FUNCTION refresh_garment_likes();
