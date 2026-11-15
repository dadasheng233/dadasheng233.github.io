package com.wanfeng.blog.question;

import com.wanfeng.blog.auth.AuthSupport;
import com.wanfeng.blog.auth.UserAccount;
import com.wanfeng.blog.common.ApiException;
import com.wanfeng.blog.question.QuestionDtos.PracticeStats;
import com.wanfeng.blog.question.QuestionDtos.RecentItem;
import com.wanfeng.blog.question.QuestionDtos.WrongItem;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/practice")
public class PracticeController {

  private final QuestionDao questionDao;

  public PracticeController(QuestionDao questionDao) {
    this.questionDao = questionDao;
  }

  @GetMapping("/wrong-book")
  public List<WrongItem> wrongBook() {
    return questionDao.wrongBook(requireUser().id());
  }

  @GetMapping("/stats")
  public PracticeStats stats() {
    return questionDao.stats(requireUser().id());
  }

  @GetMapping("/recent")
  public List<RecentItem> recent(@RequestParam(defaultValue = "20") int limit) {
    int size = Math.max(1, Math.min(limit, 100));
    return questionDao.recent(requireUser().id(), size);
  }

  private UserAccount requireUser() {
    UserAccount account = AuthSupport.currentUser();
    if (account == null) {
      throw ApiException.unauthorized("请先登录");
    }
    return account;
  }
}
