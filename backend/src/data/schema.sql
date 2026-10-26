-- ==============================================================================
-- IPPU CLICKS PHOTOGRAPHY - HIGH-PERFORMANCE MYSQL DATABASE SCHEMA
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `ippu_clicks`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `ippu_clicks`;

-- 1. Admins Table
CREATE TABLE IF NOT EXISTS `admins` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(32) NOT NULL DEFAULT 'ADMIN',
  `created_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Events Table
CREATE TABLE IF NOT EXISTS `events` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `date` VARCHAR(64) NOT NULL,
  `details` TEXT NULL,
  `pin` VARCHAR(32) NOT NULL,
  `public_slug` VARCHAR(191) NOT NULL UNIQUE,
  `client_event_url` TEXT NULL,
  `allow_downloads` TINYINT(1) NOT NULL DEFAULT 1,
  `enable_watermark` TINYINT(1) NOT NULL DEFAULT 1,
  `watermark_url` VARCHAR(500) NULL,
  `watermark_filename` VARCHAR(255) NULL,
  `watermark_position` VARCHAR(32) NOT NULL DEFAULT 'bottom-right',
  `watermark_scale` INT NOT NULL DEFAULT 22,
  `watermark_opacity` INT NOT NULL DEFAULT 90,
  `watermark_text` VARCHAR(255) NULL,
  `qr_code_data_url` MEDIUMTEXT NULL,
  `photo_count` INT NOT NULL DEFAULT 0,
  `created_at` VARCHAR(64) NOT NULL,
  `updated_at` VARCHAR(64) NULL,
  INDEX `idx_events_slug` (`public_slug`),
  INDEX `idx_events_pin` (`pin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Photos Table with Foreign Key & Indexes
CREATE TABLE IF NOT EXISTS `photos` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `event_id` VARCHAR(64) NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `size` BIGINT NOT NULL DEFAULT 0,
  `mime_type` VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
  `url` VARCHAR(500) NOT NULL,
  `thumbnail_url` VARCHAR(500) NOT NULL,
  `face_descriptors` LONGTEXT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  INDEX `idx_photos_event_id` (`event_id`),
  CONSTRAINT `fk_photos_event`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
