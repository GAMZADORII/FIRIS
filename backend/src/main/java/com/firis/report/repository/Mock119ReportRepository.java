package com.firis.report.repository;

import com.firis.report.entity.Mock119Report;
import java.util.Optional;
import java.util.List;
import java.time.LocalDateTime;
import com.firis.report.entity.Mock119ResponseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface Mock119ReportRepository extends JpaRepository<Mock119Report, Long> {
    Optional<Mock119Report> findByEvent_EventId(Long eventId);
    Optional<Mock119Report> findByRequestId(String requestId);
    Page<Mock119Report> findByResponseStatusIsNotNull(Pageable pageable);
    List<Mock119Report> findTop100ByResponseStatusAndArrivalAtLessThanEqualOrderByArrivalAtAsc(
            Mock119ResponseStatus status, LocalDateTime at);
}
