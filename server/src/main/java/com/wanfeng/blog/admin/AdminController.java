package com.wanfeng.blog.admin;

import com.wanfeng.blog.auth.UserDao;
import com.wanfeng.blog.common.ApiException;
import com.wanfeng.blog.question.QuestionDao;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

  private final PostService postService;
  private final BuildService buildService;
  private final UserDao userDao;
  private final QuestionDao questionDao;

  public AdminController(PostService postService, BuildService buildService,
      UserDao userDao, QuestionDao questionDao) {
    this.postService = postService;
    this.buildService = buildService;
    this.userDao = userDao;
    this.questionDao = questionDao;
  }

  @GetMapping("/overview")
  public Map<String, Object> overview() {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("posts", postService.list().size());
    body.put("users", userDao.count());
    body.put("questionSets", questionDao.countSets());
    return body;
  }

  @GetMapping("/posts")
  public Map<String, Object> posts() {
    List<PostDtos.PostSummary> posts = postService.list();
    return Map.of("items", posts, "total", posts.size());
  }

  @GetMapping("/posts/{slug}")
  public PostDtos.PostDetail post(@PathVariable String slug) {
    return postService.read(slug);
  }

  @PostMapping("/posts")
  public PostDtos.PostDetail create(@Valid @RequestBody PostDtos.PostInput input) {
    if (input.slug() == null || input.slug().isBlank()) {
      throw ApiException.badRequest("请先填 slug（文章地址）");
    }
    return postService.create(input);
  }

  @PutMapping("/posts/{slug}")
  public PostDtos.PostDetail update(@PathVariable String slug,
      @Valid @RequestBody PostDtos.PostInput input) {
    return postService.update(slug, input);
  }

  @DeleteMapping("/posts/{slug}")
  public Map<String, Object> delete(@PathVariable String slug) {
    return postService.delete(slug);
  }

  @PostMapping("/build")
  public PostDtos.BuildResult rebuild() {
    return buildService.build();
  }
}
