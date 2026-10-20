// FIRIS dev: backend/src/main/java/com/firis/report/service/Mock119Message.java
// These describe the backend contract; they do not open a WebSocket connection.
export const REPORT_MESSAGE_TYPE = 'FIRE_REPORT';
export const REPORT_ACK_TYPE = 'REPORT_ACK';
export const REPORT_ACK_ACCEPTED = 'ACCEPTED';
export const backendDeliveryStatuses = ['PENDING', 'ACCEPTED', 'FAILED'];

export const reportMessageFields = [
  'type', 'requestId', 'eventId', 'cameraId', 'siteAddress', 'detailLocation',
  'specialNotes', 'eventType', 'detectedAt', 'reporterLoginId',
  'reporterName', 'reporterPhone', 'controlRoomPhone',
];

// Existing Backend only exposes these event-scoped endpoints and has no
// center-side list/dispatch/completion endpoints yet.
export const mock119EventPaths = (eventId) => ({
  preview: `/api/events/${eventId}/mock-119-preview`,
  report: `/api/events/${eventId}/mock-119-reports`,
  status: `/api/events/${eventId}/mock-119-report`,
});

export function isFireReportMessage(message) {
  return Boolean(message && message.type === REPORT_MESSAGE_TYPE &&
    typeof message.requestId === 'string' && message.requestId.length > 0 &&
    Number.isInteger(message.eventId) && typeof message.cameraId === 'string');
}
