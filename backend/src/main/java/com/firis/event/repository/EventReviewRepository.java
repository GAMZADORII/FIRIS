package com.firis.event.repository;

import com.firis.event.entity.EventReview;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventReviewRepository extends JpaRepository<EventReview, Long> {
    Optional<EventReview> findByEvent_EventId(Long eventId);
    boolean existsByEvent_EventId(Long eventId);
    List<EventReview> findByEvent_EventIdIn(Collection<Long> eventIds);
}
