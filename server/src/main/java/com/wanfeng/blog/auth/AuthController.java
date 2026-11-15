package com.wanfeng.blog.auth;

import com.wanfeng.blog.auth.AuthDtos.LoginRequest;
import com.wanfeng.blog.auth.AuthDtos.MeView;
import com.wanfeng.blog.auth.AuthDtos.RegisterRequest;
import com.wanfeng.blog.auth.AuthDtos.UserView;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthService authService;
  private final AuthSupport authSupport;

  public AuthController(AuthService authService, AuthSupport authSupport) {
    this.authService = authService;
    this.authSupport = authSupport;
  }

  @PostMapping("/register")
  public MeView register(@Valid @RequestBody RegisterRequest request,
      HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
    UserAccount account = authService.register(
        request.username(), request.password(), request.displayName());
    authSupport.signIn(account, httpRequest, httpResponse);
    return MeView.of(account);
  }

  @PostMapping("/login")
  public MeView login(@Valid @RequestBody LoginRequest request,
      HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
    UserAccount account = authService.login(request.username(), request.password());
    authSupport.signIn(account, httpRequest, httpResponse);
    return MeView.of(account);
  }

  @PostMapping("/logout")
  public Map<String, Object> logout(HttpServletRequest request) {
    authSupport.signOut(request);
    return Map.of("ok", true);
  }

  @GetMapping("/me")
  public MeView me(@AuthenticationPrincipal UserAccount account) {
    return MeView.of(account);
  }

  @GetMapping("/user")
  public UserView current(@AuthenticationPrincipal UserAccount account) {
    return account == null ? null : UserView.of(account);
  }
}
