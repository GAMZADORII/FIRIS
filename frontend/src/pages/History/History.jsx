import { useState } from "react";
import {
  Badge,
  Modal,
  PageHeading,
  downloadFile,
} from "../../components/Console/Console.jsx";
import camera1 from "../../assets/images/cctv/cctv-01.png";
import camera2 from "../../assets/images/cctv/cctv-02.png";
import "./History.css";

const PAGE_SIZE = 3;

const initialEvents = [
  ["004", "2025-05-18 14:32:01", "화재", "대응 중", "98.4", "김진우"],
  ["003", "2025-05-18 11:24:18", "연기", "확인 대기", "94.2", "박성민"],
  ["002", "2025-05-18 09:16:42", "화재", "처리 완료", "96.8", "이하은"],
  ["001", "2025-05-18 08:03:11", "연기", "오탐", "72.1", "김진우"],
  ["002", "2025-05-17 17:42:08", "연기", "처리 완료", "91.7", "박성민"],
  ["001", "2025-05-17 10:15:32", "화재", "처리 완료", "97.3", "이하은"],
].map(([id, time, type, status, confidence, person]) => ({
  id: `EVT-${time.slice(0, 10).replaceAll("-", "")}-${id}`,
  time,
  type,
  status,
  confidence,
  person,
  camera: type === "화재" ? "CCTV-01" : "CCTV-02",
  location: type === "화재" ? "중앙 물류창고 A구역" : "제2 공정 도장라인",
}));
const tone = (status) =>
  status === "대응 중"
    ? "red"
    : status === "확인 대기"
      ? "amber"
      : status === "처리 완료"
        ? "green"
        : "";
