package com.wanfeng.blog.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wanfeng.blog.auth.UserDao;
import com.wanfeng.blog.question.QuestionDao;
import com.wanfeng.blog.question.QuestionDtos;
import com.wanfeng.blog.question.QuestionService;
import java.io.InputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 首次启动时准备管理员账号和一套 408 示例题。
 * 都是「没有才创建」，不会覆盖你后来改过的密码或导入的题库。
 */
@Component
public class DataInitializer implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
  private static final String DEFAULT_ADMIN_PASSWORD = "wanfeng-408";

  private final UserDao userDao;
  private final PasswordEncoder passwordEncoder;
  private final AppProperties properties;
  private final QuestionDao questionDao;
  private final QuestionService questionService;
  private final ObjectMapper objectMapper;

  public DataInitializer(UserDao userDao, PasswordEncoder passwordEncoder, AppProperties properties,
      QuestionDao questionDao, QuestionService questionService, ObjectMapper objectMapper) {
    this.userDao = userDao;
    this.passwordEncoder = passwordEncoder;
    this.properties = properties;
    this.questionDao = questionDao;
    this.questionService = questionService;
    this.objectMapper = objectMapper;
  }

  @Override
  public void run(ApplicationArguments args) {
    seedAdmin();
    seedQuestionBank();
  }

  private void seedAdmin() {
    AppProperties.Admin admin = properties.getAdmin();
    var existing = userDao.findByUsername(admin.getUsername());
    if (existing.isEmpty()) {
      userDao.insert(admin.getUsername(), passwordEncoder.encode(admin.getPassword()),
          admin.getDisplayName(), "ADMIN");
      log.info("已创建管理员账号：{}", admin.getUsername());
      if (DEFAULT_ADMIN_PASSWORD.equals(admin.getPassword())) {
        log.warn("管理员正在使用默认密码，部署到公网前请修改 BLOG_ADMIN_PASSWORD");
      }
    } else if (!"ADMIN".equals(existing.get().role())) {
      userDao.updateRole(existing.get().id(), "ADMIN");
      log.info("已把账号 {} 提升为管理员", admin.getUsername());
    }
  }

  private void seedQuestionBank() {
    if (questionDao.countSets() > 0) {
      return;
    }
    ClassPathResource resource = new ClassPathResource("seed/408-sample.json");
    if (!resource.exists()) {
      return;
    }
    try (InputStream input = resource.getInputStream()) {
      QuestionDtos.SetImport data = objectMapper.readValue(input, QuestionDtos.SetImport.class);
      questionService.importSet(data);
      log.info("已导入 408 示例题库：{} 道题", data.questions().size());
    } catch (Exception error) {
      log.warn("导入 408 示例题库失败：{}", error.getMessage());
    }
  }
}
