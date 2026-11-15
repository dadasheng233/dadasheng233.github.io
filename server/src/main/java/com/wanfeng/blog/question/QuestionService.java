package com.wanfeng.blog.question;

import com.wanfeng.blog.common.ApiException;
import com.wanfeng.blog.question.QuestionDtos.AnswerResult;
import com.wanfeng.blog.question.QuestionDtos.Option;
import com.wanfeng.blog.question.QuestionDtos.QuestionImport;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class QuestionService {

  private static final int MAX_QUESTIONS_PER_SET = 500;
  private static final Set<String> TYPES = Set.of("single", "multiple", "judge");

  private final QuestionDao questionDao;

  public QuestionService(QuestionDao questionDao) {
    this.questionDao = questionDao;
  }

  public long importSet(QuestionDtos.SetImport data) {
    if (data == null) {
      throw ApiException.badRequest("没有收到题库内容");
    }
    String title = trim(data.title());
    if (title.isBlank()) {
      throw ApiException.badRequest("题库需要一个标题");
    }
    String subject = trim(data.subject()).toLowerCase(Locale.ROOT);
    if (!Subjects.valid(subject)) {
      throw ApiException.badRequest("subject 只能是 ds / co / os / cn");
    }
    if (data.questions() == null || data.questions().isEmpty()) {
      throw ApiException.badRequest("题库里至少要有一道题");
    }
    if (data.questions().size() > MAX_QUESTIONS_PER_SET) {
      throw ApiException.badRequest("单次最多导入 " + MAX_QUESTIONS_PER_SET + " 道题");
    }
    if (data.year() != null && (data.year() < 1980 || data.year() > 2100)) {
      throw ApiException.badRequest("年份看起来不对");
    }

    List<QuestionImport> normalized = new ArrayList<>();
    int index = 1;
    for (QuestionImport question : data.questions()) {
      normalized.add(normalize(question, index++));
    }
    return questionDao.createSet(new QuestionDtos.SetImport(
        title, subject, data.year(), trimOrNull(data.source()), trimOrNull(data.description()),
        data.published() == null ? Boolean.TRUE : data.published(), normalized));
  }

  public AnswerResult grade(long questionId, String chosen, Long userId) {
    QuestionDao.QuestionRow row = questionDao.findQuestion(questionId)
        .orElseThrow(() -> ApiException.notFound("找不到这道题"));
    String normalizedChosen = normalizeAnswer(chosen);
    if (normalizedChosen.isEmpty()) {
      throw ApiException.badRequest("请选择一个答案");
    }
    String answer = normalizeAnswer(row.answer());
    boolean correct = answer.equals(normalizedChosen);
    if (userId != null) {
      questionDao.recordAnswer(userId, questionId, normalizedChosen, correct);
    }
    List<Option> options = questionDao.readOptions(row.optionsJson());
    return new AnswerResult(row.id(), correct, answer, normalizedChosen, row.analysis(),
        row.knowledge(), options);
  }

  private QuestionImport normalize(QuestionImport question, int index) {
    if (question == null) {
      throw ApiException.badRequest("第 " + index + " 道题是空的");
    }
    String stem = trim(question.stem());
    if (stem.isBlank()) {
      throw ApiException.badRequest("第 " + index + " 道题缺少题干");
    }
    if (stem.length() > 20000) {
      throw ApiException.badRequest("第 " + index + " 道题题干太长了");
    }
    String type = trim(question.type()).toLowerCase(Locale.ROOT);
    if (type.isBlank()) {
      type = "single";
    }
    if (!TYPES.contains(type)) {
      throw ApiException.badRequest("第 " + index + " 道题的 type 只能是 single / multiple / judge");
    }

    List<Option> options = new ArrayList<>();
    List<Option> source = question.options() == null ? List.of() : question.options();
    for (int i = 0; i < source.size(); i++) {
      Option option = source.get(i);
      if (option == null || trim(option.text()).isBlank()) {
        throw ApiException.badRequest("第 " + index + " 道题有空选项");
      }
      String key = trim(option.key()).toUpperCase(Locale.ROOT);
      if (key.isBlank()) {
        key = String.valueOf((char) ('A' + i));
      }
      if (!key.matches("^[A-Z]$")) {
        throw ApiException.badRequest("第 " + index + " 道题的选项编号只能是单个字母");
      }
      options.add(new Option(key, trim(option.text())));
    }
    if (options.size() < 2) {
      throw ApiException.badRequest("第 " + index + " 道题至少要有两个选项");
    }
    Set<String> keys = new LinkedHashSet<>();
    options.forEach(option -> keys.add(option.key()));
    if (keys.size() != options.size()) {
      throw ApiException.badRequest("第 " + index + " 道题有重复的选项编号");
    }

    String answer = normalizeAnswer(question.answer());
    if (answer.isEmpty()) {
      throw ApiException.badRequest("第 " + index + " 道题缺少答案");
    }
    for (char c : answer.toCharArray()) {
      if (!keys.contains(String.valueOf(c))) {
        throw ApiException.badRequest("第 " + index + " 道题的答案 " + answer + " 不在选项里");
      }
    }
    if ("single".equals(type) && answer.length() != 1) {
      throw ApiException.badRequest("第 " + index + " 道题是单选，但答案有多个字母");
    }

    Integer difficulty = question.difficulty();
    if (difficulty != null && (difficulty < 1 || difficulty > 5)) {
      throw ApiException.badRequest("第 " + index + " 道题难度需要在 1-5 之间");
    }

    return new QuestionImport(type, stem, options, answer, trimOrNull(question.analysis()),
        difficulty, trimOrNull(question.knowledge()));
  }

  public static String normalizeAnswer(String value) {
    if (value == null) {
      return "";
    }
    return value.chars()
        .filter(ch -> Character.isLetterOrDigit(ch))
        .map(Character::toUpperCase)
        .sorted()
        .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
        .toString();
  }

  private String trim(String value) {
    return value == null ? "" : value.trim();
  }

  private String trimOrNull(String value) {
    String result = trim(value);
    return result.isBlank() ? null : result;
  }
}
