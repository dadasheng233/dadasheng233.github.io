package com.wanfeng.blog.progress;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wanfeng.blog.auth.AuthSupport;
import com.wanfeng.blog.auth.UserAccount;
import com.wanfeng.blog.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 学习进度云同步。前端 localStorage 里的结构原样存进来，后端不关心字段含义，
 * 只做「按账号 + 类型」的覆盖式保存，方便以后加新的进度类型。
 */
@RestController
@RequestMapping("/api/progress")
public class ProgressController {

  private static final Pattern KIND_PATTERN = Pattern.compile("^[a-z0-9][a-z0-9-]{0,31}$");
  private static final int MAX_PAYLOAD_BYTES = 512 * 1024;

  private final ProgressDao progressDao;
  private final ObjectMapper objectMapper;

  public ProgressController(ProgressDao progressDao, ObjectMapper objectMapper) {
    this.progressDao = progressDao;
    this.objectMapper = objectMapper;
  }

  @GetMapping
  public Map<String, Object> all() {
    UserAccount account = requireUser();
    List<Map<String, Object>> items = new ArrayList<>();
    for (ProgressDao.ProgressRow row : progressDao.findAll(account.id())) {
      items.add(item(row));
    }
    return Map.of("items", items);
  }

  @GetMapping("/{kind}")
  public Map<String, Object> one(@PathVariable String kind) {
    UserAccount account = requireUser();
    String normalized = normalizeKind(kind);
    Optional<ProgressDao.ProgressRow> row = progressDao.find(account.id(), normalized);
    if (row.isEmpty()) {
      return Map.of("kind", normalized, "exists", false);
    }
    Map<String, Object> body = new LinkedHashMap<>(item(row.get()));
    body.put("exists", true);
    return body;
  }

  @PutMapping("/{kind}")
  public Map<String, Object> save(@PathVariable String kind, @RequestBody String rawBody) {
    UserAccount account = requireUser();
    String normalized = normalizeKind(kind);
    if (rawBody == null || rawBody.getBytes(StandardCharsets.UTF_8).length > MAX_PAYLOAD_BYTES) {
      throw ApiException.badRequest("进度数据太大了（上限 512KB）");
    }
    JsonNode node;
    try {
      node = objectMapper.readTree(rawBody);
    } catch (Exception error) {
      throw ApiException.badRequest("进度数据必须是合法的 JSON");
    }
    if (node == null || node.isNull()) {
      throw ApiException.badRequest("进度数据不能为空");
    }
    try {
      progressDao.upsert(account.id(), normalized, objectMapper.writeValueAsString(node));
    } catch (Exception error) {
      throw new IllegalStateException("保存进度失败", error);
    }
    return Map.of("ok", true, "kind", normalized, "updatedAt", java.time.Instant.now().toString());
  }

  @DeleteMapping("/{kind}")
  public Map<String, Object> remove(@PathVariable String kind) {
    UserAccount account = requireUser();
    progressDao.delete(account.id(), normalizeKind(kind));
    return Map.of("ok", true);
  }

  private Map<String, Object> item(ProgressDao.ProgressRow row) {
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("kind", row.kind());
    try {
      item.put("data", objectMapper.readTree(row.payload()));
    } catch (Exception error) {
      item.put("data", null);
    }
    item.put("updatedAt", row.updatedAt().toString());
    return item;
  }

  private String normalizeKind(String kind) {
    String value = kind == null ? "" : kind.trim().toLowerCase();
    if (!KIND_PATTERN.matcher(value).matches()) {
      throw ApiException.badRequest("未知的进度类型");
    }
    return value;
  }

  private UserAccount requireUser() {
    UserAccount account = AuthSupport.currentUser();
    if (account == null) {
      throw ApiException.unauthorized("请先登录");
    }
    return account;
  }
}
