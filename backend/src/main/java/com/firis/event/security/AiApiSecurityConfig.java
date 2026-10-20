package com.firis.event.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class AiApiSecurityConfig {
    @Bean
    @Order(1)
    SecurityFilterChain aiSecurityFilterChain(HttpSecurity http, ObjectMapper mapper,
            @Value("${AI_API_KEY:}") String apiKey) throws Exception {
        // Instantiate here, not as a servlet Filter bean: only this chain may run it.
        var keyFilter = new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                    FilterChain chain) throws ServletException, IOException {
                var supplied = request.getHeader("X-AI-API-KEY");
                if (apiKey.isBlank() || supplied == null || !MessageDigest.isEqual(
                        apiKey.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8))) {
                    response.setStatus(401);
                    response.setContentType("application/json");
                    response.setCharacterEncoding("UTF-8");
                    mapper.writeValue(response.getWriter(), Map.of("code", "UNAUTHORIZED", "message", "AI 인증이 필요합니다."));
                    return;
                }
                chain.doFilter(request, response);
            }
        };
        return http.securityMatcher("/api/ai/**")
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.POST, "/api/ai/events").permitAll()
                .requestMatchers(HttpMethod.PATCH, "/api/ai/events/*/media").permitAll()
                .anyRequest().denyAll())
            .addFilterBefore(keyFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
