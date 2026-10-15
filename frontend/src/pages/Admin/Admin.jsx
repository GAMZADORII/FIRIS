import { useEffect, useRef, useState } from 'react';
import { apiClient, apiError, getSession } from '../../api/client.js';
import { Badge, Modal, PageHeading } from '../../components/Console/Console.jsx';
import './Admin.css';
import EventDetailModal from '../../components/Console/EventDetailModal.jsx';
import { compareCameras, cameraDisplayName } from '../../utils/cameraChannels.js';
import { formatPhone } from '../../utils/phone.js';
import { roleLabel } from '../../utils/roles.js';

const MEMBERS_PAGE_SIZE = 4;
const CAMERAS_PAGE_SIZE = 4;
const REVIEWS_PAGE_SIZE = 4;
const reasonName = { STEAM: '수증기', LIGHT: '빛', REFLECTION: '반사', DUST: '먼지', WELDING: '용접', ETC: '기타' };
const tabs = [
  ['members', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M20 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75', '작업자 관리'],
  ['cameras', 'M4 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M16 9l6-3v12l-6-3', 'CCTV 관리'],
  ['reviews', 'M12 3 20 6v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z M8 12l3 3 5-5', '오탐 관리 및 AI 학습'],
  ['stats', 'M3 3v18h18 M7 16v-5 M12 16V7 M17 16v-8', '통계 분석'],
];

export default function Admin() {
  const [tab, setTab] = useState('members');
  const isSuperAdmin = getSession()?.account?.role === 'SUPER_ADMIN';
  const [accountEditor, setAccountEditor] = useState(null);
  const [accountDeleteTarget, setAccountDeleteTarget] = useState(null);
  const [accountError, setAccountError] = useState('');
  const [roleTarget, setRoleTarget] = useState(null);
  const [roleError, setRoleError] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const accountLock = useRef(false);
  const [roleCounts, setRoleCounts] = useState(null);
  const [roleCountsError, setRoleCountsError] = useState('');
  const [workers, setWorkers] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [falseEvents, setFalseEvents] = useState([]);
  const [falseEventTotal, setFalseEventTotal] = useState(0);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsPage, setReviewsPage] = useState(0);
  const [reviewsPages, setReviewsPages] = useState(1);
  const [reviewsCamera, setReviewsCamera] = useState('');
  const [reviewsReason, setReviewsReason] = useState('');
  const [reviewDetailId, setReviewDetailId] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [query, setQuery] = useState('');
  const [membersPage, setMembersPage] = useState(1);
  const [camerasPage, setCamerasPage] = useState(1);
  const [editor, setEditor] = useState(false);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [cameraEditor, setCameraEditor] = useState(false);
  const [cameraDraft, setCameraDraft] = useState({ cameraId: '', cameraName: '', location: '', status: 'ONLINE' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const cameraLock = useRef(false);
  const closeCameraModal = () => {
    if (cameraLock.current) return;
    setCameraEditor(false); setDeleteTarget(null); setCameraError('');
  };
  const changeCameraField = (field) => (event) => setCameraDraft((draft) => ({ ...draft, [field]: event.target.value }));
  async function createCamera(event) {
    event.preventDefault();
    if (cameraLock.current) return;
    cameraLock.current = true; setCameraBusy(true); setCameraError('');
    try {
      const payload = Object.fromEntries(Object.entries(cameraDraft).map(([key, value]) => [key, value.trim()]));
      const { data } = await apiClient.post('/api/cameras', payload);
      setCameras((items) => [...items, data].sort(compareCameras));
      setCameraEditor(false); setNotice(`${data.cameraName} CCTV를 등록했습니다.`); setError(''); setRevision((value) => value + 1);
    } catch (cause) { setCameraError(apiError(cause)); }
    finally { cameraLock.current = false; setCameraBusy(false); }
  }
  async function deleteCamera() {
    if (!deleteTarget || cameraLock.current) return;
    cameraLock.current = true; setCameraBusy(true); setCameraError('');
    try {
      await apiClient.delete(`/api/cameras/${encodeURIComponent(deleteTarget.cameraId)}`);
      setCameras((items) => items.filter((item) => item.cameraId !== deleteTarget.cameraId));
      setNotice(`${deleteTarget.cameraName} CCTV를 삭제했습니다. 기존 이벤트 이력은 유지됩니다.`);
      setDeleteTarget(null); setError(''); setRevision((value) => value + 1);
    } catch (cause) { setCameraError(apiError(cause)); }
    finally { cameraLock.current = false; setCameraBusy(false); }
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.get('/api/admin/workers'),
      apiClient.get('/api/cameras'),
      apiClient.get('/api/events', { params: { page: 0, size: 1, reviewStatus: 'FALSE_POSITIVE' } }),
    ]).then(([workerResult, cameraResult, eventResult]) => {
      if (!active) return;
      setWorkers(workerResult.data);
      setCameras([...cameraResult.data].sort(compareCameras));
      setFalseEventTotal(eventResult.data.totalElements);
      setError('');
    }).catch((cause) => { if (active) setError(apiError(cause)); });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    if (tab !== 'stats') return;
    let active = true;
    setRoleCounts(null); setRoleCountsError('');
    apiClient.get('/api/admin/accounts/role-counts').then(({ data }) => {
      if (active) setRoleCounts(data);
    }).catch((cause) => { if (active) setRoleCountsError(apiError(cause)); });
    return () => { active = false; };
  }, [tab, revision]);

  useEffect(() => {
    if (tab !== 'members') return;
    let active = true, loading = false;
    const refreshContacts = async () => {
      if (loading || document.visibilityState === 'hidden') return;
      loading = true;
      try {
        const { data } = await apiClient.get('/api/admin/workers');
        if (active) setWorkers(data);
      } catch { /* Keep the current list and retry on the next refresh. */ }
      finally { loading = false; }
    };
    const timer = window.setInterval(refreshContacts, 5000);
    window.addEventListener('focus', refreshContacts);
    document.addEventListener('visibilitychange', refreshContacts);
    return () => {
      active = false; window.clearInterval(timer);
      window.removeEventListener('focus', refreshContacts);
      document.removeEventListener('visibilitychange', refreshContacts);
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'reviews') return;
    let active = true;
    setReviewsLoading(true); setReviewsError(''); setFalseEvents([]);
    apiClient.get('/api/events', { params: {
      page: reviewsPage, size: REVIEWS_PAGE_SIZE, reviewStatus: 'FALSE_POSITIVE',
      ...(reviewsCamera ? { cameraId: reviewsCamera } : {}),
      ...(reviewsReason ? { falsePositiveReason: reviewsReason } : {}),
    } }).then(({ data }) => {
      if (!active) return;
      const pageCount = Math.max(data.totalPages, 1);
      setReviewsTotal(data.totalElements); setReviewsPages(pageCount);
      if (!reviewsCamera && !reviewsReason) setFalseEventTotal(data.totalElements);
      if (reviewsPage >= pageCount) { setReviewsPage(pageCount - 1); return; }
      setFalseEvents(data.content);
    }).catch((cause) => { if (active) setReviewsError(apiError(cause)); })
      .finally(() => { if (active) setReviewsLoading(false); });
    return () => { active = false; };
  }, [tab, reviewsPage, reviewsCamera, reviewsReason, revision]);

  async function createWorker(event) {
    event.preventDefault();
    try {
      const { data } = await apiClient.post('/api/admin/workers', { name: name.trim() });
      setName(''); setEditor(false);
      setNotice(`${data.name} 계정 생성: ID ${data.loginId}, 임시 비밀번호 ${data.temporaryPassword} — 지금 전달해 주세요.`);
      setRevision((value) => value + 1);
    } catch (cause) { setError(apiError(cause)); }
  }
  async function runAccountAction(action, reportError = setError) {
    if (accountLock.current) return;
    accountLock.current = true; setAccountBusy(true);
    try {
      await action(); setError(''); setRevision((value) => value + 1);
    } catch (cause) { reportError(apiError(cause)); }
    finally { accountLock.current = false; setAccountBusy(false); }
  }
  async function changeStatus(worker) {
    await runAccountAction(async () => {
      await apiClient.patch(`/api/admin/workers/${worker.accountId}/status`, { status: worker.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      setNotice(`${worker.loginId} 상태가 변경되었습니다.`);
      setAccountEditor(null);
    }, setAccountError);
  }
  async function resetPassword(worker) {
    await runAccountAction(async () => {
      const { data } = await apiClient.patch(`/api/admin/workers/${worker.accountId}/password-reset`);
      setNotice(`${data.loginId} 임시 비밀번호: ${data.temporaryPassword} — 지금 전달해 주세요.`);
      setAccountEditor(null);
    }, setAccountError);
  }
  const closeAccountModal = () => {
    if (accountLock.current) return;
    setAccountEditor(null); setAccountDeleteTarget(null); setAccountError('');
  };
  async function deleteAccount() {
    if (!accountDeleteTarget) return;
    setAccountError('');
    await runAccountAction(async () => {
      await apiClient.delete('/api/admin/workers/' + accountDeleteTarget.accountId);
      setWorkers((items) => items.filter((item) => item.accountId !== accountDeleteTarget.accountId));
      setNotice(accountDeleteTarget.name + ' 계정을 삭제했습니다.');
      setAccountDeleteTarget(null);
    }, setAccountError);
  }
  const closeRoleModal = () => { if (!accountLock.current) { setRoleTarget(null); setRoleError(''); } };
  async function changeRole() {
    if (!roleTarget) return;
    setRoleError('');
    await runAccountAction(async () => {
      const { data } = await apiClient.patch(`/api/admin/workers/${roleTarget.account.accountId}/role`, {
        role: roleTarget.role, expectedRole: roleTarget.account.role,
      });
      setWorkers((items) => items.map((item) => item.accountId === data.accountId ? data : item));
      setNotice(`${data.name} 계정의 권한을 ${roleLabel(data.role)}로 변경했습니다.`);
      setRoleTarget(null);
    }, setRoleError);
  }

  const filtered = workers.filter((worker) => `${worker.name} ${worker.loginId} ${roleLabel(worker.role)}`.toLowerCase().includes(query.toLowerCase()));
  const membersPageCount = Math.max(1, Math.ceil(filtered.length / MEMBERS_PAGE_SIZE));
  const currentMembersPage = Math.min(membersPage, membersPageCount);
  const membersPageStart = (currentMembersPage - 1) * MEMBERS_PAGE_SIZE;
  const visibleUsers = filtered.slice(membersPageStart, membersPageStart + MEMBERS_PAGE_SIZE);
  const camerasPageCount = Math.max(1, Math.ceil(cameras.length / CAMERAS_PAGE_SIZE));
  const currentCamerasPage = Math.min(camerasPage, camerasPageCount);
  const camerasPageStart = (currentCamerasPage - 1) * CAMERAS_PAGE_SIZE;
  const visibleCameras = cameras.slice(camerasPageStart, camerasPageStart + CAMERAS_PAGE_SIZE);
  const tabCounts = { members: String(workers.length).padStart(2, '0'), cameras: `${cameras.length} CH`, reviews: `${falseEventTotal} 건`, stats: 'KPI' };

  return <main className="console-page admin-page">
    <PageHeading eyebrow="FIRIS ROOT CONSOLE / SECURE LAYER" title="시스템 관리자 통제 센터" />
    <nav className="admin-tabs" aria-label="관리 메뉴">{tabs.map(([id, icon, label]) => <button key={id} className={tab === id ? 'admin-tabs__active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><svg className="admin-tabs__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>{label}<small>{tabCounts[id]}</small></button>)}</nav>
    {error && <div className="console-notice" role="alert">{error}</div>}
    {notice && <div className="console-notice" role="status">{notice}</div>}
    {tab === 'members' && <>
      <section className="console-toolbar"><div><h2>관제 요원 및 시스템 관리자 계정 목록</h2></div><div className="console-actions"><input className="console-search" aria-label="관제관 검색" placeholder="⌕  성명, 사번, 직책 검색…" value={query} onChange={(event) => { setQuery(event.target.value); setMembersPage(1); }} /><button className="console-primary" onClick={() => { setName(''); setEditor(true); }}>♙ 신규 관제관 등록</button></div></section>
      <div className="console-table-wrap"><table className="console-table admin-table"><colgroup>{[13,16,14,11,14,16,16].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup><thead><tr>{['사번 / UID', '성명', '권한 등급', '세션 상태', '비상 연락처', '계정 생성일', '계정 제어'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{visibleUsers.map((worker) => <tr key={worker.accountId}><td className="console-mono admin-user-id" title={worker.loginId}>{worker.loginId}</td><td><div className="admin-person"><span className="admin-avatar">{worker.name?.[0]}</span><div><strong title={worker.name}>{worker.name}</strong><small title={worker.loginId}>{worker.loginId}</small></div></div></td><td><Badge tone="amber">{roleLabel(worker.role)}</Badge></td><td><span className={`admin-session admin-session--${worker.status.toLowerCase()}`}>● <b>{worker.status}</b></span></td><td className="console-mono">{formatPhone(worker.contactPhone)}</td><td className="console-mono">{worker.createdAt?.replace('T', ' ') || '—'}</td><td><div className="admin-row-actions"><button disabled={accountBusy} aria-label={`${worker.name} 계정 수정`} onClick={() => { setAccountError(''); setAccountEditor(worker); }}>수정</button><button disabled={accountBusy} aria-label={`${worker.name} 계정 삭제`} onClick={() => { setAccountError(''); setAccountDeleteTarget(worker); }}>삭제</button></div></td></tr>)}{!filtered.length && <tr><td colSpan="7" className="console-empty">검색 조건에 맞는 관제관이 없습니다.</td></tr>}</tbody></table></div>
      <div className="admin-pagination"><span className="console-muted" aria-live="polite">총 {filtered.length}명 중 {filtered.length ? membersPageStart + 1 : 0}–{Math.min(membersPageStart + MEMBERS_PAGE_SIZE, filtered.length)}명 표시</span><nav aria-label="작업자 목록 페이지"><button disabled={currentMembersPage === 1} onClick={() => setMembersPage(currentMembersPage - 1)}>‹ 이전</button>{Array.from({ length: membersPageCount }, (_, index) => index + 1).map((number) => <button key={number} aria-label={`${number}페이지`} aria-current={currentMembersPage === number ? 'page' : undefined} disabled={!filtered.length} onClick={() => setMembersPage(number)}>{number}</button>)}<button disabled={currentMembersPage === membersPageCount} onClick={() => setMembersPage(currentMembersPage + 1)}>다음 ›</button></nav><span className="console-muted admin-pagination__signature">FIRIS / ACCESS CONTROL SYSTEM</span></div>
    </>}
    {tab === 'cameras' && <><section className="console-toolbar"><div><h2>CCTV 채널 및 관제 구역 관리</h2></div><div className="console-actions"><Badge tone="amber">{cameras.filter((camera) => camera.status === 'ONLINE').length} / {cameras.length} 활성</Badge><button className="console-primary" onClick={() => { setCameraDraft({ cameraId: '', cameraName: '', location: '', status: 'ONLINE' }); setCameraError(''); setCameraEditor(true); }}>+ CCTV 추가</button></div></section><div className="console-table-wrap"><table className="console-table admin-table"><colgroup>{[25,25,25,25].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup><thead><tr>{['표시 채널', '설치 위치', '감지 설정', 'CCTV 삭제'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{visibleCameras.map((camera) => <tr key={camera.cameraId}><td className="console-mono">{cameraDisplayName(camera.cameraId, camera.cameraName)}<small>{camera.cameraId} · {camera.cameraName}</small></td><td title={camera.location}>{camera.location}</td><td><Badge tone={camera.status === 'ONLINE' ? 'green' : ''}>{camera.status}</Badge></td><td><button aria-label={`${cameraDisplayName(camera.cameraId, camera.cameraName)} CCTV 삭제`} onClick={() => { setCameraError(''); setDeleteTarget(camera); }}>CCTV 삭제</button></td></tr>)}{!cameras.length && <tr><td colSpan="4" className="console-empty">등록된 CCTV가 없습니다.</td></tr>}</tbody></table></div></>}
    {tab === 'cameras' && <div className="admin-pagination"><span className="console-muted" aria-live="polite">총 {cameras.length}개 중 {cameras.length ? camerasPageStart + 1 : 0}–{Math.min(camerasPageStart + CAMERAS_PAGE_SIZE, cameras.length)}개 표시</span><nav aria-label="CCTV 목록 페이지"><button disabled={currentCamerasPage === 1} onClick={() => setCamerasPage(currentCamerasPage - 1)}>‹ 이전</button>{Array.from({ length: camerasPageCount }, (_, index) => index + 1).map((number) => <button key={number} aria-label={`${number}페이지`} aria-current={currentCamerasPage === number ? 'page' : undefined} disabled={!cameras.length} onClick={() => setCamerasPage(number)}>{number}</button>)}<button disabled={currentCamerasPage === camerasPageCount} onClick={() => setCamerasPage(currentCamerasPage + 1)}>다음 ›</button></nav><span className="console-muted admin-pagination__signature">FIRIS / ACCESS CONTROL SYSTEM</span></div>}
    {tab === 'reviews' && <>
      <section className="console-toolbar"><div><h2>오탐 검토 및 학습 데이터 관리</h2></div><div className="console-actions"><select aria-label="오탐 CCTV 필터" value={reviewsCamera} disabled={reviewsLoading} onChange={(event) => { setReviewsCamera(event.target.value); setReviewsPage(0); }}><option value="">전체 CCTV</option>{cameras.map((camera) => <option key={camera.cameraId} value={camera.cameraId}>{cameraDisplayName(camera.cameraId, camera.cameraName)}</option>)}</select><select aria-label="오탐 사유 필터" value={reviewsReason} disabled={reviewsLoading} onChange={(event) => { setReviewsReason(event.target.value); setReviewsPage(0); }}><option value="">전체 오탐 사유</option>{Object.entries(reasonName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></section>
      {reviewsError && <p role="alert" className="console-notice">{reviewsError}</p>}
      <div className="admin-review-grid" aria-busy={reviewsLoading}>{reviewsLoading ? <p role="status" className="console-muted">오탐 목록을 불러오는 중입니다.</p> : falseEvents.map((event) => <FalsePositiveCard key={event.eventId} event={event} onOpen={() => setReviewDetailId(event.eventId)} />)}{!reviewsLoading && !reviewsError && !falseEvents.length && <p className="console-muted">선택한 조건의 오탐 이벤트가 없습니다.</p>}</div>
      <div className="admin-pagination"><span className="console-muted" aria-live="polite">총 {reviewsTotal}건 중 {falseEvents.length ? reviewsPage * REVIEWS_PAGE_SIZE + 1 : 0}–{falseEvents.length ? reviewsPage * REVIEWS_PAGE_SIZE + falseEvents.length : 0}건 표시</span><nav aria-label="오탐 목록 페이지"><button disabled={reviewsLoading || !!reviewsError || reviewsPage === 0} onClick={() => setReviewsPage((value) => value - 1)}>‹ 이전</button><>{Array.from({ length: reviewsPages }, (_, index) => index + 1).map((number) => <button key={number} aria-label={`${number}페이지`} aria-current={reviewsPage + 1 === number ? 'page' : undefined} disabled={reviewsLoading || !!reviewsError || !reviewsTotal} onClick={() => setReviewsPage(number - 1)}>{number}</button>)}</><button disabled={reviewsLoading || !!reviewsError || reviewsPage + 1 >= reviewsPages} onClick={() => setReviewsPage((value) => value + 1)}>다음 ›</button></nav><span className="console-muted admin-pagination__signature">FIRIS / ACCESS CONTROL SYSTEM</span></div>
    </>}
    {tab === 'stats' && <><section className="console-toolbar"><div><h2>관제 운영 통계</h2></div></section><div className="admin-stats">{[['등록 작업자', workers.filter((worker) => worker.role === 'WORKER').length, '명'], ['활성 작업자', workers.filter((worker) => worker.role === 'WORKER' && worker.status === 'ACTIVE').length, '명'], ['활성 CCTV', cameras.filter((camera) => camera.status === 'ONLINE').length, '채널'], ['전체 오탐', falseEventTotal, '건']].map(([label, value, unit]) => <article className="console-panel" key={label}><span>{label}</span><strong>{value}<small>{unit}</small></strong></article>)}</div><section className="console-panel admin-role-stats"><h3>권한별 계정 분포</h3>{roleCountsError ? <p role="alert" className="console-notice">{roleCountsError}</p> : !roleCounts ? <p role="status" className="console-muted">계정 분포를 불러오는 중입니다.</p> : [['최고 관리자', roleCounts.superAdmins], ['관리자', roleCounts.admins], ['작업자', roleCounts.workers]].map(([label, count]) => <div key={label}><span>{label}</span><meter aria-label={`${label} 계정 비율`} min="0" max={Math.max(roleCounts.superAdmins + roleCounts.admins + roleCounts.workers, 1)} value={count} /><b>{count}명</b></div>)}</section></>}
    {tab === 'stats' && <footer className="console-foot admin-footer"><span>FIRIS / ACCESS CONTROL SYSTEM</span></footer>}
    {accountEditor && <Modal title="계정 수정" subtitle={accountEditor.name + ' · ' + accountEditor.loginId} onClose={closeAccountModal}>
      <div className="console-modal__body"><p>권한: {roleLabel(accountEditor.role)} · 상태: {accountEditor.status}</p><div className="admin-account-actions">
        <button disabled={accountBusy} onClick={() => { setAccountError(''); changeStatus(accountEditor); }}>{accountEditor.status === 'ACTIVE' ? '비활성화' : '활성화'}</button>
        <button disabled={accountBusy} onClick={() => { setAccountError(''); resetPassword(accountEditor); }}>비밀번호 초기화</button>
        {isSuperAdmin && <button disabled={accountBusy} onClick={() => { setRoleError(''); setRoleTarget({ account: accountEditor, role: accountEditor.role }); setAccountEditor(null); }}>권한 등급 수정</button>}
      </div>{accountError && <p role="alert" className="admin-error">{accountError}</p>}</div>
      <footer className="console-modal__footer"><button disabled={accountBusy} onClick={closeAccountModal}>닫기</button></footer>
    </Modal>}
    {accountDeleteTarget && <Modal title="계정 삭제" subtitle="ACCOUNT MANAGEMENT" onClose={closeAccountModal}>
      <div className="console-modal__body"><p><strong>{accountDeleteTarget.name} ({accountDeleteTarget.loginId})</strong> 계정을 삭제하시겠습니까?</p><p>목록에서 제거되고 로그인할 수 없습니다. 기존 검수·신고 이력은 유지되며 이 화면에서 복구할 수 없습니다.</p>{accountError && <p role="alert" className="admin-error">{accountError}</p>}</div>
      <footer className="console-modal__footer"><button disabled={accountBusy} onClick={closeAccountModal}>취소</button><button className="console-primary" disabled={accountBusy} onClick={deleteAccount}>{accountBusy ? '삭제 중…' : '계정 삭제'}</button></footer>
    </Modal>}
    {roleTarget && <Modal title="권한 등급 변경" subtitle="ACCOUNT ROLE MANAGEMENT" onClose={closeRoleModal}><div className="console-modal__body"><p><strong>{roleTarget.account.name} ({roleTarget.account.loginId})</strong> 계정의 권한을 변경하시겠습니까?</p><label className="admin-role-field">권한 등급<select disabled={accountBusy} value={roleTarget.role} onChange={(event) => setRoleTarget((target) => ({ ...target, role: event.target.value }))}><option value="WORKER">작업자</option><option value="ADMIN">관리자</option></select></label><p>로그인 아이디와 기존 기록은 유지됩니다. 변경한 권한은 다음 서버 요청부터 적용됩니다.</p>{roleError && <p role="alert" className="admin-error">{roleError}</p>}</div><footer className="console-modal__footer"><button disabled={accountBusy} onClick={closeRoleModal}>취소</button><button className="console-primary" disabled={accountBusy || roleTarget.role === roleTarget.account.role} onClick={changeRole}>{accountBusy ? '변경 중…' : '권한 변경'}</button></footer></Modal>}
    {cameraEditor && <Modal title="CCTV 추가" subtitle="CAMERA MANAGEMENT" className="camera-management-modal" onClose={closeCameraModal}><form onSubmit={createCamera}><fieldset disabled={cameraBusy} className="console-modal__body console-form">
      <label>CCTV ID<input required maxLength={30} pattern="[A-Za-z0-9_\-]{1,30}" placeholder="예: CAM010" value={cameraDraft.cameraId} onChange={changeCameraField('cameraId')} /><small>영문, 숫자, 밑줄, 하이픈을 사용할 수 있습니다. 삭제된 ID는 재사용할 수 없습니다.</small></label>
      <label>CCTV 이름<input required maxLength={50} value={cameraDraft.cameraName} onChange={changeCameraField('cameraName')} /></label>
      <label>설치 위치<input maxLength={100} value={cameraDraft.location} onChange={changeCameraField('location')} /></label>
      <label>상태<select value={cameraDraft.status} onChange={changeCameraField('status')}><option value="ONLINE">ONLINE</option><option value="OFFLINE">OFFLINE</option></select></label>
      <p className="console-muted">영상 주소는 자동 등록됩니다. 영상 파일은 storage/videos/{cameraDraft.cameraId.trim() || 'CCTV ID'}/001.mp4 위치에 준비해주세요.</p>
      {cameraError && <p role="alert" className="admin-error">{cameraError}</p>}
    </fieldset><footer className="console-modal__footer"><button type="button" disabled={cameraBusy} onClick={closeCameraModal}>취소</button><button type="submit" disabled={cameraBusy} className="console-primary">{cameraBusy ? '등록 중…' : 'CCTV 등록'}</button></footer></form></Modal>}
    {deleteTarget && <Modal title="CCTV 삭제" subtitle="CAMERA MANAGEMENT" onClose={closeCameraModal}><div className="console-modal__body"><p><strong>{deleteTarget.cameraName} ({deleteTarget.cameraId})</strong> CCTV를 삭제하시겠습니까?</p><p>관제 목록에서 제거되며 새 감지 이벤트를 받지 않습니다. 기존 이벤트·검수 이력은 보존됩니다.</p>{cameraError && <p role="alert" className="admin-error">{cameraError}</p>}</div><footer className="console-modal__footer"><button disabled={cameraBusy} onClick={closeCameraModal}>취소</button><button className="console-primary" disabled={cameraBusy} onClick={deleteCamera}>{cameraBusy ? '삭제 중…' : 'CCTV 삭제'}</button></footer></Modal>}
    {reviewDetailId !== null && <EventDetailModal eventId={reviewDetailId} onClose={() => setReviewDetailId(null)} />}
    {editor && <Modal title="신규 관제관 등록" subtitle="PERSONNEL ACCESS MANAGEMENT" onClose={() => setEditor(false)}><form onSubmit={createWorker}><div className="console-modal__body console-form"><label>이름<input required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} /></label><label>사원번호<input disabled value="저장 시 자동 발급" readOnly /></label><p className="console-muted">계정 생성 후 발급되는 로그인 ID와 임시 비밀번호를 작업자에게 전달하세요.</p>{error && <p role="alert" className="admin-error">{error}</p>}</div><footer className="console-modal__footer"><button type="button" onClick={() => setEditor(false)}>취소</button><button type="submit" className="console-primary">관제관 등록</button></footer></form></Modal>}
  </main>;
}

function FalsePositiveCard({ event, onOpen }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    apiClient.get(`/api/events/${event.eventId}`).then(({ data }) => { if (active) setDetail(data); }).catch((cause) => { if (active) setError(apiError(cause)); });
    return () => { active = false; };
  }, [event.eventId]);
  return <article className="console-panel admin-review">
    <div className="admin-review__header"><span className="console-mono admin-review__id">FP-{event.eventId}</span><Badge tone="green">오탐 검수 완료</Badge></div>
    <div className="admin-review__reason"><span>오탐 사유</span><h3>{reasonName[detail?.review?.falsePositiveReason] || '사유 확인 중'}</h3></div>
    <dl className="admin-review__facts">
      <div><dt><ReviewCardIcon type="camera" />CCTV</dt><dd>{cameraDisplayName(event.cameraId, event.cameraName)}</dd></div>
      <div><dt><ReviewCardIcon type="location" />설치 위치</dt><dd>{event.location || '미등록'}</dd></div>
      <div><dt><ReviewCardIcon type="clock" />감지 시각</dt><dd className="console-mono">{event.detectedAt?.replace('T', ' ') || '미기록'}</dd></div>
      <div><dt><ReviewCardIcon type="person" />검수자</dt><dd>{detail?.review?.reviewerName || '미기록'}</dd></div>
    </dl>
    <section className="admin-review__memo" aria-label="검수 메모 미리보기"><span>검수 메모</span><p>{detail?.review?.note || '등록된 검수 메모가 없습니다.'}</p></section>
    {error && <p role="alert" className="admin-error">{error}</p>}
    <footer className="admin-review__footer"><button onClick={onOpen}>이벤트 상세 보기 <span aria-hidden="true">↗</span></button></footer>
  </article>;
}

function ReviewCardIcon({ type }) {
  const paths = {
    person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M4 21v-2a8 8 0 0 1 16 0v2',
    camera: 'M3 5h12v14H3z M15 10l6-3v10l-6-3',
    location: 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 7v5l3 2',
  };
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[type]} /></svg>;
}
