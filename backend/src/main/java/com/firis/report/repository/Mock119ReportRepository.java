package com.firis.report.repository;

import com.firis.report.entity.Mock119Report;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface Mock119ReportRepository extends JpaRepository<Mock119Report, Long> {
    Optional<Mock119Report> findByEvent_EventId(Long eventId);
}
