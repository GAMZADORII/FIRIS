package com.firis.event.repository;

import com.firis.event.entity.EventReview;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface EventReviewRepository extends JpaRepository<EventReview, Long> {
    Optional<EventReview> findByEvent_EventId(Long eventId);
    boolean existsByEvent_EventId(Long eventId);
    List<EventReview> findByEvent_EventIdIn(Collection<Long> eventIds);
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update EventReview r set r.trainingCandidate = true where r.result = com.firis.event.entity.ReviewResult.FALSE_POSITIVE and r.trainingCandidate = false")
    int includeExistingFalsePositives();
}