export default function History() {
  const [events, setEvents] = useState(initialEvents);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("전체");
  const [status, setStatus] = useState("전체");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [page, setPage] = useState(1);
  const selected = events.find((e) => e.id === selectedId);
  const filtered = events.filter(
    (e) =>
      `${e.id} ${e.location} ${e.camera}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (type === "전체" || e.type === type) &&
      (status === "전체" || e.status === status) &&
      (!start || e.time.slice(0, 10) >= start) &&
      (!end || e.time.slice(0, 10) <= end),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleEvents = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const updateStatus = (next) => {
    setPage(1);
    setEvents(
      events.map((e) => (e.id === selectedId ? { ...e, status: next } : e)),
    );
  };
  const exportEvents = () =>
    downloadFile(
      "FIRIS-이벤트-이력.csv",
      [
        "이벤트 ID,발생 시각,채널,위치,유형,신뢰도,상태,담당자",
        ...filtered.map((e) =>
          [
            e.id,
            e.time,
            e.camera,
            e.location,
            e.type,
            e.confidence,
            e.status,
            e.person,
          ].join(","),
        ),
      ].join("\r\n"),
      "text/csv;charset=utf-8",
    );
  return (
    <main className="console-page history-page">
      <PageHeading
        eyebrow="FIRIS EVENT ARCHIVE / INCIDENT INTELLIGENCE"
        title="이벤트 이력 조회"
      >
        <span className="console-muted">샘플 데이터 · KST 기준</span>
        <button onClick={exportEvents}>↓ 이력 내보내기</button>
      </PageHeading>
      <section className="history-summary" aria-label="이벤트 요약">
        {[
          ["전체 이벤트", events.length, "TOTAL EVENTS"],
          [
            "화재 감지",
            events.filter((e) => e.type === "화재").length,
            "FIRE DETECTED",
          ],
          [
            "확인 대기",
            events.filter((e) => e.status === "확인 대기").length,
            "AWAITING REVIEW",
          ],
          [
            "처리 완료",
            events.filter((e) => e.status === "처리 완료").length,
            "RESOLVED",
          ],
        ].map(([label, value, english], i) => (
          <article
            key={label}
            className={`history-summary__card history-summary__card--${i}`}
          >
            <span>{label}</span>
            <strong>
              {String(value).padStart(2, "0")}
              <small>건</small>
            </strong>
            <p>{english}</p>
          </article>
        ))}
      </section>
      <section
        className="console-toolbar history-filters"
        aria-label="이벤트 검색"
        onChange={() => setPage(1)}
      >
        <label>
          조회 기간
          <div className="history-date-range">
            <input
              aria-label="조회 시작일"
              type="date"
              value={start}
              max={end || undefined}
              onChange={(e) => setStart(e.target.value)}
            />
            <span>—</span>
            <input
              aria-label="조회 종료일"
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </label>
        <label>
          감지 유형
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {["전체", "화재", "연기"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          처리 상태
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["전체", "확인 대기", "대응 중", "처리 완료", "오탐"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="history-filters__search">
          이벤트 검색
          <input
            placeholder="이벤트 ID, 위치, CCTV 검색…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          onClick={() => {
            setQuery("");
            setType("전체");
            setStatus("전체");
            setStart("");
            setEnd("");
            setPage(1);
          }}
        >
          초기화
        </button>
      </section>
      <div className="history-list-heading">
        <h2>
          감지 이벤트 목록 <span>{filtered.length} RECORDS</span>
        </h2>
        <span className="console-muted">최신 발생 순</span>
      </div>
      <div className="console-table-wrap">
        <table className="console-table">
          <thead>
            <tr>
              {[
                "이벤트 ID / 발생 시각",
                "감지 유형",
                "감지 위치 / 채널",
                "AI 신뢰도",
                "처리 상태",
                "담당 요원",
                "상세 기록",
              ].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleEvents.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong className="console-mono">{e.id}</strong>
                  <small className="console-mono">{e.time}</small>
                </td>
                <td>
                  <Badge tone={e.type === "화재" ? "red" : "amber"}>
                    ◆ {e.type} 감지
                  </Badge>
                </td>
                <td>
                  {e.location}
                  <small>{e.camera}</small>
                </td>
                <td className="console-mono">
                  {e.confidence}%
                  <div className="history-confidence">
                    <i style={{ width: `${e.confidence}%` }} />
                  </div>
                </td>
                <td>
                  <Badge tone={tone(e.status)}>{e.status}</Badge>
                </td>
                <td>{e.person}</td>
                <td>
                  <button onClick={() => setSelectedId(e.id)}>
                    리포트 열기 ↗
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan="7" className="console-empty">
                  검색 조건에 맞는 이벤트가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="history-pagination">
        <span className="console-muted" aria-live="polite">
          총 {filtered.length}건 중 {filtered.length ? pageStart + 1 : 0}
          –{Math.min(pageStart + PAGE_SIZE, filtered.length)}건 표시
        </span>
        <nav aria-label="이벤트 목록 페이지">
          <button
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            ‹ 이전
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(
            (number) => (
              <button
                key={number}
                aria-label={`${number}페이지`}
                aria-current={currentPage === number ? "page" : undefined}
                className={currentPage === number ? "console-primary" : ""}
                disabled={!filtered.length}
                onClick={() => setPage(number)}
              >
                {number}
              </button>
            ),
          )}
          <button
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            다음 ›
          </button>
        </nav>
      </div>
      <footer className="console-foot">
        <span>
          총 {filtered.length}건 · 샘플 변경 사항은 페이지를 나가면
          초기화됩니다.
        </span>
        <span>FIRIS / EVENT AUDIT LOG</span>
      </footer>
      {selected && (
        <Modal
          wide
          title={`${selected.type === "화재" ? "긴급 화재" : "연기"} 감지 상세 리포트`}
          subtitle={`MISSION CRITICAL INCIDENT LOG / ${selected.id}`}
          onClose={() => setSelectedId(null)}
        >
          <div className="console-modal__body">
            <div className="history-report-meta">
              <span>분석 화면 캡처 · 샘플 이미지</span>
              <span>
                {selected.camera} / {selected.time}
              </span>
            </div>
            <div className="history-report-grid">
              <div className="history-capture">
                <img
                  src={selected.type === "화재" ? camera1 : camera2}
                  alt={`${selected.location} CCTV 샘플 화면`}
                />
                <span className="history-capture__label">
                  ◉ SAMPLE ANALYSIS
                </span>
                <div className="history-target">
                  <span>
                    TARGET: {selected.type === "화재" ? "FLAME" : "SMOKE"}
                    <br />
                    {selected.confidence}%
                  </span>
                </div>
                <small>{selected.location}</small>
              </div>
              <div className="history-telemetry">
                <p>현장 센서 관측 계측치 (TELEMETRY)</p>
                <div className="history-metrics">
                  {[
                    [
                      "감지 최고 온도",
                      selected.type === "화재" ? "182" : "48",
                      "°C",
                    ],
                    ["감지 풍속", "1.8", "m/s"],
                    ["발화 추정 좌표", "[X:42, Y:78]", ""],
                    ["AI 분석 신뢰도", selected.confidence, "%"],
                  ].map(([label, value, unit]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>
                        {value}
                        <small>{unit}</small>
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="history-assignee">
                  <span>
                    ●　{selected.person}
                    <small>현장 담당 관제 요원</small>
                  </span>
                  <Badge tone={tone(selected.status)}>{selected.status}</Badge>
                </div>
              </div>
            </div>
            <section className="history-timeline">
              <div>
                <h3>◷ 사고 대응 블랙박스 기록</h3>
                <span>KST TIMESTAMP / SAMPLE</span>
              </div>
              <ol>
                <li>
                  <time>{selected.time.slice(11)}</time>
                  <strong>{selected.type} 패턴 포착</strong>
                  <small>CCTV 영상 분석 시작</small>
                </li>
                <li>
                  <time>+ 00:04</time>
                  <strong>AI 교차 검증 완료</strong>
                  <small>신뢰도 {selected.confidence}% 기록</small>
                </li>
                <li>
                  <time>+ 00:09</time>
                  <strong>관제 이벤트 생성</strong>
                  <small>담당 요원 {selected.person}</small>
                </li>
                <li className="history-timeline__current">
                  <time>현재 상태</time>
                  <strong>{selected.status}</strong>
                  <small>관제 요원 확인 기록</small>
                </li>
              </ol>
            </section>
            <p className="console-muted">
              샘플 리포트입니다. 상태 변경은 현재 화면에만 반영됩니다.
            </p>
          </div>
          <footer className="console-modal__footer">
            <button
              onClick={() => updateStatus("오탐")}
              disabled={selected.status === "오탐"}
            >
              오탐 처리로 변경
            </button>
            <button
              onClick={() =>
                downloadFile(
                  `${selected.id}.txt`,
                  `FIRIS 사고 상세 리포트 (샘플)\n${Object.entries(selected)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("\n")}`,
                )
              }
            >
              ↓ 리포트 다운로드
            </button>
            <button onClick={() => setSelectedId(null)}>창 닫기</button>
            <button
              className="console-primary"
              onClick={() => updateStatus("처리 완료")}
              disabled={selected.status === "처리 완료"}
            >
              ✓ 조치 완료 처리
            </button>
          </footer>
        </Modal>
      )}
    </main>
  );
}
