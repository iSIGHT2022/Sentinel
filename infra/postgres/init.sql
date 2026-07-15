-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Zones reference table
CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    camera_ids TEXT[] NOT NULL DEFAULT '{}',
    has_internal_camera BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO zones (name, camera_ids, has_internal_camera) VALUES
    ('corridors_hallways',     ARRAY['cam_c1','cam_c2'], TRUE),
    ('dining_hall',            ARRAY['cam_d1'],           TRUE),
    ('common_room_lounge',     ARRAY['cam_l1'],           TRUE),
    ('garden_outdoor',         ARRAY['cam_g1','cam_g2'],  TRUE),
    ('activity_therapy_room',  ARRAY['cam_a1'],           TRUE),
    ('nurse_station',          ARRAY['cam_n1'],           TRUE),
    ('bathroom_entry',         ARRAY['cam_b1'],           FALSE),
    ('stairwells_elevators',   ARRAY['cam_s1'],           TRUE)
ON CONFLICT DO NOTHING;

-- Residents table
CREATE TABLE IF NOT EXISTS residents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    age INTEGER,
    room_number VARCHAR(20),
    photo_embedding FLOAT8[],
    reid_track_ids INTEGER[] DEFAULT '{}',
    emergency_contacts JSONB DEFAULT '[]',
    medical_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events (hypertable — time-series)
CREATE TABLE IF NOT EXISTS events (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
    zone VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    confidence FLOAT4,
    metadata JSONB DEFAULT '{}',
    clip_url TEXT,
    PRIMARY KEY (id, time)
);
SELECT create_hypertable('events', 'time', if_not_exists => TRUE);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID,
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    alert_type VARCHAR(100) NOT NULL,
    zone VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by VARCHAR(200),
    acknowledged_at TIMESTAMPTZ,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'
);

-- Daily digests
CREATE TABLE IF NOT EXISTS daily_digests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    summary TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resident_summaries JSONB DEFAULT '{}'
);

-- Staff/users (managed primarily by Supabase Auth; this mirrors role data)
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin','nurse','caregiver','family')),
    resident_ids UUID[] DEFAULT '{}',
    fcm_token TEXT,
    phone VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_zone       ON events (zone, time DESC);
CREATE INDEX IF NOT EXISTS idx_events_resident   ON events (resident_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_events_type       ON events (event_type, time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity   ON alerts (severity, time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON alerts (resolved, time DESC) WHERE resolved = FALSE;
