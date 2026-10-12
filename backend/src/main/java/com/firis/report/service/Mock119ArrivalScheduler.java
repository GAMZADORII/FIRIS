package com.firis.report.service;

import com.firis.report.entity.Mock119ResponseStatus;
import com.firis.report.repository.Mock119ReportRepository;
import java.time.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.mock-119.center-enabled", havingValue = "true")
public class Mock119ArrivalScheduler {
    private static final Logger log = LoggerFactory.getLogger(Mock119ArrivalScheduler.class);
    private final Mock119ReportRepository reports;
    private final Mock119CenterService center;
    public Mock119ArrivalScheduler(Mock119ReportRepository reports, Mock119CenterService center) {
        this.reports = reports; this.center = center;
    }
    @Scheduled(fixedDelay = 1000)
    public void updateArrivals() {
        for (var r : reports.findTop100ByResponseStatusAndArrivalAtLessThanEqualOrderByArrivalAtAsc(
                Mock119ResponseStatus.DISPATCHED, LocalDateTime.now(ZoneId.of("Asia/Seoul")))) {
            try { center.arrive(r.getReportId()); }
            catch (RuntimeException e) { log.warn("Mock center arrival update failed for report {}", r.getReportId()); }
        }
    }
}
