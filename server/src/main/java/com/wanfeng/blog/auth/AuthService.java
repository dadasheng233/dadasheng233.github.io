package com.wanfeng.blog.auth;

import com.wanfeng.blog.common.ApiException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

  private final UserDao users;
  private final PasswordEncoder passwordEncoder;

  public AuthService(UserDao users, PasswordEncoder passwordEncoder) {
    this.users = users;
    this.passwordEncoder = passwordEncoder;
  }

  public UserAccount register(String rawUsername, String rawPassword, String rawDisplayName) {
    String username = normalizeUsername(rawUsername);
    if (users.findByUsername(username).isPresent()) {
      throw ApiException.conflict("这个用户名已经被注册了");
    }
    String displayName = normalizeDisplayName(rawDisplayName, username);
    String hash = passwordEncoder.encode(rawPassword);
    long id = users.insert(username, hash, displayName, "USER");
    return new UserAccount(id, username, hash, displayName, "USER");
  }

  public UserAccount login(String rawUsername, String rawPassword) {
    String username = rawUsername == null ? "" : rawUsername.trim();
    UserAccount account = users.findByUsername(username)
        .orElseThrow(() -> ApiException.unauthorized("用户名或密码不正确"));
    if (!passwordEncoder.matches(rawPassword, account.passwordHash())) {
      throw ApiException.unauthorized("用户名或密码不正确");
    }
    return account;
  }

  public String normalizeUsername(String username) {
    String value = username == null ? "" : username.trim();
    if (value.isEmpty()) {
      throw ApiException.badRequest("用户名不能为空");
    }
    if (value.length() < 3 || value.length() > 20) {
      throw ApiException.badRequest("用户名长度需要在 3 到 20 个字符之间");
    }
    if (!value.matches("^[A-Za-z0-9_\\u4e00-\\u9fa5-]+$")) {
      throw ApiException.badRequest("用户名只能包含中英文、数字、下划线或短横线");
    }
    return value;
  }

  private String normalizeDisplayName(String displayName, String fallback) {
    String value = displayName == null ? "" : displayName.trim();
    if (value.isEmpty()) {
      return fallback;
    }
    if (value.length() > 24) {
      throw ApiException.badRequest("昵称最多 24 个字符");
    }
    return value;
  }
}
