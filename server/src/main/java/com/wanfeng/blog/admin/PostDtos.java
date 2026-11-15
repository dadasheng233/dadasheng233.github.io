package com.wanfeng.blog.admin;

import java.util.List;
import java.util.Map;

public final class PostDtos {

  private PostDtos() {
  }

  public record PostSummary(
      String slug,
      String file,
      String title,
      String subtitle,
      String date,
      String updated,
      String category,
      List<String> tags,
      boolean featured,
      long size,
      String path) {
  }

  public record PostDetail(
      String slug,
      String file,
      Map<String, Object> meta,
      String body) {
  }

  public record PostInput(
      String slug,
      String title,
      String subtitle,
      String date,
      String updated,
      String category,
      List<String> tags,
      String cover,
      String coverAlt,
      String excerpt,
      Boolean featured,
      String views,
      Integer reading,
      String body) {
  }

  public record BuildResult(boolean ok, String output, long durationMs) {
  }
}
