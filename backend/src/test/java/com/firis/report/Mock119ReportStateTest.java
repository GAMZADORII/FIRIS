package com.firis.report;

import com.firis.account.entity.Account;
import com.firis.account.repository.AccountRepository;
import com.firis.camera.entity.Camera;
import com.firis.common.exception.ApiException;
import com.firis.event.entity.EventType;
import com.firis.event.entity.FireEvent;
import com.firis.event.repository.FireEventRepository;
import com.firis.report.entity.Mock119Report;
import com.firis.report.repository.Mock119ReportRepository;
import com.firis.report.service.Mock119ReportState;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class Mock119ReportStateTest {
    private final FireEventRepository events = mock(FireEventRepository.class);
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final Mock119ReportRepository reports = mock(Mock119ReportRepository.class);
    private final Mock119ReportState state = new Mock119ReportState(events, accounts, reports);

    @Test
    void messageUsesRegisteredWorkerPhoneAndOneRequestIdPerEvent() {
        var event = new FireEvent(Camera.create("CAM003", "CCTV 03", "창고 A구역", null, "ONLINE"),
                EventType.FIRE, .91, LocalDateTime.of(2026, 10, 8, 14, 2), "yolo", LocalDateTime.now());
        var worker = Account.createWorker("W000001", "hash", "홍길동");
        worker.changePassword("new-hash");
        worker.completeContactOnboarding("01012345678", "v1", LocalDateTime.now());
        when(events.findForMediaUpdate(27L)).thenReturn(Optional.of(event));
        when(accounts.findByLoginId("W000001")).thenReturn(Optional.of(worker));
        when(reports.findByEvent_EventId(27L)).thenReturn(Optional.empty());
        when(reports.saveAndFlush(any(Mock119Report.class))).thenAnswer(call -> {
            var report = call.getArgument(0, Mock119Report.class);
            ReflectionTestUtils.setField(report, "reportId", 12L);
            return report;
        });

        var prepared = state.prepare(27L, "W000001", "02-1234-5678");

        assertThat(prepared.send()).isTrue();
        assertThat(prepared.message().reporterPhone()).isEqualTo("01012345678");
        assertThat(prepared.message().controlRoomPhone()).isEqualTo("0212345678");
        assertThat(prepared.message().cameraId()).isEqualTo("CAM003");
        assertThat(prepared.message().requestId()).isNotBlank();
    }

    @Test
    void workerWithoutContactConsentCannotReport() {
        var event = mock(FireEvent.class);
        var worker = Account.createWorker("W000001", "hash", "작업자");
        worker.changePassword("new-hash");
        when(events.findForMediaUpdate(27L)).thenReturn(Optional.of(event));
        when(accounts.findByLoginId("W000001")).thenReturn(Optional.of(worker));

        assertThatThrownBy(() -> state.prepare(27L, "W000001", "0212345678"))
                .isInstanceOf(ApiException.class);
        verify(reports, never()).saveAndFlush(any());
    }
}
