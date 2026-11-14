-- Fitness Extreme / Lead Management Database Schema
USE gym_bangluru;

CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketing_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  gtm_container_id VARCHAR(32) NOT NULL DEFAULT '',
  ga_measurement_id VARCHAR(32) NOT NULL DEFAULT '',
  search_console_token VARCHAR(255) NOT NULL DEFAULT '',
  clarity_project_id VARCHAR(64) NOT NULL DEFAULT '',
  default_lead_source VARCHAR(100) NOT NULL DEFAULT 'Bengaluru - Varthur',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO marketing_settings (id) VALUES (1);
