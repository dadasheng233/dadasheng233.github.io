package com.wanfeng.blog.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wanfeng.blog.config.AppProperties;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/** 404 时给浏览器返回静态站的 404.html，给接口返回 JSON。 */
@Controller
public class ErrorPageController implements ErrorController {

  private final AppProperties properties;
  private final ObjectMapper objectMapper;

  public ErrorPageController(AppProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
  }

  @RequestMapping("/error")
  public void error(HttpServletRequest request, HttpServletResponse response) throws IOException {
    Object codeAttribute = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
    int status = codeAttribute instanceof Integer code ? code : 500;
    String accept = request.getHeader("Accept");

    if (status == 404 && accept != null && accept.contains("text/html")) {
      Path page = properties.publicPath().resolve("404.html");
      if (Files.isRegularFile(page)) {
        response.setStatus(404);
        response.setContentType("text/html;charset=UTF-8");
        response.setContentLengthLong(Files.size(page));
        Files.copy(page, response.getOutputStream());
        return;
      }
    }

    response.setStatus(status);
    response.setContentType("application/json;charset=UTF-8");
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("status", status);
    body.put("error", status == 404 ? "资源不存在" : "服务器处理请求时出错了");
    objectMapper.writeValue(response.getWriter(), body);
  }
}
