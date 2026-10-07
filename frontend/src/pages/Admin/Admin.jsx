import { useEffect, useState } from 'react';
import { apiClient, apiError } from '../../api/client.js';
import { Badge, PageHeading } from '../../components/Console/Console.jsx';
import './Admin.css';

const reasonName = { STEAM: '수증기', LIGHT: '빛', REFLECTION: '반사', DUST: '먼지', WELDING: '용접', ETC: '기타' };

export default function Admin() {
  const [tab, setTab] = useState('workers');
  const [workers, setWorkers] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [falseEvents, setFalseEvents] = useState([]);
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
      setCameras(cameraResult.data);
      setFalseEvents(eventResult.data.content);
      setError('');
    }).catch((cause) => { if (active) setError(apiError(cause)); });
    return () => { active = false; };
  }, [revision]);

  async function createWorker(event) {
    event.preventDefault();
    try {
      const { data } = await apiClient.post('/api/admin/workers', { name: name.trim() });
      setName('');
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
  return <main className="console-page admin-page">
    <PageHeading eyebrow="FIRIS ADMIN" title="시스템 관리자 통제 센터"><span className="console-muted">실제 서버 데이터</span></PageHeading>
    {error && <p role="alert" className="console-notice">{error}</p>}
    {notice && <p role="status" className="console-notice">{notice}</p>}
    <nav className="admin-tabs" aria-label="관리 메뉴">
      {[['workers', '작업자 관리', workers.length], ['cameras', 'CCTV 현황', cameras.length], ['reviews', '오탐 검토', falseEvents.length]].map(([id, label, count]) => <button key={id} className={tab === id ? 'admin-tabs__active' : ''} onClick={() => setTab(id)}>{label} <small>{count}</small></button>)}
    </nav>
    {tab === 'workers' && <>
      <section className="console-toolbar"><form onSubmit={createWorker}><label>작업자 이름 <input value={name} onChange={(event) => setName(event.target.value)} maxLength={50} required /></label><button type="submit" className="console-primary">작업자 생성</button></form></section>
      <div className="console-table-wrap"><table className="console-table"><thead><tr><th>로그인 ID</th><th>이름</th><th>상태</th><th>최초 비밀번호 변경</th><th>관리</th></tr></thead><tbody>{workers.map((worker) => <tr key={worker.accountId}><td>{worker.loginId}</td><td>{worker.name}</td><td><Badge tone={worker.status === 'ACTIVE' ? 'green' : 'amber'}>{worker.status}</Badge></td><td>{worker.mustChangePassword ? '필요' : '완료'}</td><td><button onClick={() => changeStatus(worker)}>{worker.status === 'ACTIVE' ? '비활성화' : '활성화'}</button> <button onClick={() => resetPassword(worker)}>비밀번호 초기화</button></td></tr>)}{!workers.length && <tr><td colSpan="5" className="console-empty">등록된 작업자가 없습니다.</td></tr>}</tbody></table></div>
    </>}
    {tab === 'cameras' && <div className="console-table-wrap"><table className="console-table"><thead><tr><th>ID</th><th>이름</th><th>위치</th><th>상태</th><th>영상 주소</th></tr></thead><tbody>{cameras.map((camera) => <tr key={camera.cameraId}><td>{camera.cameraId}</td><td>{camera.cameraName}</td><td>{camera.location}</td><td>{camera.status}</td><td>{camera.streamUrl ? <a href={camera.streamUrl} target="_blank" rel="noreferrer">재생 확인</a> : '미등록'}</td></tr>)}</tbody></table></div>}
    {tab === 'reviews' && <><p className="console-muted">검수 결과가 오탐인 이벤트입니다. 학습 후보 지정 API는 아직 없어 이 화면에서 변경할 수 없습니다.</p><div className="console-table-wrap"><table className="console-table"><thead><tr><th>이벤트 ID</th><th>CCTV</th><th>발생 시각</th><th>상세·오탐 사유</th></tr></thead><tbody>{falseEvents.map((event) => <FalsePositiveRow key={event.eventId} event={event} />)}{!falseEvents.length && <tr><td colSpan="4" className="console-empty">오탐으로 검수된 이벤트가 없습니다.</td></tr>}</tbody></table></div></>}
  </main>;
}

function FalsePositiveRow({ event }) {
  const [detail, setDetail] = useState(null);
  return <tr><td>#{event.eventId}</td><td>{event.cameraName}</td><td>{event.detectedAt?.replace('T', ' ')}</td><td>{detail ? `${reasonName[detail.review?.falsePositiveReason] || '사유 없음'} · ${detail.review?.note || ''}` : <button onClick={async () => { try { const { data } = await apiClient.get(`/api/events/${event.eventId}`); setDetail(data); } catch { setDetail({ review: null }); } }}>사유 보기</button>}</td></tr>;
}
