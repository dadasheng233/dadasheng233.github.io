package com.wanfeng.blog.common;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<Map<String, Object>> handleApi(ApiException error) {
    return ResponseEntity.status(error.getStatus()).body(Map.of("error", error.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException error) {
    FieldError fieldError = error.getBindingResult().getFieldError();
    String message = fieldError == null ? "请求参数不正确" : fieldError.getDefaultMessage();
    return ResponseEntity.badRequest().body(Map.of("error", message));
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException error) {
    return ResponseEntity.badRequest().body(Map.of("error", "请求体不是合法的 JSON"));
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  public ResponseEntity<Map<String, Object>> handleTooLarge(MaxUploadSizeExceededException error) {
    return ResponseEntity.status(413).body(Map.of("error", "文件太大了"));
  }
}
