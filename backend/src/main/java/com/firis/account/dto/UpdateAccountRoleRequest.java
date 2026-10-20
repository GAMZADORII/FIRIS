package com.firis.account.dto;

import com.firis.account.entity.Role;
import jakarta.validation.constraints.NotNull;

public record UpdateAccountRoleRequest(@NotNull Role role, @NotNull Role expectedRole) {}
