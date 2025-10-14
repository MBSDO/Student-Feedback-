-- Create syntax for TABLE 'comment_groups'
CREATE TABLE `comment_groups` (
  `gid` int NOT NULL AUTO_INCREMENT,
  `uid` int DEFAULT '0',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`gid`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create syntax for TABLE 'comment_groups_settings'
CREATE TABLE `comment_groups_settings` (
  `gid` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `value` longtext NOT NULL,
  PRIMARY KEY (`gid`,`name`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create syntax for TABLE 'comments'
CREATE TABLE `comments` (
  `cid` int NOT NULL AUTO_INCREMENT,
  `rid` int NOT NULL DEFAULT '0',
  `text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `status` int NOT NULL DEFAULT '0',
  `sentiment` int DEFAULT NULL,
  `civility` int DEFAULT NULL,
  `aims` varchar(255) DEFAULT NULL,
  `themes` varchar(255) DEFAULT NULL,
  `subject` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `essence` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`cid`)
) ENGINE=InnoDB AUTO_INCREMENT=2153 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create syntax for TABLE 'comments_settings'
CREATE TABLE `comments_settings` (
  `cid` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `value` longtext NOT NULL,
  PRIMARY KEY (`cid`,`name`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create syntax for TABLE 'reports'
CREATE TABLE `reports` (
  `rid` int unsigned NOT NULL AUTO_INCREMENT,
  `uid` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Untitled Report',
  `updated` datetime NOT NULL ON UPDATE CURRENT_TIMESTAMP,
  `sensitivity_negative_max` int NOT NULL DEFAULT '-3',
  `sensitivity_positive_min` int NOT NULL DEFAULT '3',
  PRIMARY KEY (`rid`)
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create syntax for TABLE 'reports_settings'
CREATE TABLE `reports_settings` (
  `rid` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `value` longtext NOT NULL,
  PRIMARY KEY (`rid`,`name`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create syntax for TABLE 'users'
CREATE TABLE `users` (
  `uid` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `hash` text,
  PRIMARY KEY (`uid`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create syntax for TABLE 'users_settings'
CREATE TABLE `users_settings` (
  `uid` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `value` longtext NOT NULL,
  PRIMARY KEY (`uid`,`name`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- New professors table
CREATE TABLE `professors` (
  `pid` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  PRIMARY KEY (`pid`),
  UNIQUE KEY `unique_name` (`first_name`, `last_name`)
);

-- Extend reports table
ALTER TABLE `reports`
  ADD COLUMN `pid` int DEFAULT NULL,
  ADD COLUMN `course_code` varchar(50) DEFAULT NULL,
  ADD COLUMN `semester` varchar(50) DEFAULT NULL,
  ADD COLUMN `csv_hash` varchar(64) DEFAULT NULL;
