package com.firis.common.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다."),
    ACCOUNT_INACTIVE(HttpStatus.FORBIDDEN, "비활성화된 계정입니다. 관리자에게 문의해 주세요."),
    PASSWORD_CHANGE_REQUIRED(HttpStatus.FORBIDDEN, "최초 로그인 비밀번호 변경이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "해당 기능에 접근할 권한이 없습니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    INVALID_CURRENT_PASSWORD(HttpStatus.BAD_REQUEST, "현재 비밀번호가 일치하지 않습니다."),
    SAME_PASSWORD(HttpStatus.BAD_REQUEST, "새 비밀번호는 현재 비밀번호와 다르게 입력해주세요."),
    WORKER_NOT_FOUND(HttpStatus.NOT_FOUND, "작업자를 찾을 수 없습니다."),
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "요청한 파일을 찾을 수 없습니다."),
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "요청 값을 확인해주세요."),
    CAMERA_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 등록된 카메라 ID입니다."),
    EVENT_NOT_FOUND(HttpStatus.NOT_FOUND, "이벤트를 찾을 수 없습니다."),
    EVENT_ALREADY_REVIEWED(HttpStatus.CONFLICT, "이미 검수된 이벤트입니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다.");

    private final HttpStatus status;
    private final String message;

    ErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public HttpStatus getStatus() { return status; }
    public String getMessage() { return message; }
}
