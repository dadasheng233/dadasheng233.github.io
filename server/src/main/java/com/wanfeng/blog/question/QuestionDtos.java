package com.wanfeng.blog.question;

import java.util.List;

public final class QuestionDtos {

  private QuestionDtos() {
  }

  public record Option(String key, String text) {
  }

  public record QuestionImport(
      String type,
      String stem,
      List<Option> options,
      String answer,
      String analysis,
      Integer difficulty,
      String knowledge) {
  }

  public record SetImport(
      String title,
      String subject,
      Integer year,
      String source,
      String description,
      Boolean published,
      List<QuestionImport> questions) {
  }

  public record SetSummary(
      long id,
      String title,
      String subject,
      String subjectLabel,
      Integer year,
      String source,
      String description,
      boolean published,
      int questionCount,
      String createdAt) {
  }

  public record QuestionView(
      long id,
      long setId,
      int seq,
      String type,
      String stem,
      List<Option> options,
      Integer difficulty,
      String knowledge) {
  }

  public record SetDetail(
      long id,
      String title,
      String subject,
      String subjectLabel,
      Integer year,
      String source,
      String description,
      boolean published,
      int questionCount,
      List<QuestionView> questions) {
  }

  public record AnswerRequest(String chosen) {
  }

  public record AnswerResult(
      long questionId,
      boolean correct,
      String answer,
      String chosen,
      String analysis,
      String knowledge,
      List<Option> options) {
  }

  public record WrongItem(
      long questionId,
      long setId,
      String setTitle,
      String subject,
      String subjectLabel,
      int seq,
      String stem,
      List<Option> options,
      String answer,
      String analysis,
      String chosen,
      int wrongCount,
      String lastWrongAt) {
  }

  public record SubjectStat(String subject, String subjectLabel, long total, long correct) {
  }

  public record PracticeStats(
      long total,
      long correct,
      long uniqueQuestions,
      long wrongQuestions,
      double accuracy,
      List<SubjectStat> subjects) {
  }

  public record RecentItem(
      long recordId,
      long questionId,
      String setTitle,
      String stem,
      boolean correct,
      String chosen,
      String createdAt) {
  }
}
