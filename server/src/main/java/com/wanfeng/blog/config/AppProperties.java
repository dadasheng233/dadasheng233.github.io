package com.wanfeng.blog.config;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 后端运行期配置。目录类配置都做了「启动目录不同也能找到」的兜底：
 * 依次尝试配置值、public/ 或 content/、../public 或 ../content。
 */
@ConfigurationProperties(prefix = "app")
public class AppProperties {

  private String publicDir = "../public";
  private String contentDir = "../content";
  private String siteDir = "..";
  private String nodeCommand = "node";
  private int buildTimeoutSeconds = 180;
  private Admin admin = new Admin();
  private Cors cors = new Cors();

  public Path publicPath() {
    return firstExisting(publicDir, "public", "../public");
  }

  public Path contentPath() {
    return firstExisting(contentDir, "content", "../content");
  }

  public Path sitePath() {
    for (String candidate : new String[] {siteDir, ".", ".."}) {
      Path path = Paths.get(candidate).toAbsolutePath().normalize();
      if (Files.isRegularFile(path.resolve("build.mjs"))) {
        return path;
      }
    }
    return Paths.get(siteDir).toAbsolutePath().normalize();
  }

  private Path firstExisting(String... candidates) {
    for (String candidate : candidates) {
      Path path = Paths.get(candidate).toAbsolutePath().normalize();
      if (Files.isDirectory(path)) {
        return path;
      }
    }
    return Paths.get(candidates[0]).toAbsolutePath().normalize();
  }

  public String getPublicDir() {
    return publicDir;
  }

  public void setPublicDir(String publicDir) {
    this.publicDir = publicDir;
  }

  public String getContentDir() {
    return contentDir;
  }

  public void setContentDir(String contentDir) {
    this.contentDir = contentDir;
  }

  public String getSiteDir() {
    return siteDir;
  }

  public void setSiteDir(String siteDir) {
    this.siteDir = siteDir;
  }

  public String getNodeCommand() {
    return nodeCommand;
  }

  public void setNodeCommand(String nodeCommand) {
    this.nodeCommand = nodeCommand;
  }

  public int getBuildTimeoutSeconds() {
    return buildTimeoutSeconds;
  }

  public void setBuildTimeoutSeconds(int buildTimeoutSeconds) {
    this.buildTimeoutSeconds = buildTimeoutSeconds;
  }

  public Admin getAdmin() {
    return admin;
  }

  public void setAdmin(Admin admin) {
    this.admin = admin;
  }

  public Cors getCors() {
    return cors;
  }

  public void setCors(Cors cors) {
    this.cors = cors;
  }

  public static class Admin {
    private String username = "admin";
    private String password = "wanfeng-408";
    private String displayName = "站长";

    public String getUsername() {
      return username;
    }

    public void setUsername(String username) {
      this.username = username;
    }

    public String getPassword() {
      return password;
    }

    public void setPassword(String password) {
      this.password = password;
    }

    public String getDisplayName() {
      return displayName;
    }

    public void setDisplayName(String displayName) {
      this.displayName = displayName;
    }
  }

  public static class Cors {
    private List<String> allowedOrigins = new ArrayList<>();

    public List<String> getAllowedOrigins() {
      return allowedOrigins;
    }

    public void setAllowedOrigins(List<String> allowedOrigins) {
      this.allowedOrigins = allowedOrigins;
    }
  }
}
