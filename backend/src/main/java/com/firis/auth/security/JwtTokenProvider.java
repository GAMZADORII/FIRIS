package com.firis.auth.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.firis.account.entity.Account;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class JwtTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenProvider.class);
    private static final Base64.Encoder BASE64_URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder BASE64_URL_DECODER = Base64.getUrlDecoder();

    private final ObjectMapper objectMapper;
    private final byte[] secret;
    private final long expirationSeconds;

    public JwtTokenProvider(
            ObjectMapper objectMapper,
            @Value("${security.jwt.secret}") String secret,
            @Value("${security.jwt.expiration-seconds:3600}") long expirationSeconds
    ) {
        this.objectMapper = objectMapper;
        if (secret == null || secret.isBlank()) {
            byte[] generatedSecret = new byte[32];
            new SecureRandom().nextBytes(generatedSecret);
            this.secret = generatedSecret;
            log.warn("JWT_SECRET이 설정되지 않아 이번 실행에서만 사용할 임시 랜덤 키를 생성했습니다. 실제 운영/통합 환경에서는 JWT_SECRET을 반드시 설정하세요.");
        } else {
            byte[] configuredSecret = secret.getBytes(StandardCharsets.UTF_8);
            if (configuredSecret.length < 32) {
                throw new IllegalArgumentException("JWT secret은 최소 32바이트 이상이어야 합니다.");
            }
            this.secret = configuredSecret;
        }
        this.expirationSeconds = expirationSeconds;
    }

    public String generateToken(Account account) {
        try {
            long now = Instant.now().getEpochSecond();

            Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT");
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("sub", account.getLoginId());
            payload.put("accountId", account.getAccountId());
            payload.put("role", account.getRole().name());
            payload.put("iat", now);
            payload.put("exp", now + expirationSeconds);

            String encodedHeader = encodeJson(header);
            String encodedPayload = encodeJson(payload);
            String signingInput = encodedHeader + "." + encodedPayload;
            return signingInput + "." + sign(signingInput);
        } catch (Exception e) {
            throw new IllegalStateException("JWT 생성에 실패했습니다.", e);
        }
    }

    public ValidationResult validate(String token) {
        try {
            parseAndValidate(token);
            return ValidationResult.VALID;
        } catch (JwtExpiredException e) {
            return ValidationResult.EXPIRED;
        } catch (Exception e) {
            return ValidationResult.INVALID;
        }
    }

    public String getLoginId(String token) {
        Map<String, Object> claims = parseAndValidate(token);
        Object subject = claims.get("sub");
        if (!(subject instanceof String loginId) || loginId.isBlank()) {
            throw new IllegalArgumentException("JWT subject가 올바르지 않습니다.");
        }
        return loginId;
    }

    private Map<String, Object> parseAndValidate(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                throw new IllegalArgumentException("잘못된 JWT 형식입니다.");
            }

            String signingInput = parts[0] + "." + parts[1];
            byte[] expected = BASE64_URL_DECODER.decode(sign(signingInput));
            byte[] actual = BASE64_URL_DECODER.decode(parts[2]);
            if (!MessageDigest.isEqual(expected, actual)) {
                throw new IllegalArgumentException("JWT 서명이 올바르지 않습니다.");
            }

            byte[] payloadBytes = BASE64_URL_DECODER.decode(parts[1]);
            Map<String, Object> claims = objectMapper.readValue(payloadBytes, new TypeReference<>() {});
            Object exp = claims.get("exp");
            if (!(exp instanceof Number number) || Instant.now().getEpochSecond() >= number.longValue()) {
                throw new JwtExpiredException();
            }
            return claims;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("JWT 검증에 실패했습니다.", e);
        }
    }

    private String encodeJson(Map<String, Object> value) throws Exception {
        return BASE64_URL_ENCODER.encodeToString(objectMapper.writeValueAsBytes(value));
    }

    private String sign(String input) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret, "HmacSHA256"));
        return BASE64_URL_ENCODER.encodeToString(mac.doFinal(input.getBytes(StandardCharsets.UTF_8)));
    }

    public enum ValidationResult {
        VALID,
        EXPIRED,
        INVALID
    }

    private static final class JwtExpiredException extends IllegalArgumentException {
    }
}
