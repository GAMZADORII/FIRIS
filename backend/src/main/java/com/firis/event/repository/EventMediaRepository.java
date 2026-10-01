package com.firis.event.repository;
import com.firis.event.entity.EventMedia;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EventMediaRepository extends JpaRepository<EventMedia, Long> {
    Optional<EventMedia> findByEvent_EventId(Long eventId);
}
