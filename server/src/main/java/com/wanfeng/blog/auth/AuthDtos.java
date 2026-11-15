package com.wanfeng.blog.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

  private AuthDtos() {
  }

  public record RegisterRequest(
      @NotBlank(message = "用户名不能为空")
      @Size(min = 3, max = 20, message = "用户名长度需要在 3 到 20 个字符之间")
      @Pattern(regexp = "^[A-Za-z0-9_\\u4e00-\\u9fa5-]+$",
          message = "用户名只能包含中英文、数字、下划线或短横线")
      String username,
      @NotBlank(message = "密码不能为空")
      @Size(min = 8, max = 72, message = "密码长度需要在 8 到 72 位之间")
      String password,
      @Size(max = 24, message = "昵称最多 24 个字符")
      String displayName) {
  }

  public record LoginRequest(
      @NotBlank(message = "请输入用户名") String username,
      @NotBlank(message = "请输入密码") String password) {
  }

  public record UserView(long id, String username, String displayName, String role, boolean admin) {

    public static UserView of(UserAccount account) {
      return new UserView(account.id(), account.username(), account.displayName(), account.role(),
          "ADMIN".equals(account.role()));
    }
  }

  public record MeView(boolean authenticated, UserView user) {

    public static MeView anonymous() {
      return new MeView(false, null);
    }

    public static MeView of(UserAccount account) {
      return account == null ? anonymous() : new MeView(true, UserView.of(account));
    }
  }
}
