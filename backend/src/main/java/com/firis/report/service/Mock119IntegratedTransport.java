package com.firis.report.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.mock-119.delivery-mode", havingValue = "integrated")
public class Mock119IntegratedTransport implements Mock119Transport {
    private final Mock119CenterService center;
    private final boolean enabled;
    public Mock119IntegratedTransport(Mock119CenterService center,
            @Value("${app.mock-119.center-enabled:false}") boolean enabled) {
        this.center = center; this.enabled = enabled;
    }
    @Override public String sendAndAwaitReceipt(Mock119Message message) {
        if (!enabled) throw new Mock119DeliveryException("통합 모의 접수센터가 비활성화되어 있습니다.");
        return center.register(message.requestId());
    }
}
