package com.wanfeng.blog.auth;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class UserDao {

  private static final RowMapper<UserAccount> MAPPER = (rs, rowNum) -> new UserAccount(
      rs.getLong("id"),
      rs.getString("username"),
      rs.getString("password_hash"),
      rs.getString("display_name"),
      rs.getString("role"));

  private final JdbcTemplate jdbc;

  public UserDao(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<UserAccount> findByUsername(String username) {
    List<UserAccount> rows = jdbc.query(
        "SELECT id, username, password_hash, display_name, role FROM users WHERE username = ?",
        MAPPER, username);
    return rows.stream().findFirst();
  }

  public Optional<UserAccount> findById(long id) {
    List<UserAccount> rows = jdbc.query(
        "SELECT id, username, password_hash, display_name, role FROM users WHERE id = ?",
        MAPPER, id);
    return rows.stream().findFirst();
  }

  public long insert(String username, String passwordHash, String displayName, String role) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement ps = connection.prepareStatement(
          "INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
          Statement.RETURN_GENERATED_KEYS);
      ps.setString(1, username);
      ps.setString(2, passwordHash);
      ps.setString(3, displayName);
      ps.setString(4, role);
      return ps;
    }, keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new IllegalStateException("无法创建用户");
    }
    return key.longValue();
  }

  public void updateRole(long id, String role) {
    jdbc.update("UPDATE users SET role = ? WHERE id = ?", role, id);
  }

  public long count() {
    Long value = jdbc.queryForObject("SELECT COUNT(*) FROM users", Long.class);
    return value == null ? 0 : value;
  }
}
