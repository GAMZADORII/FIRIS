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
import com.firis.report.service.Mock119Settings;
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
    private final Mock119ReportState state = new Mock119ReportState(events, accounts, reports,
            new Mock119Settings("경기도 ○○시 ○○로 123", "041-123-4567"));

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

        var prepared = state.prepare(27L, "W000001");

        assertThat(prepared.send()).isTrue();
        assertThat(prepared.message().reporterPhone()).isEqualTo("01012345678");
        assertThat(prepared.message().controlRoomPhone()).isEqualTo("0411234567");
        assertThat(prepared.message().siteAddress()).isEqualTo("경기도 ○○시 ○○로 123");
        assertThat(prepared.message().detailLocation()).isEqualTo("창고 A구역");
        assertThat(prepared.message().cameraId()).isEqualTo("CAM003");
        assertThat(prepared.message().requestId()).isNotBlank();
    }

    @Test
    void workerWithoutPhoneCanReport() {
        var event = new FireEvent(Camera.create("CAM003", "CCTV 03", null, null, "ONLINE"),
                EventType.FIRE, .91, LocalDateTime.now(), "test", LocalDateTime.now());
        var worker = Account.createWorker("W000001", "hash", "작업자");
        worker.changePassword("new-hash");
        when(events.findForMediaUpdate(27L)).thenReturn(Optional.of(event));
        when(accounts.findByLoginId("W000001")).thenReturn(Optional.of(worker));
        var prepared = state.prepare(27L, "W000001");
        assertThat(prepared.send()).isTrue();
        assertThat(prepared.message().reporterPhone()).isEmpty();
        assertThat(prepared.message().detailLocation()).isNull();
    }

    @Test
    void previewShowsServerAndCameraDataWithoutCreatingReport() {
        var camera = Camera.create("CAM003", "CCTV 03", "제1공장 2층 생산라인 A",
                null, "ONLINE", "리튬배터리 보관구역");
        var event = new FireEvent(camera, EventType.FIRE, .91,
                LocalDateTime.of(2026, 10, 7, 14, 32, 18), "yolo", LocalDateTime.now());
        var worker = Account.createWorker("W000001", "hash", "홍길동");
        worker.changePassword("new-hash");
        worker.completeContactOnboarding("01012345678", "v1", LocalDateTime.now());
        when(events.findById(27L)).thenReturn(Optional.of(event));
        when(accounts.findByLoginId("W000001")).thenReturn(Optional.of(worker));

        var preview = state.preview(27L, "W000001");

        assertThat(preview.readyToReport()).isTrue();
        assertThat(preview.siteAddress()).isEqualTo("경기도 ○○시 ○○로 123");
        assertThat(preview.specialNotes()).isEqualTo("리튬배터리 보관구역");
        assertThat(preview.reporterPhone()).isEqualTo("01012345678");
        verifyNoInteractions(reports);
    }

    @Test
    void adminCanSubmitWithAllOptionalContactAndAddressFieldsEmpty() {
        var noSettings = new Mock119ReportState(events, accounts, reports, new Mock119Settings("", ""));
        var event = new FireEvent(Camera.create("CAM003", "CCTV 03", null, null, "ONLINE"),
                EventType.FIRE, .91, LocalDateTime.now(), "test", LocalDateTime.now());
        var admin = Account.createAdmin("report-admin", "hash", "관리자");
        when(events.findById(27L)).thenReturn(Optional.of(event));
        when(events.findForMediaUpdate(27L)).thenReturn(Optional.of(event));
        when(accounts.findByLoginId("report-admin")).thenReturn(Optional.of(admin));
        var preview = noSettings.preview(27L, "report-admin");
        assertThat(preview.readyToReport()).isTrue();
        assertThat(preview.missingFields()).isEmpty();
        var message = noSettings.prepare(27L, "report-admin").message();
        assertThat(message.siteAddress()).isEmpty();
        assertThat(message.reporterPhone()).isEmpty();
        assertThat(message.controlRoomPhone()).isEmpty();
    }

    @Test
    void suppliedInvalidPhoneIsRejectedInsteadOfStored() {
        var invalid = new Mock119ReportState(events, accounts, reports, new Mock119Settings("", "not-a-phone"));
        var event = new FireEvent(Camera.create("CAM003", "CCTV 03", null, null, "ONLINE"),
                EventType.FIRE, .91, LocalDateTime.now(), "test", LocalDateTime.now());
        var admin = Account.createAdmin("report-admin", "hash", "관리자");
        when(events.findById(27L)).thenReturn(Optional.of(event));
        when(events.findForMediaUpdate(27L)).thenReturn(Optional.of(event));
        when(accounts.findByLoginId("report-admin")).thenReturn(Optional.of(admin));
        assertThat(invalid.preview(27L, "report-admin").readyToReport()).isFalse();
        assertThatThrownBy(() -> invalid.prepare(27L, "report-admin")).isInstanceOf(ApiException.class);
        verify(reports, never()).saveAndFlush(any());
    }

    @Test
    void retryKeepsOriginalReportDetailsAndRequestId() {
        var camera = Camera.create("CAM003", "CCTV 03", "현재 위치", null, "ONLINE");
        var event = new FireEvent(camera, EventType.FIRE, .91,
                LocalDateTime.now(), "yolo", LocalDateTime.now());
        var worker = Account.createWorker("W000001", "hash", "홍길동");
        worker.changePassword("new-hash");
        worker.completeContactOnboarding("01012345678", "v1", LocalDateTime.now());
        var previous = new Mock119Report(event, worker, "same-request-id", "01012345678",
                "0411234567", "이전 주소", "이전 상세위치", "이전 특이사항");
        ReflectionTestUtils.setField(previous, "reportId", 12L);
        previous.fail("연결 실패");
        when(events.findForMediaUpdate(27L)).thenReturn(Optional.of(event));
        when(accounts.findByLoginId("W000001")).thenReturn(Optional.of(worker));
        when(reports.findByEvent_EventId(27L)).thenReturn(Optional.of(previous));
        when(reports.saveAndFlush(previous)).thenReturn(previous);

        var prepared = state.prepare(27L, "W000001");

        assertThat(prepared.message().requestId()).isEqualTo("same-request-id");
        assertThat(prepared.message().siteAddress()).isEqualTo("이전 주소");
        assertThat(prepared.message().detailLocation()).isEqualTo("이전 상세위치");
        assertThat(prepared.message().specialNotes()).isEqualTo("이전 특이사항");
    }

    @Test
    void activeAdminCanPreviewAndSubmitWithoutWorkerRole() {
        var event = new FireEvent(Camera.create("CAM001", "CCTV 01", "공장 A구역", null, "ONLINE"),
                EventType.FIRE, .95, LocalDateTime.now(), "test", LocalDateTime.now());
        var admin = Account.createAdmin("report-admin", "hash", "관리자");
        ReflectionTestUtils.setField(admin, "contactPhone", "01012345678");
        when(events.findById(27L)).thenReturn(Optional.of(event));
        when(events.findForMediaUpdate(27L)).thenReturn(Optional.of(event));
        when(accounts.findByLoginId("report-admin")).thenReturn(Optional.of(admin));
        when(reports.findByEvent_EventId(27L)).thenReturn(Optional.empty());
        when(reports.saveAndFlush(any(Mock119Report.class))).thenAnswer(call -> {
            var report = call.getArgument(0, Mock119Report.class);
            ReflectionTestUtils.setField(report, "reportId", 12L);
            return report;
        });
        assertThat(state.preview(27L, "report-admin").readyToReport()).isTrue();
        assertThat(state.prepare(27L, "report-admin").message().reporterLoginId()).isEqualTo("report-admin");
    }

    @Test
    void inactiveAdminStillCannotPreviewOrSubmit() {
        var admin = Account.createAdmin("report-admin", "hash", "관리자");
        admin.changeStatus(com.firis.account.entity.AccountStatus.INACTIVE);
        when(events.findById(27L)).thenReturn(Optional.of(mock(FireEvent.class)));
        when(events.findForMediaUpdate(27L)).thenReturn(Optional.of(mock(FireEvent.class)));
        when(accounts.findByLoginId("report-admin")).thenReturn(Optional.of(admin));
        assertThatThrownBy(() -> state.preview(27L, "report-admin")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> state.prepare(27L, "report-admin")).isInstanceOf(ApiException.class);
        verifyNoInteractions(reports);
    }
}
