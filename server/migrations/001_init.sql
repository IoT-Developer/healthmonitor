-- =========================================================
-- HealthMonitor — initial schema
-- MySQL 8.0+
-- Run: mysql -u root -p healthmonitor < 001_init.sql
-- =========================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Drop in reverse-dependency order so re-running is safe.
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS sensor_readings;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------
-- users  — clinicians + admins
-- ---------------------------------------------------------
CREATE TABLE users (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  role          ENUM('admin','clinician') NOT NULL DEFAULT 'clinician',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- patients
-- ---------------------------------------------------------
CREATE TABLE patients (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  mrn         VARCHAR(40) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  dob         DATE NULL,
  sex         ENUM('M','F','O') NULL,
  -- Simulator hint: drives variance + spike probability.
  persona     ENUM('healthy','at_risk','critical') NOT NULL DEFAULT 'healthy',
  -- JSON columns keep the schema flexible without ALTERs every iteration.
  baseline    JSON NOT NULL,    -- { "hr": 75, "spo2": 98, "tempC": 36.8 }
  thresholds  JSON NOT NULL,    -- { "hrMin":40, "hrMax":120, "spo2Min":92, "tempMax":38.5 }
  status      ENUM('stable','warning','critical') NOT NULL DEFAULT 'stable',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_patients_status ON patients(status);

-- ---------------------------------------------------------
-- sensor_readings  — time-series; partition by day later
-- ---------------------------------------------------------
CREATE TABLE sensor_readings (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  patient_id    BIGINT NOT NULL,
  ts            DATETIME(3) NOT NULL,
  hr            SMALLINT NULL,
  spo2          TINYINT UNSIGNED NULL,
  temp_c        DECIMAL(4,2) NULL,
  source        VARCHAR(20) NOT NULL DEFAULT 'simulator',
  anomaly_score FLOAT NULL,
  CONSTRAINT fk_readings_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_patient_ts (patient_id, ts DESC)
) ENGINE=InnoDB;

-- NOTE: For production-scale time-series, switch this table to:
--   PARTITION BY RANGE (TO_DAYS(ts)) ( ... )
-- and rotate partitions on a schedule.  Out of scope for MVP.

-- ---------------------------------------------------------
-- alerts
-- ---------------------------------------------------------
CREATE TABLE alerts (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  patient_id    BIGINT NOT NULL,
  type          ENUM('hr_high','hr_low','spo2_low','fever','anomaly') NOT NULL,
  severity      ENUM('info','warning','critical') NOT NULL,
  triggered_at  DATETIME(3) NOT NULL,
  value         DECIMAL(6,2) NULL,
  threshold_val DECIMAL(6,2) NULL,
  status        ENUM('open','ack','resolved') NOT NULL DEFAULT 'open',
  ack_by        BIGINT NULL,
  ack_at        DATETIME(3) NULL,
  note          VARCHAR(500) NULL,
  CONSTRAINT fk_alerts_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_alerts_user FOREIGN KEY (ack_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_alerts_patient_status (patient_id, status),
  INDEX idx_alerts_status_time (status, triggered_at DESC)
) ENGINE=InnoDB;
