package com.firis.account.repository;

import com.firis.account.entity.Account;
import com.firis.account.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Collection;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {
    Optional<Account> findByLoginId(String loginId);
    boolean existsByLoginId(String loginId);
    boolean existsByRole(Role role);
    long countByRole(Role role);
    List<Account> findAllByRoleOrderByAccountIdAsc(Role role);
    List<Account> findAllByRoleInOrderByAccountIdAsc(Collection<Role> roles);

    @Query("select a.loginId from Account a where a.loginId like 'W%'")
    List<String> findWorkerLoginIds();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Account a where a.accountId = :id")
    Optional<Account> findForManagement(@Param("id") Long id);
}
