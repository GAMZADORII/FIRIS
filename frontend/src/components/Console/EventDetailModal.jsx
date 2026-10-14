import { useEffect, useState } from 'react';
import { apiClient, apiError, fetchMedia } from '../../api/client.js';
import { Badge, Modal } from './Console.jsx';
import { cameraDisplayName } from '../../utils/cameraChannels.js';
import '../../pages/History/History.css';
import './EventDetailModal.css';

const reasons = { STEAM: '수증기', LIGHT: '빛', REFLECTION: '반사', DUST: '먼지', WELDING: '용접', ETC: '기타' };
const date = (value) => value?.replace('T', ' ') || '—';

export function ReviewInformation({ review }) {
  if (!review) return null;
  return <section className="event-review-information" aria-label="검수 정보">
    <h3>검수 정보</h3><dl>
      <div><dt>검수 결과</dt><dd>{review.result === 'FALSE_POSITIVE' ? '오탐' : '실화재'}</dd></div>
      <div><dt>오탐 사유</dt><dd>{reasons[review.falsePositiveReason] || '해당 없음'}</dd></div>
      <div><dt>검수자</dt><dd>{review.reviewerName || '미기록'}</dd></div>
      <div><dt>검수 시각</dt><dd>{date(review.reviewedAt)}</dd></div>
      <div className="event-review-information__note"><dt>검수 메모</dt><dd>{review.note || '없음'}</dd></div>
    </dl>
  </section>;
}

export default function EventDetailModal({ eventId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [video, setVideo] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [error, setError] = useState('');
  const [mediaError, setMediaError] = useState('');
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    const urls = [];
    setDetail(null); setSnapshot(null); setVideo(null); setShowVideo(false); setError(''); setMediaError('');
    async function load() {
      try {
        const { data } = await apiClient.get(`/api/events/${eventId}`, { signal: abort.signal });
        if (!active) return;
        setDetail(data); setLoadingMedia(true);
        const results = await Promise.allSettled([
          data.snapshotPath ? fetchMedia(`/api/events/${eventId}/snapshot`, abort.signal) : Promise.resolve(null),
          data.videoPath ? fetchMedia(`/api/events/${eventId}/video/annotated`, abort.signal)
            .catch((cause) => cause.response?.status === 404 ? fetchMedia(`/api/events/${eventId}/video`, abort.signal) : Promise.reject(cause)) : Promise.resolve(null),
        ]);
        results.forEach((result) => { if (result.status === 'fulfilled' && result.value) urls.push(result.value); });
        if (!active) { urls.forEach(URL.revokeObjectURL); return; }
        setSnapshot(results[0].status === 'fulfilled' ? results[0].value : null);
        setVideo(results[1].status === 'fulfilled' ? results[1].value : null);
        if (results.some((result) => result.status === 'rejected')) setMediaError('일부 미디어를 불러오지 못했습니다.');
        setLoadingMedia(false);
      } catch (cause) { if (active) { setError(apiError(cause)); setLoadingMedia(false); } }
    }
    load();
    return () => { active = false; abort.abort(); urls.forEach(URL.revokeObjectURL); };
  }, [eventId]);
  return <Modal wide title="오탐 이벤트 상세" subtitle={`FIRIS EVENT REVIEW / EVT-${eventId}`} onClose={onClose}>
    <div className="console-modal__body">
      {error && <p role="alert" className="console-notice">{error}</p>}
      {!detail && !error && <p role="status">이벤트 정보를 불러오는 중입니다.</p>}
      {detail && <>
        <div className="history-report-meta"><span>영상 및 스냅샷 확인</span><span>{cameraDisplayName(detail.cameraId, detail.cameraName)} / {date(detail.detectedAt)}</span></div>
        <div className="history-report-grid">
          <div className="history-capture">
            {showVideo && video ? <video src={video} controls playsInline aria-label="이벤트 영상" /> : snapshot ? <img src={snapshot} alt={`${detail.location || ''} 이벤트 스냅샷`} /> : <p>{loadingMedia ? '미디어를 불러오는 중입니다.' : '등록된 스냅샷이 없습니다.'}</p>}
            <small>{detail.location}</small>
            {video && <button type="button" className="history-capture__media-toggle" onClick={() => setShowVideo((value) => !value)}>{showVideo ? '캡처 보기' : '이벤트 영상 보기'}</button>}
          </div>
          <div className="history-telemetry"><p>AI 탐지 정보</p><div className="history-metrics"><div><span>AI 분석 신뢰도</span><strong>{(detail.confidence * 100).toFixed(1)}%</strong></div><div><span>모델 버전</span><strong>{detail.modelVersion || '미기록'}</strong></div></div><div className="history-assignee"><Badge tone="green">오탐 검수 완료</Badge></div>{!loadingMedia && !video && <p className="console-muted">등록된 이벤트 영상이 없습니다.</p>}</div>
        </div>
        {mediaError && <p role="alert" className="console-notice">{mediaError}</p>}
        <ReviewInformation review={detail.review} />
        {detail.review?.trainingCandidate && <p className="console-muted">이 오탐 이벤트는 학습후보로 자동 저장되었습니다.</p>}
      </>}
    </div><footer className="console-modal__footer"><button onClick={onClose}>창 닫기</button></footer>
  </Modal>;
}