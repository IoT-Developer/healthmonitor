SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS sensor_readings;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL,
  role ENUM('admin','clinician') NOT NULL DEFAULT 'clinician',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE patients (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mrn VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  dob DATE NULL,
  sex ENUM('M','F','O') NULL,
  persona ENUM('healthy','at_risk','critical') NOT NULL DEFAULT 'healthy',
  baseline JSON NOT NULL,
  thresholds JSON NOT NULL,
  status ENUM('stable','warning','critical') NOT NULL DEFAULT 'stable',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patients_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sensor_readings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  ts DATETIME(3) NOT NULL,
  hr SMALLINT NULL,
  spo2 TINYINT UNSIGNED NULL,
  temp_c DECIMAL(4,2) NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'simulator',
  anomaly_score FLOAT NULL,
  CONSTRAINT fk_readings_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE CASCADE,
  INDEX idx_patient_ts (patient_id, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE alerts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  type ENUM('hr_high','hr_low','spo2_low','fever','anomaly') NOT NULL,
  severity ENUM('info','warning','critical') NOT NULL,
  triggered_at DATETIME(3) NOT NULL,
  value DECIMAL(6,2) NULL,
  threshold_val DECIMAL(6,2) NULL,
  status ENUM('open','ack','resolved') NOT NULL DEFAULT 'open',
  ack_by BIGINT NULL,
  ack_at DATETIME(3) NULL,
  note VARCHAR(500) NULL,
  CONSTRAINT fk_alerts_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_alerts_user
    FOREIGN KEY (ack_by) REFERENCES users(id)
    ON DELETE SET NULL,
  INDEX idx_alerts_patient_status (patient_id, status),
  INDEX idx_alerts_status_time (status, triggered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;