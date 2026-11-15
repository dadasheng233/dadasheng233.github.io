CREATE TABLE IF NOT EXISTS users (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(64)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  display_name  VARCHAR(64)  NOT NULL,
  role          VARCHAR(16)  NOT NULL DEFAULT 'USER',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS progress (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT      NOT NULL,
  kind       VARCHAR(32) NOT NULL,
  payload    LONGTEXT    NOT NULL,
  updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_progress (user_id, kind),
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS question_sets (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  subject     VARCHAR(8)   NOT NULL,
  exam_year   INT,
  source      VARCHAR(200),
  description VARCHAR(2000),
  published   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS questions (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  set_id     BIGINT      NOT NULL,
  seq        INT         NOT NULL,
  type       VARCHAR(16) NOT NULL DEFAULT 'single',
  stem       LONGTEXT    NOT NULL,
  options    LONGTEXT    NOT NULL,
  answer     VARCHAR(32) NOT NULL,
  analysis   LONGTEXT,
  difficulty INT,
  knowledge  VARCHAR(200),
  KEY idx_questions_set (set_id),
  CONSTRAINT fk_question_set FOREIGN KEY (set_id) REFERENCES question_sets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS practice_records (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT      NOT NULL,
  question_id BIGINT      NOT NULL,
  chosen      VARCHAR(32),
  correct     TINYINT(1)  NOT NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_records_user (user_id),
  KEY idx_records_question (question_id),
  CONSTRAINT fk_record_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_record_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
