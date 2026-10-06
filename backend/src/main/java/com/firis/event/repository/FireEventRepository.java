package com.firis.event.repository;
import com.firis.event.entity.FireEvent;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.repository.query.Param;

public interface FireEventRepository extends JpaRepository<FireEvent, Long>, JpaSpecificationExecutor<FireEvent> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from FireEvent e where e.eventId = :id")
    Optional<FireEvent> findForMediaUpdate(@Param("id") Long id);
}
