package com.wanfeng.blog.question;

import java.util.Map;

public final class Subjects {

  public static final Map<String, String> LABELS = Map.of(
      "ds", "数据结构",
      "co", "计算机组成原理",
      "os", "操作系统",
      "cn", "计算机网络");

  private Subjects() {
  }

  public static boolean valid(String code) {
    return code != null && LABELS.containsKey(code);
  }

  public static String label(String code) {
    return LABELS.getOrDefault(code, code == null ? "未知" : code);
  }
}
