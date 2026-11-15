package com.wanfeng.blog.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wanfeng.blog.common.ApiException;
import com.wanfeng.blog.config.AppProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** 读写 content/posts/*.html，保持 build.mjs 认识的 front matter 格式。 */
@Service
public class PostService {

  private static final Logger log = LoggerFactory.getLogger(PostService.class);
  private static final Pattern FRONT_MATTER =
      Pattern.compile("^\\s*<!--meta\\s*([\\s\\S]*?)-->\\s*");
  private static final Pattern SLUG_PATTERN = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$");
  private static final DateTimeFormatter BACKUP_STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

  private final AppProperties properties;
  private final ObjectMapper objectMapper;

  public PostService(AppProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
  }

  private Path postsDir() {
    return properties.contentPath().resolve("posts");
  }

  public List<PostDtos.PostSummary> list() {
    Path dir = postsDir();
    if (!Files.isDirectory(dir)) {
      return List.of();
    }
    List<PostDtos.PostSummary> posts = new ArrayList<>();
    try (Stream<Path> files = Files.list(dir)) {
      files.filter(path -> path.getFileName().toString().endsWith(".html"))
          .forEach(path -> {
            try {
              posts.add(toSummary(path));
            } catch (Exception error) {
              log.warn("跳过无法解析的文章 {}: {}", path.getFileName(), error.getMessage());
            }
          });
    } catch (IOException error) {
      throw new IllegalStateException("读取文章目录失败", error);
    }
    posts.sort(Comparator
        .comparing(PostDtos.PostSummary::date, Comparator.nullsLast(Comparator.reverseOrder()))
        .thenComparing(PostDtos.PostSummary::slug));
    return posts;
  }

  public PostDtos.PostDetail read(String slug) {
    Path file = resolveExisting(slug);
    String raw = readFile(file);
    Matcher matcher = FRONT_MATTER.matcher(raw);
    if (!matcher.find()) {
      throw new IllegalStateException("文章 " + slug + " 缺少 front matter");
    }
    Map<String, Object> meta = parseMeta(matcher.group(1), slug);
    return new PostDtos.PostDetail(slug, file.getFileName().toString(), meta, raw.substring(matcher.end()));
  }

  public PostDtos.PostDetail create(PostDtos.PostInput input) {
    String slug = requireSlug(input.slug());
    Path file = postsDir().resolve(slug + ".html");
    if (Files.exists(file)) {
      throw ApiException.conflict("同名文章已经存在：" + slug);
    }
    Map<String, Object> meta = buildMeta(slug, input);
    writePost(file, meta, safeBody(input.body()));
    return read(slug);
  }

  public PostDtos.PostDetail update(String slug, PostDtos.PostInput input) {
    Path file = resolveExisting(slug);
    Map<String, Object> meta = buildMeta(slug, input);
    writePost(file, meta, safeBody(input.body()));
    return read(slug);
  }

  public Map<String, Object> delete(String slug) {
    Path file = resolveExisting(slug);
    Path backupDir = properties.contentPath().resolve("backups");
    String stamp = LocalDateTime.now().format(BACKUP_STAMP);
    Path backup = backupDir.resolve(file.getFileName().toString().replace(".html", "-" + stamp + ".html"));
    try {
      Files.createDirectories(backupDir);
      Files.move(file, backup, StandardCopyOption.REPLACE_EXISTING);
    } catch (IOException error) {
      throw new IllegalStateException("删除文章失败", error);
    }
    return Map.of("ok", true, "backup", backup.getFileName().toString());
  }

  private PostDtos.PostSummary toSummary(Path file) throws IOException {
    String raw = Files.readString(file, StandardCharsets.UTF_8);
    Matcher matcher = FRONT_MATTER.matcher(raw);
    Map<String, Object> meta = new LinkedHashMap<>();
    if (matcher.find()) {
      meta = parseMeta(matcher.group(1), file.getFileName().toString());
    }
    String slug = String.valueOf(meta.getOrDefault("slug",
        file.getFileName().toString().replace(".html", "")));
    List<String> tags = new ArrayList<>();
    if (meta.get("tags") instanceof List<?> list) {
      list.forEach(tag -> tags.add(String.valueOf(tag)));
    }
    return new PostDtos.PostSummary(
        slug,
        file.getFileName().toString(),
        String.valueOf(meta.getOrDefault("title", slug)),
        stringOrNull(meta.get("subtitle")),
        stringOrNull(meta.get("date")),
        stringOrNull(meta.get("updated")),
        stringOrNull(meta.get("category")),
        tags,
        Boolean.TRUE.equals(meta.get("featured")),
        Files.size(file),
        "/posts/" + slug + ".html");
  }

