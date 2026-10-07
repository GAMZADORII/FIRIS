import { useEffect, useState } from 'react';
import { apiClient, apiError } from '../../api/client.js';
import { Badge, Modal, PageHeading } from '../../components/Console/Console.jsx';
import './Admin.css';

const MEMBERS_PAGE_SIZE = 4;
const CAMERAS_PAGE_SIZE = 4;
const reasonName = { STEAM: '수증기', LIGHT: '빛', REFLECTION: '반사', DUST: '먼지', WELDING: '용접', ETC: '기타' };
const tabs = [
  ['members', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M20 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75', '회원 관리'],
  ['cameras', 'M4 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M16 9l6-3v12l-6-3', 'CCTV 관리'],
  ['reviews', 'M12 3 20 6v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z M8 12l3 3 5-5', '오탐 관리 및 AI 학습'],
  ['stats', 'M3 3v18h18 M7 16v-5 M12 16V7 M17 16v-8', '통계 분석'],
];

export default function Admin() {
  const [tab, setTab] = useState('members');
  const [workers, setWorkers] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [falseEvents, setFalseEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [membersPage, setMembersPage] = useState(1);
  const [camerasPage, setCamerasPage] = useState(1);
  const [editor, setEditor] = useState(false);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.get('/api/admin/workers'),
      apiClient.get('/api/cameras'),
      apiClient.get('/api/events', { params: { page: 0, size: 100, reviewStatus: 'FALSE_POSITIVE' } }),
    ]).then(([workerResult, cameraResult, eventResult]) => {
      if (!active) return;
      setWorkers(workerResult.data);
      setCameras(cameraResult.data
        .filter((camera) => /^CAM00[1-4]$/.test(camera.cameraId))
        .sort((a, b) => a.cameraId.localeCompare(b.cameraId)));
      setFalseEvents(eventResult.data.content);
      setError('');
    }).catch((cause) => { if (active) setError(apiError(cause)); });
    return () => { active = false; };
  }, [revision]);

  async function createWorker(event) {
    event.preventDefault();
    try {
      const { data } = await apiClient.post('/api/admin/workers', { name: name.trim() });
      setName(''); setEditor(false);
      setNotice(`${data.name} 계정 생성: ID ${data.loginId}, 임시 비밀번호 ${data.temporaryPassword} — 지금 전달해 주세요.`);
      setRevision((value) => value + 1);
    } catch (cause) { setError(apiError(cause)); }
  }
  async function changeStatus(worker) {
    try {
      await apiClient.patch(`/api/admin/workers/${worker.accountId}/status`, { status: worker.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      setNotice(`${worker.loginId} 상태가 변경되었습니다.`);
      setRevision((value) => value + 1);
    } catch (cause) { setError(apiError(cause)); }
  }
  async function resetPassword(worker) {
    try {
      const { data } = await apiClient.patch(`/api/admin/workers/${worker.accountId}/password-reset`);
      setNotice(`${data.loginId} 임시 비밀번호: ${data.temporaryPassword} — 지금 전달해 주세요.`);
      setRevision((value) => value + 1);
    } catch (cause) { setError(apiError(cause)); }
  }

  const filtered = workers.filter((worker) => `${worker.name} ${worker.loginId}`.toLowerCase().includes(query.toLowerCase()));
  const membersPageCount = Math.max(1, Math.ceil(filtered.length / MEMBERS_PAGE_SIZE));
  const currentMembersPage = Math.min(membersPage, membersPageCount);
  const membersPageStart = (currentMembersPage - 1) * MEMBERS_PAGE_SIZE;
  const visibleUsers = filtered.slice(membersPageStart, membersPageStart + MEMBERS_PAGE_SIZE);
  const camerasPageCount = Math.max(1, Math.ceil(cameras.length / CAMERAS_PAGE_SIZE));
  const currentCamerasPage = Math.min(camerasPage, camerasPageCount);
  const camerasPageStart = (currentCamerasPage - 1) * CAMERAS_PAGE_SIZE;
  const visibleCameras = cameras.slice(camerasPageStart, camerasPageStart + CAMERAS_PAGE_SIZE);
  const tabCounts = { members: String(workers.length).padStart(2, '0'), cameras: `${cameras.length} CH`, reviews: `${falseEvents.length} 건`, stats: 'KPI' };

  return <main className="console-page admin-page">
    <PageHeading eyebrow="FIRIS ROOT CONSOLE / SECURE LAYER" title="시스템 관리자 통제 센터"><span className="console-muted">◉ 실제 서버 데이터</span><button disabled title="백업 API 미구현">시스템 설정 백업</button><button disabled title="감사 로그 API 미구현">감사 로그 내보내기</button></PageHeading>
    <nav className="admin-tabs" aria-label="관리 메뉴">{tabs.map(([id, icon, label]) => <button key={id} className={tab === id ? 'admin-tabs__active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><svg className="admin-tabs__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>{label}<small>{tabCounts[id]}</small></button>)}</nav>
    {error && <div className="console-notice" role="alert">{error}</div>}
    {notice && <div className="console-notice" role="status">{notice}</div>}
    {tab === 'members' && <>
      <section className="console-toolbar"><div><h2>관제 요원 및 시스템 관리자 계정 목록</h2><p>관리자가 발급한 작업자 계정과 활성 상태를 관리합니다.</p></div><div className="console-actions"><input className="console-search" aria-label="관제관 검색" placeholder="⌕  성명, 사번, 직책 검색…" value={query} onChange={(event) => { setQuery(event.target.value); setMembersPage(1); }} /><button className="console-primary" onClick={() => { setName(''); setEditor(true); }}>♙ 신규 관제관 등록</button></div></section>
      <div className="console-table-wrap"><table className="console-table admin-table"><thead><tr>{['사번 / UID', '성명', '권한 등급', '세션 상태', '비상 연락처', '최근 접속 기록', '계정 제어'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{visibleUsers.map((worker) => <tr key={worker.accountId}><td className="console-mono admin-user-id">{worker.loginId}</td><td><div className="admin-person"><span className="admin-avatar">{worker.name?.[0]}</span><div><strong>{worker.name}</strong><small>{worker.loginId}</small></div></div></td><td><Badge tone="amber">작업자</Badge></td><td><span className={`admin-session admin-session--${worker.status.toLowerCase()}`}>● <b>{worker.status}</b></span></td><td className="console-mono">미등록</td><td className="console-mono">{worker.createdAt?.replace('T', ' ') || '—'}<small>계정 생성일</small></td><td><button onClick={() => changeStatus(worker)}>{worker.status === 'ACTIVE' ? '비활성화' : '활성화'}</button> <button onClick={() => resetPassword(worker)}>비밀번호 초기화</button></td></tr>)}{!filtered.length && <tr><td colSpan="7" className="console-empty">검색 조건에 맞는 관제관이 없습니다.</td></tr>}</tbody></table></div>
      <div className="admin-pagination"><span className="console-muted" aria-live="polite">총 {filtered.length}명 중 {filtered.length ? membersPageStart + 1 : 0}–{Math.min(membersPageStart + MEMBERS_PAGE_SIZE, filtered.length)}명 표시</span><nav aria-label="회원 목록 페이지"><button disabled={currentMembersPage === 1} onClick={() => setMembersPage(currentMembersPage - 1)}>‹ 이전</button>{Array.from({ length: membersPageCount }, (_, index) => index + 1).map((number) => <button key={number} aria-label={`${number}페이지`} aria-current={currentMembersPage === number ? 'page' : undefined} disabled={!filtered.length} onClick={() => setMembersPage(number)}>{number}</button>)}<button disabled={currentMembersPage === membersPageCount} onClick={() => setMembersPage(currentMembersPage + 1)}>다음 ›</button></nav><span className="console-muted admin-pagination__signature">FIRIS / ACCESS CONTROL SYSTEM</span></div>
    </>}
    {tab === 'cameras' && <><section className="console-toolbar"><div><h2>CCTV 채널 및 관제 구역 관리</h2><p>미리 등록된 카메라의 현재 상태를 조회합니다.</p></div><Badge tone="amber">{cameras.filter((camera) => camera.status === 'ONLINE').length} / {cameras.length} 활성</Badge></section><div className="console-table-wrap"><table className="console-table admin-table"><thead><tr>{['채널 ID', '설치 위치', '해상도', '감지 설정', '채널 제어'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{visibleCameras.map((camera) => <tr key={camera.cameraId}><td className="console-mono">{camera.cameraId}</td><td>{camera.location}</td><td>미등록</td><td><Badge tone={camera.status === 'ONLINE' ? 'green' : ''}>{camera.status}</Badge></td><td>{camera.streamUrl ? <a href={camera.streamUrl} target="_blank" rel="noreferrer">재생 확인</a> : <button disabled title="카메라 변경 API 미구현">조회 전용</button>}</td></tr>)}</tbody></table></div></>}
    {tab === 'cameras' && <div className="admin-pagination"><span className="console-muted" aria-live="polite">총 {cameras.length}개 중 {cameras.length ? camerasPageStart + 1 : 0}–{Math.min(camerasPageStart + CAMERAS_PAGE_SIZE, cameras.length)}개 표시</span><nav aria-label="CCTV 목록 페이지"><button disabled={currentCamerasPage === 1} onClick={() => setCamerasPage(currentCamerasPage - 1)}>‹ 이전</button>{Array.from({ length: camerasPageCount }, (_, index) => index + 1).map((number) => <button key={number} aria-label={`${number}페이지`} aria-current={currentCamerasPage === number ? 'page' : undefined} disabled={!cameras.length} onClick={() => setCamerasPage(number)}>{number}</button>)}<button disabled={currentCamerasPage === camerasPageCount} onClick={() => setCamerasPage(currentCamerasPage + 1)}>다음 ›</button></nav><span className="console-muted admin-pagination__signature">FIRIS / ACCESS CONTROL SYSTEM</span></div>}
    {tab === 'reviews' && <><section className="console-toolbar"><div><h2>오탐 검토 및 학습 데이터 관리</h2><p>오탐으로 검수된 이벤트를 조회합니다. 학습 후보 지정 API는 아직 없습니다.</p></div></section><div className="admin-review-grid">{falseEvents.map((event) => <FalsePositiveCard key={event.eventId} event={event} />)}{!falseEvents.length && <p className="console-muted">오탐으로 검수된 이벤트가 없습니다.</p>}</div></>}
    {tab === 'stats' && <><section className="console-toolbar"><div><h2>관제 운영 통계</h2><p>실제 서버 데이터 기준 집계입니다.</p></div></section><div className="admin-stats">{[['등록 관제 요원', workers.length, '명'], ['활성 작업자', workers.filter((worker) => worker.status === 'ACTIVE').length, '명'], ['활성 CCTV', cameras.filter((camera) => camera.status === 'ONLINE').length, '채널'], ['조회된 오탐', falseEvents.length, '건']].map(([label, value, unit]) => <article className="console-panel" key={label}><span>{label}</span><strong>{value}<small>{unit}</small></strong></article>)}</div><section className="console-panel admin-role-stats"><h3>권한별 계정 분포</h3><div><span>작업자</span><meter min="0" max={Math.max(workers.length, 1)} value={workers.length} /><b>{workers.length}명</b></div></section></>}
    {tab !== 'members' && tab !== 'cameras' && <footer className="console-foot admin-footer"><span>FIRIS / ACCESS CONTROL SYSTEM</span></footer>}
    {editor && <Modal title="신규 관제관 등록" subtitle="PERSONNEL ACCESS MANAGEMENT" onClose={() => setEditor(false)}><form onSubmit={createWorker}><div className="console-modal__body console-form"><label>이름<input required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} /></label><label>사원번호<input disabled value="저장 시 자동 발급" readOnly /></label><label>이메일<input disabled value="현재 수집하지 않음" readOnly /></label><label>연락처<input disabled value="현재 수집하지 않음" readOnly /></label><p className="console-muted">계정 생성 후 발급되는 로그인 ID와 임시 비밀번호를 작업자에게 전달하세요.</p>{error && <p role="alert" className="admin-error">{error}</p>}</div><footer className="console-modal__footer"><button type="button" onClick={() => setEditor(false)}>취소</button><button type="submit" className="console-primary">관제관 등록</button></footer></form></Modal>}
  </main>;
}

function FalsePositiveCard({ event }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    apiClient.get(`/api/events/${event.eventId}`).then(({ data }) => { if (active) setDetail(data); }).catch((cause) => { if (active) setError(apiError(cause)); });
    return () => { active = false; };
  }, [event.eventId]);
  return <article className="console-panel admin-review"><div><span className="console-mono">FP-{event.eventId}</span><Badge tone="green">오탐 검수 완료</Badge></div><h3>{reasonName[detail?.review?.falsePositiveReason] || '사유 확인 중'}</h3><p>{event.cameraName} · {event.location}</p>{detail?.review?.note && <p>{detail.review.note}</p>}{error && <p role="alert">{error}</p>}<button disabled title="학습 후보 지정 API 미구현">✓ 학습 후보로 지정</button></article>;
}
