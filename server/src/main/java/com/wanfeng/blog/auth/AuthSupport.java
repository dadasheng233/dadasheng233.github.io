package com.wanfeng.blog.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

@Component
public class AuthSupport {

  private final SecurityContextRepository securityContextRepository;

  public AuthSupport(SecurityContextRepository securityContextRepository) {
    this.securityContextRepository = securityContextRepository;
  }

  public void signIn(UserAccount account, HttpServletRequest request, HttpServletResponse response) {
    var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + account.role()));
    var authentication = UsernamePasswordAuthenticationToken.authenticated(account, null, authorities);
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);

    // 先建立 session，再换 id，避免会话固定攻击。
    request.getSession(true);
    try {
      request.changeSessionId();
    } catch (IllegalStateException ignored) {
      // 某些容器下没有可变更的 session id，不影响登录。
    }
    securityContextRepository.saveContext(context, request, response);
  }

  public void signOut(HttpServletRequest request) {
    HttpSession session = request.getSession(false);
    if (session != null) {
      session.invalidate();
    }
    SecurityContextHolder.clearContext();
  }

  public static UserAccount currentUser() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !authentication.isAuthenticated()) {
      return null;
    }
    Object principal = authentication.getPrincipal();
    return principal instanceof UserAccount account ? account : null;
  }
}
