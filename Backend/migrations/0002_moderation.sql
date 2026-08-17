-- Moderacion, reportes y bloqueo entre usuarios
ALTER TABLE garments ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE reports (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    target_user_id    UUID REFERENCES users (id) ON DELETE CASCADE,
    target_garment_id UUID REFERENCES garments (id) ON DELETE CASCADE,
    reason            TEXT NOT NULL CHECK (reason IN (
                          'spam', 'fraude', 'contenido_inapropiado',
                          'prenda_no_corresponde', 'acoso', 'otro')),
    details           TEXT,
    status            TEXT NOT NULL DEFAULT 'pendiente'
                      CHECK (status IN ('pendiente', 'revisado', 'descartado')),
    resolution        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at       TIMESTAMPTZ,
    CHECK (target_user_id IS NOT NULL OR target_garment_id IS NOT NULL)
);

CREATE INDEX idx_reports_status ON reports (status, created_at DESC);

CREATE TABLE user_blocks (
    blocker_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);
