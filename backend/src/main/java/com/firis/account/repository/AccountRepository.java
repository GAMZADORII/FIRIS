package com.firis.account.repository;

import com.firis.account.entity.Account;
import com.firis.account.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {
    Optional<Account> findByLoginId(String loginId);
    boolean existsByLoginId(String loginId);
    boolean existsByRole(Role role);
    List<Account> findAllByRoleOrderByAccountIdAsc(Role role);
}
