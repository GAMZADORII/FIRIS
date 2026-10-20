package com.firis.auth.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CompleteContactOnboardingRequest(
        @NotBlank(message = "연락처를 입력해주세요.")
        @Size(max = 20, message = "연락처는 20자 이하여야 합니다.")
        @Pattern(regexp = "^0\\d{1,2}-?\\d{3,4}-?\\d{4}$", message = "올바른 연락처를 입력해주세요.")
        String contactPhone,

        @NotNull(message = "개인정보 수집·이용 동의가 필요합니다.")
        @AssertTrue(message = "개인정보 수집·이용 동의가 필요합니다.")
        Boolean consentAccepted,

        @NotBlank(message = "동의 문안 버전을 확인해주세요.")
        String consentVersion
) {
}
