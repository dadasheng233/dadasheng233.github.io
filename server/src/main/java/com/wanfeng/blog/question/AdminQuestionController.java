package com.wanfeng.blog.question;

import com.wanfeng.blog.common.ApiException;
import com.wanfeng.blog.question.QuestionDtos.SetSummary;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/questions")
public class AdminQuestionController {

  private final QuestionDao questionDao;
  private final QuestionService questionService;

  public AdminQuestionController(QuestionDao questionDao, QuestionService questionService) {
    this.questionDao = questionDao;
    this.questionService = questionService;
  }

  @GetMapping("/sets")
  public List<SetSummary> sets() {
    return questionDao.listSets(true);
  }

  @PostMapping("/import")
  public Map<String, Object> importSet(@RequestBody QuestionDtos.SetImport data) {
    long id = questionService.importSet(data);
    return Map.of("ok", true, "setId", id);
  }

  @PatchMapping("/sets/{id}/publish")
  public Map<String, Object> publish(@PathVariable long id,
      @RequestBody Map<String, Object> body) {
    boolean published = Boolean.TRUE.equals(body.get("published"));
    if (!questionDao.setPublished(id, published)) {
      throw ApiException.notFound("找不到这个题库");
    }
    return Map.of("ok", true, "published", published);
  }

  @DeleteMapping("/sets/{id}")
  public Map<String, Object> delete(@PathVariable long id) {
    if (!questionDao.deleteSet(id)) {
      throw ApiException.notFound("找不到这个题库");
    }
    return Map.of("ok", true);
  }
}
