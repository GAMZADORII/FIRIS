package com.firis.report.service;

import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import com.firis.report.dto.Mock119ReportResponse;
import com.firis.report.dto.Mock119PreviewResponse;
import org.springframework.stereotype.Service;

@Service
public class Mock119ReportService {
    private final Mock119ReportState state;
    private final Mock119Transport transport;

    public Mock119ReportService(Mock119ReportState state, Mock119Transport transport) {
        this.state = state;
        this.transport = transport;
    }

    public Mock119PreviewResponse preview(Long eventId, String loginId) {
        return state.preview(eventId, loginId);
    }

    public Mock119ReportResponse report(Long eventId, String loginId) {
        var prepared = state.prepare(eventId, loginId);
        if (!prepared.send()) return state.byId(prepared.reportId());
        try {
            String receiptId = transport.sendAndAwaitReceipt(prepared.message());
            state.accepted(prepared.reportId(), receiptId);
            return state.byId(prepared.reportId());
        } catch (Mock119DeliveryException error) {
            state.failed(prepared.reportId(), error.getMessage());
            throw new ApiException(ErrorCode.MOCK_119_DELIVERY_FAILED);
        }
    }

    public Mock119ReportResponse status(Long eventId) {
        return state.byEventId(eventId);
    }
}
