package com.firis.event.exception;

import com.firis.event.controller.AiEventController;
import java.util.Map;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Order(0)
@RestControllerAdvice(assignableTypes = AiEventController.class)
public class AiEventExceptionHandler {
    @ExceptionHandler(AiEventException.class)
    public ResponseEntity<Map<String, String>> handle(AiEventException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of("code", ex.getCode(), "message", ex.getMessage()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
        MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, String>> invalid(Exception ex) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST", "message", "요청 값이 올바르지 않습니다."));
    }
}