  private Map<String, Object> parseMeta(String json, String label) {
    try {
      Map<String, Object> meta = objectMapper.readValue(json,
          objectMapper.getTypeFactory().constructMapType(LinkedHashMap.class, String.class, Object.class));
      return meta == null ? new LinkedHashMap<>() : meta;
    } catch (Exception error) {
      throw new IllegalStateException("文章 " + label + " 的 front matter 不是合法 JSON", error);
    }
  }

  private Map<String, Object> buildMeta(String slug, PostDtos.PostInput input) {
    if (input.title() == null || input.title().isBlank()) {
      throw ApiException.badRequest("标题不能为空");
    }
    String date = input.date() == null ? "" : input.date().trim();
    if (!date.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
      throw ApiException.badRequest("日期格式需要是 YYYY-MM-DD");
    }
    try {
      LocalDate.parse(date);
    } catch (Exception error) {
      throw ApiException.badRequest("日期不合法：" + date);
    }
    if (input.category() == null || input.category().isBlank()) {
      throw ApiException.badRequest("分类不能为空");
    }

    Map<String, Object> meta = new LinkedHashMap<>();
    meta.put("slug", slug);
    meta.put("title", input.title().trim());
    putIfPresent(meta, "subtitle", input.subtitle());
    meta.put("date", date);
    putIfPresent(meta, "updated", input.updated());
    meta.put("category", input.category().trim());
    meta.put("tags", input.tags() == null ? List.of()
        : input.tags().stream().map(String::trim).filter(tag -> !tag.isEmpty()).toList());
    if (input.cover() != null && !input.cover().isBlank()) {
      meta.put("cover", input.cover().trim());
    }
    putIfPresent(meta, "coverAlt", input.coverAlt());
    putIfPresent(meta, "excerpt", input.excerpt());
    meta.put("featured", Boolean.TRUE.equals(input.featured()));
    putIfPresent(meta, "views", input.views());
    if (input.reading() != null && input.reading() > 0) {
      meta.put("reading", input.reading());
    }
    return meta;
  }

  private void putIfPresent(Map<String, Object> meta, String key, String value) {
    if (value != null && !value.isBlank()) {
      meta.put(key, value.trim());
    }
  }

  private String safeBody(String body) {
    String value = body == null ? "" : body;
    if (value.contains("<!--meta")) {
      throw ApiException.badRequest("正文里不能包含 <!--meta 片段");
    }
    return value;
  }

  private void writePost(Path file, Map<String, Object> meta, String body) {
    try {
      Files.createDirectories(file.getParent());
      String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(meta);
      String content = "<!--meta\n" + json + "\n-->\n" + body.stripLeading() + "\n";
      Path temp = file.resolveSibling(file.getFileName() + ".tmp");
      Files.writeString(temp, content, StandardCharsets.UTF_8);
      Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    } catch (IOException error) {
      throw new IllegalStateException("保存文章失败", error);
    }
  }

  private Path resolveExisting(String slug) {
    String value = requireSlug(slug);
    Path dir = postsDir();
    Path file = dir.resolve(value + ".html");
    if (Files.exists(file)) {
      return file;
    }
    // 允许文件名和 front matter slug 不一致的老文章：按 meta.slug 再找一遍。
    if (Files.isDirectory(dir)) {
      try (Stream<Path> files = Files.list(dir)) {
        for (Path candidate : files.filter(path -> path.toString().endsWith(".html")).toList()) {
          String raw = Files.readString(candidate, StandardCharsets.UTF_8);
          Matcher matcher = FRONT_MATTER.matcher(raw);
          if (matcher.find()) {
            Map<String, Object> meta = parseMeta(matcher.group(1), candidate.getFileName().toString());
            if (value.equals(String.valueOf(meta.get("slug")))) {
              return candidate;
            }
          }
        }
      } catch (IOException error) {
        throw new IllegalStateException("查找文章失败", error);
      }
    }
    throw ApiException.notFound("找不到文章：" + value);
  }

  private String requireSlug(String slug) {
    String value = slug == null ? "" : slug.trim();
    if (!SLUG_PATTERN.matcher(value).matches()) {
      throw ApiException.badRequest("slug 只能包含字母、数字、下划线和短横线，且不能以短横线开头");
    }
    return value;
  }

  private String readFile(Path file) {
    try {
      return Files.readString(file, StandardCharsets.UTF_8);
    } catch (IOException error) {
      throw new IllegalStateException("读取文章失败", error);
    }
  }

  private String stringOrNull(Object value) {
    return value == null ? null : String.valueOf(value);
  }
}
