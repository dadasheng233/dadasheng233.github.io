package com.wanfeng.blog.config;

import java.io.IOException;
import java.nio.file.Path;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

@Configuration
public class WebConfig implements WebMvcConfigurer {

  private final AppProperties properties;

  public WebConfig(AppProperties properties) {
    this.properties = properties;
  }

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    Path publicDir = properties.publicPath();
    registry.addResourceHandler("/**")
        .addResourceLocations(publicDir.toUri().toString())
        .setCachePeriod(0)
        .resourceChain(false)
        .addResolver(new HtmlFallbackResolver());
  }

  /** 静态站原来是 serve.mjs 在做「/archives → archives.html」的补全，这里保持同样的行为。 */
  private static final class HtmlFallbackResolver extends PathResourceResolver {

    @Override
    protected Resource getResource(String resourcePath, Resource location) throws IOException {
      Resource direct = super.getResource(resourcePath, location);
      if (direct != null && direct.exists()) {
        return direct;
      }
      if (resourcePath.isEmpty() || resourcePath.endsWith("/")) {
        Resource index = super.getResource(resourcePath + "index.html", location);
        return index != null && index.exists() ? index : null;
      }
      if (!resourcePath.contains(".")) {
        Resource html = super.getResource(resourcePath + ".html", location);
        if (html != null && html.exists()) {
          return html;
        }
      }
      return null;
    }
  }
}
