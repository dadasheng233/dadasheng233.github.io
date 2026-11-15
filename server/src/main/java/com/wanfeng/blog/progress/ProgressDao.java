package com.wanfeng.blog.progress;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class ProgressDao {

  public record ProgressRow(String kind, String payload, Instant updatedAt) {
  }

  private static final RowMapper<ProgressRow> MAPPER = (rs, rowNum) -> new ProgressRow(
      rs.getString("kind"),
      rs.getString("payload"),
      toInstant(rs.getTimestamp("updated_at")));

  private static Instant toInstant(Timestamp timestamp) {
    return timestamp == null ? Instant.EPOCH : timestamp.toInstant();
  }

  private final JdbcTemplate jdbc;

  public ProgressDao(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<ProgressRow> findAll(long userId) {
    return jdbc.query(
        "SELECT kind, payload, updated_at FROM progress WHERE user_id = ? ORDER BY kind",
        MAPPER, userId);
  }

  public Optional<ProgressRow> find(long userId, String kind) {
    List<ProgressRow> rows = jdbc.query(
        "SELECT kind, payload, updated_at FROM progress WHERE user_id = ? AND kind = ?",
        MAPPER, userId, kind);
    return rows.stream().findFirst();
  }

  public void upsert(long userId, String kind, String payload) {
    int updated = jdbc.update(
        "UPDATE progress SET payload = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND kind = ?",
        payload, userId, kind);
    if (updated == 0) {
      jdbc.update(
          "INSERT INTO progress (user_id, kind, payload, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
          userId, kind, payload);
    }
  }

  public void delete(long userId, String kind) {
    jdbc.update("DELETE FROM progress WHERE user_id = ? AND kind = ?", userId, kind);
  }
}
