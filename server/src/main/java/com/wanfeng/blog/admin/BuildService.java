package com.wanfeng.blog.admin;

import com.wanfeng.blog.common.ApiException;
import com.wanfeng.blog.config.AppProperties;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** 调用项目自带的 node build.mjs，把后台保存的文章重新生成到 public/。 */
@Service
public class BuildService {

  private static final Logger log = LoggerFactory.getLogger(BuildService.class);
  private static final int MAX_OUTPUT_CHARS = 20000;

  private final AppProperties properties;
  private final ReentrantLock lock = new ReentrantLock();

  public BuildService(AppProperties properties) {
    this.properties = properties;
  }

  public PostDtos.BuildResult build() {
    if (!lock.tryLock()) {
      throw ApiException.conflict("已经有一个构建在运行了，请等它结束");
    }
    long startedAt = System.currentTimeMillis();
    try {
      String node = properties.getNodeCommand();
      ProcessBuilder builder = new ProcessBuilder(node, "build.mjs");
      builder.directory(properties.sitePath().toFile());
      builder.redirectErrorStream(true);
      Process process = builder.start();

      ByteArrayOutputStream buffer = new ByteArrayOutputStream();
      Thread reader = new Thread(() -> {
        try (InputStream input = process.getInputStream()) {
          input.transferTo(buffer);
        } catch (IOException error) {
          log.debug("读取构建输出失败", error);
        }
      }, "blog-build-reader");
      reader.setDaemon(true);
      reader.start();

      int timeout = Math.max(10, properties.getBuildTimeoutSeconds());
      boolean finished = process.waitFor(timeout, TimeUnit.SECONDS);
      if (!finished) {
        process.destroyForcibly();
        reader.join(2000);
        long duration = System.currentTimeMillis() - startedAt;
        return new PostDtos.BuildResult(false,
            "构建超时（" + timeout + " 秒），已强制结束。请检查终端里的 node build.mjs。", duration);
      }
      reader.join(3000);

      String output = buffer.toString(StandardCharsets.UTF_8);
      if (output.length() > MAX_OUTPUT_CHARS) {
        output = output.substring(output.length() - MAX_OUTPUT_CHARS);
      }
      long duration = System.currentTimeMillis() - startedAt;
      boolean ok = process.exitValue() == 0;
      log.info("build.mjs finished, exit={}, {}ms", process.exitValue(), duration);
      return new PostDtos.BuildResult(ok, output, duration);
    } catch (IOException error) {
      throw new IllegalStateException("启动构建失败，确认 node 已安装并且在 PATH 里", error);
    } catch (InterruptedException error) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("构建被中断", error);
    } finally {
      lock.unlock();
    }
  }
}
