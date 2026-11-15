package com.wanfeng.blog.auth;

public record UserAccount(long id, String username, String passwordHash, String displayName, String role) {

  public boolean isAdmin() {
    return "ADMIN".equals(role);
  }
}
