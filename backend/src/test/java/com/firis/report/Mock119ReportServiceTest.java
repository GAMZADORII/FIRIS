package com.firis.report;

import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import com.firis.report.dto.Mock119ReportResponse;
import com.firis.report.entity.Mock119ReportStatus;
import com.firis.report.service.Mock119DeliveryException;
import com.firis.report.service.Mock119Message;
import com.firis.report.service.Mock119ReportService;
import com.firis.report.service.Mock119ReportState;
import com.firis.report.service.Mock119Transport;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class Mock119ReportServiceTest {
    private final Mock119ReportState state = mock(Mock119ReportState.class);
    private final Mock119Transport transport = mock(Mock119Transport.class);
    private final Mock119ReportService service = new Mock119ReportService(state, transport);

    @Test
    void confirmsReportOnlyAfterMatchingMockServerReceipt() {
        var message = mock(Mock119Message.class);
        when(state.prepare(27L, "W000001", "0212345678"))
                .thenReturn(new Mock119ReportState.Prepared(12L, true, message));
        when(transport.sendAndAwaitReceipt(message)).thenReturn("MOCK-119-001");
        when(state.byId(12L)).thenReturn(new Mock119ReportResponse(
                12L, 27L, Mock119ReportStatus.ACCEPTED, "MOCK-119-001"));

        var result = service.report(27L, "W000001", "0212345678");

        verify(state).accepted(12L, "MOCK-119-001");
        assertThat(result.status()).isEqualTo(Mock119ReportStatus.ACCEPTED);
        assertThat(result.receiptId()).isEqualTo("MOCK-119-001");
    }

    @Test
    void failedWebSocketDeliveryIsRecordedAndCannotLookAccepted() {
        var message = mock(Mock119Message.class);
        when(state.prepare(27L, "W000001", "0212345678"))
                .thenReturn(new Mock119ReportState.Prepared(12L, true, message));
        when(transport.sendAndAwaitReceipt(message))
                .thenThrow(new Mock119DeliveryException("모의서버 응답 없음"));

        assertThatThrownBy(() -> service.report(27L, "W000001", "0212345678"))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).getErrorCode())
                .isEqualTo(ErrorCode.MOCK_119_DELIVERY_FAILED);
        verify(state).failed(12L, "모의서버 응답 없음");
        verify(state, never()).accepted(anyLong(), anyString());
    }

    @Test
    void pendingOrAcceptedReportDoesNotSendAgain() {
        when(state.prepare(27L, "W000001", "0212345678"))
                .thenReturn(new Mock119ReportState.Prepared(12L, false, null));
        when(state.byId(12L)).thenReturn(new Mock119ReportResponse(
                12L, 27L, Mock119ReportStatus.PENDING, null));

        assertThat(service.report(27L, "W000001", "0212345678").status())
                .isEqualTo(Mock119ReportStatus.PENDING);
        verifyNoInteractions(transport);
    }
}
