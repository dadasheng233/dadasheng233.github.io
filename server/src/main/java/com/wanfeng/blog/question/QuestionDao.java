package com.wanfeng.blog.question;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wanfeng.blog.question.QuestionDtos.Option;
import com.wanfeng.blog.question.QuestionDtos.QuestionView;
import com.wanfeng.blog.question.QuestionDtos.RecentItem;
import com.wanfeng.blog.question.QuestionDtos.SetDetail;
import com.wanfeng.blog.question.QuestionDtos.SetSummary;
import com.wanfeng.blog.question.QuestionDtos.SubjectStat;
import com.wanfeng.blog.question.QuestionDtos.WrongItem;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class QuestionDao {

  private static final TypeReference<List<Option>> OPTION_LIST = new TypeReference<>() {
  };

  public record QuestionRow(
      long id,
      long setId,
      int seq,
      String type,
      String stem,
      String optionsJson,
      String answer,
      String analysis,
      Integer difficulty,
      String knowledge) {
  }

  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;

  public QuestionDao(JdbcTemplate jdbc, ObjectMapper objectMapper) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
  }

  public long createSet(QuestionDtos.SetImport data) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement ps = connection.prepareStatement(
          "INSERT INTO question_sets (title, subject, exam_year, source, description, published) "
              + "VALUES (?, ?, ?, ?, ?, ?)",
          Statement.RETURN_GENERATED_KEYS);
      ps.setString(1, data.title());
      ps.setString(2, data.subject());
      if (data.year() == null) {
        ps.setNull(3, java.sql.Types.INTEGER);
      } else {
        ps.setInt(3, data.year());
      }
      ps.setString(4, data.source());
      ps.setString(5, data.description());
      ps.setBoolean(6, data.published() == null || data.published());
      return ps;
    }, keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new IllegalStateException("创建题库失败");
    }
    long setId = key.longValue();

    int seq = 1;
    for (QuestionDtos.QuestionImport question : data.questions()) {
      jdbc.update(
          "INSERT INTO questions (set_id, seq, type, stem, options, answer, analysis, difficulty, knowledge) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          setId, seq++, question.type(), question.stem(),
          writeOptions(question.options()), question.answer(), question.analysis(),
          question.difficulty(), question.knowledge());
    }
    return setId;
  }

  public List<SetSummary> listSets(boolean includeUnpublished) {
    String sql = "SELECT s.id, s.title, s.subject, s.exam_year, s.source, s.description, s.published, "
        + "s.created_at, "
        + "(SELECT COUNT(*) FROM questions q WHERE q.set_id = s.id) AS question_count "
        + "FROM question_sets s "
        + (includeUnpublished ? "" : "WHERE s.published = TRUE ")
        + "ORDER BY COALESCE(s.exam_year, 0) DESC, s.id DESC";
    return jdbc.query(sql, (rs, rowNum) -> new SetSummary(
        rs.getLong("id"),
        rs.getString("title"),
        rs.getString("subject"),
        Subjects.label(rs.getString("subject")),
        (Integer) rs.getObject("exam_year", Integer.class),
        rs.getString("source"),
        rs.getString("description"),
        rs.getBoolean("published"),
        rs.getInt("question_count"),
        toIso(rs.getTimestamp("created_at"))));
  }

  public Optional<SetDetail> findSet(long id) {
    List<SetDetail> sets = jdbc.query(
        "SELECT s.id, s.title, s.subject, s.exam_year, s.source, s.description, s.published, "
            + "(SELECT COUNT(*) FROM questions q WHERE q.set_id = s.id) AS question_count "
            + "FROM question_sets s WHERE s.id = ?",
        (rs, rowNum) -> new SetDetail(
            rs.getLong("id"),
            rs.getString("title"),
            rs.getString("subject"),
            Subjects.label(rs.getString("subject")),
            (Integer) rs.getObject("exam_year", Integer.class),
            rs.getString("source"),
            rs.getString("description"),
            rs.getBoolean("published"),
            rs.getInt("question_count"),
            List.of()),
        id);
    if (sets.isEmpty()) {
      return Optional.empty();
    }
    SetDetail base = sets.get(0);
    List<QuestionView> questions = new ArrayList<>();
    for (QuestionRow row : listQuestions(id)) {
      questions.add(toView(row));
    }
    return Optional.of(new SetDetail(base.id(), base.title(), base.subject(), base.subjectLabel(),
        base.year(), base.source(), base.description(), base.published(), base.questionCount(), questions));
  }

  public List<QuestionRow> listQuestions(long setId) {
    return jdbc.query(
        "SELECT id, set_id, seq, type, stem, options, answer, analysis, difficulty, knowledge "
            + "FROM questions WHERE set_id = ? ORDER BY seq, id",
        QUESTION_MAPPER, setId);
  }

  public Optional<QuestionRow> findQuestion(long id) {
    List<QuestionRow> rows = jdbc.query(
        "SELECT id, set_id, seq, type, stem, options, answer, analysis, difficulty, knowledge "
            + "FROM questions WHERE id = ?",
        QUESTION_MAPPER, id);
    return rows.stream().findFirst();
  }

  public void recordAnswer(long userId, long questionId, String chosen, boolean correct) {
    jdbc.update(
        "INSERT INTO practice_records (user_id, question_id, chosen, correct) VALUES (?, ?, ?, ?)",
        userId, questionId, chosen, correct);
  }

  public List<WrongItem> wrongBook(long userId) {
    String sql = "SELECT q.id, q.set_id, q.seq, q.stem, q.options, q.answer, q.analysis, "
        + "s.title AS set_title, s.subject, r.chosen, r.created_at, agg.wrong_count "
        + "FROM (SELECT question_id, MAX(id) AS last_id, "
        + "             SUM(CASE WHEN correct THEN 0 ELSE 1 END) AS wrong_count "
        + "      FROM practice_records WHERE user_id = ? GROUP BY question_id) agg "
        + "JOIN practice_records r ON r.id = agg.last_id "
        + "JOIN questions q ON q.id = agg.question_id "
        + "JOIN question_sets s ON s.id = q.set_id "
        + "WHERE r.correct = FALSE "
        + "ORDER BY r.created_at DESC";
    return jdbc.query(sql, (rs, rowNum) -> new WrongItem(
        rs.getLong("id"),
        rs.getLong("set_id"),
        rs.getString("set_title"),
        rs.getString("subject"),
        Subjects.label(rs.getString("subject")),
        rs.getInt("seq"),
        rs.getString("stem"),
        readOptions(rs.getString("options")),
        rs.getString("answer"),
        rs.getString("analysis"),
        rs.getString("chosen"),
        rs.getInt("wrong_count"),
        toIso(rs.getTimestamp("created_at"))),
        userId);
  }

  public QuestionDtos.PracticeStats stats(long userId) {
    long total = 0;
    long correct = 0;
    long unique = 0;
    List<long[]> counts = jdbc.query(
        "SELECT COUNT(*) AS total, "
            + "COALESCE(SUM(CASE WHEN correct THEN 1 ELSE 0 END), 0) AS correct, "
            + "COUNT(DISTINCT question_id) AS unique_questions "
            + "FROM practice_records WHERE user_id = ?",
        (rs, rowNum) -> new long[] {rs.getLong("total"), rs.getLong("correct"),
            rs.getLong("unique_questions")},
        userId);
    if (!counts.isEmpty()) {
      total = counts.get(0)[0];
      correct = counts.get(0)[1];
      unique = counts.get(0)[2];
    }

    List<SubjectStat> subjects = jdbc.query(
        "SELECT s.subject, COUNT(*) AS total, "
            + "COALESCE(SUM(CASE WHEN r.correct THEN 1 ELSE 0 END), 0) AS correct "
            + "FROM practice_records r "
            + "JOIN questions q ON q.id = r.question_id "
            + "JOIN question_sets s ON s.id = q.set_id "
            + "WHERE r.user_id = ? GROUP BY s.subject ORDER BY s.subject",
        (rs, rowNum) -> new SubjectStat(
            rs.getString("subject"),
            Subjects.label(rs.getString("subject")),
            rs.getLong("total"),
            rs.getLong("correct")),
        userId);

    long wrongQuestions = wrongBook(userId).size();
    double accuracy = total == 0 ? 0 : Math.round(correct * 1000.0 / total) / 10.0;
    return new QuestionDtos.PracticeStats(total, correct, unique, wrongQuestions, accuracy, subjects);
  }

  public List<RecentItem> recent(long userId, int limit) {
    return jdbc.query(
        "SELECT r.id, r.correct, r.chosen, r.created_at, q.id AS question_id, q.stem, "
            + "s.title AS set_title "
            + "FROM practice_records r "
            + "JOIN questions q ON q.id = r.question_id "
            + "JOIN question_sets s ON s.id = q.set_id "
            + "WHERE r.user_id = ? ORDER BY r.id DESC LIMIT ?",
        (rs, rowNum) -> new RecentItem(
            rs.getLong("id"),
            rs.getLong("question_id"),
            rs.getString("set_title"),
            rs.getString("stem"),
            rs.getBoolean("correct"),
            rs.getString("chosen"),
            toIso(rs.getTimestamp("created_at"))),
        userId, limit);
  }

  public boolean deleteSet(long id) {
    return jdbc.update("DELETE FROM question_sets WHERE id = ?", id) > 0;
  }

  public boolean setPublished(long id, boolean published) {
    return jdbc.update("UPDATE question_sets SET published = ? WHERE id = ?", published, id) > 0;
  }

  public long countSets() {
    Long value = jdbc.queryForObject("SELECT COUNT(*) FROM question_sets", Long.class);
    return value == null ? 0 : value;
  }

  public long countQuestions() {
    Long value = jdbc.queryForObject("SELECT COUNT(*) FROM questions", Long.class);
    return value == null ? 0 : value;
  }

  public QuestionView toView(QuestionRow row) {
    return new QuestionView(row.id(), row.setId(), row.seq(), row.type(), row.stem(),
        readOptions(row.optionsJson()), row.difficulty(), row.knowledge());
  }

  public List<Option> readOptions(String json) {
    if (json == null || json.isBlank()) {
      return List.of();
    }
    try {
      return objectMapper.readValue(json, OPTION_LIST);
    } catch (Exception error) {
      return List.of();
    }
  }

  public String writeOptions(List<Option> options) {
    try {
      return objectMapper.writeValueAsString(options == null ? List.of() : options);
    } catch (Exception error) {
      throw new IllegalStateException("题目选项序列化失败", error);
    }
  }

  private static final RowMapper<QuestionRow> QUESTION_MAPPER = (rs, rowNum) -> new QuestionRow(
      rs.getLong("id"),
      rs.getLong("set_id"),
      rs.getInt("seq"),
      rs.getString("type"),
      rs.getString("stem"),
      rs.getString("options"),
      rs.getString("answer"),
      rs.getString("analysis"),
      (Integer) rs.getObject("difficulty", Integer.class),
      rs.getString("knowledge"));

  private static String toIso(Timestamp timestamp) {
    return timestamp == null ? null : Instant.ofEpochMilli(timestamp.getTime()).toString();
  }
}
