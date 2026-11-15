package com.wanfeng.blog.question;

import com.wanfeng.blog.auth.AuthSupport;
import com.wanfeng.blog.auth.UserAccount;
import com.wanfeng.blog.common.ApiException;
import com.wanfeng.blog.question.QuestionDtos.AnswerRequest;
import com.wanfeng.blog.question.QuestionDtos.AnswerResult;
import com.wanfeng.blog.question.QuestionDtos.SetDetail;
import com.wanfeng.blog.question.QuestionDtos.SetSummary;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/questions")
public class QuestionController {

  private final QuestionDao questionDao;
  private final QuestionService questionService;

  public QuestionController(QuestionDao questionDao, QuestionService questionService) {
    this.questionDao = questionDao;
    this.questionService = questionService;
  }

  @GetMapping("/sets")
  public List<SetSummary> sets() {
    return questionDao.listSets(false);
  }

  @GetMapping("/sets/{id}")
  public SetDetail set(@PathVariable long id) {
    SetDetail detail = questionDao.findSet(id)
        .orElseThrow(() -> ApiException.notFound("找不到这个题库"));
    UserAccount account = AuthSupport.currentUser();
    if (!detail.published() && (account == null || !account.isAdmin())) {
      throw ApiException.notFound("找不到这个题库");
    }
    return detail;
  }

  @PostMapping("/{id}/answer")
  public AnswerResult answer(@PathVariable long id, @RequestBody(required = false) AnswerRequest request) {
    if (request == null || request.chosen() == null || request.chosen().isBlank()) {
      throw ApiException.badRequest("请选择一个答案");
    }
    UserAccount account = AuthSupport.currentUser();
    return questionService.grade(id, request.chosen(), account == null ? null : account.id());
  }
}
