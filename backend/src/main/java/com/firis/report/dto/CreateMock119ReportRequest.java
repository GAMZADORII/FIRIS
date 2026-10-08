package com.firis.report.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateMock119ReportRequest(
        @NotBlank(message = "관제실 번호를 입력해주세요.")
        @Size(max = 20, message = "관제실 번호는 20자 이하여야 합니다.")
        @Pattern(regexp = "^0\\d{1,2}-?\\d{3,4}-?\\d{4}$", message = "올바른 관제실 번호를 입력해주세요.")
        String controlRoomPhone
) {
}
