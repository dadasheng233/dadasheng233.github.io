CREATE TABLE IF NOT EXISTS users (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(64)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  display_name  VARCHAR(64)  NOT NULL,
  role          VARCHAR(16)  NOT NULL DEFAULT 'USER',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS progress (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT      NOT NULL,
  kind       VARCHAR(32) NOT NULL,
  payload    CLOB        NOT NULL,
  updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT uq_progress UNIQUE (user_id, kind)
);

CREATE TABLE IF NOT EXISTS question_sets (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200)  NOT NULL,
  subject     VARCHAR(8)    NOT NULL,
  exam_year   INT,
  source      VARCHAR(200),
  description VARCHAR(2000),
  published   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  set_id     BIGINT      NOT NULL,
  seq        INT         NOT NULL,
  type       VARCHAR(16) NOT NULL DEFAULT 'single',
  stem       CLOB        NOT NULL,
  options    CLOB        NOT NULL,
  answer     VARCHAR(32) NOT NULL,
  analysis   CLOB,
  difficulty INT,
  knowledge  VARCHAR(200),
  CONSTRAINT fk_question_set FOREIGN KEY (set_id) REFERENCES question_sets (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS practice_records (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT      NOT NULL,
  question_id BIGINT      NOT NULL,
  chosen      VARCHAR(32),
  correct     BOOLEAN     NOT NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_record_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_record_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questions_set ON questions (set_id);
CREATE INDEX IF NOT EXISTS idx_records_user ON practice_records (user_id);
CREATE INDEX IF NOT EXISTS idx_records_question ON practice_records (question_id);
