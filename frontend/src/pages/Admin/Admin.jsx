import { useState } from "react";
import {
  Badge,
  Modal,
  PageHeading,
  downloadFile,
} from "../../components/Console/Console.jsx";
import "./Admin.css";

const MEMBERS_PAGE_SIZE = 4;

const initialUsers = [
  [
    "FR-90214",
    "김진우",
    "jinwoo.kim",
    "통합방재관제팀 / 총괄팀장",
    "시스템 총괄",
    "ACTIVE",
    "010-4829-1192",
    "현재 세션 연결 중",
  ],
  [
    "FR-88412",
    "박성민",
    "sm.park",
    "방재운영 1조 / 선임 관제관",
    "당직 관제관",
    "ACTIVE",
    "010-9941-8172",
    "2025-05-14 08:30:11",
  ],
  [
    "FR-79105",
    "이하은",
    "ha.lee",
    "방재운영 2조 / 관제 주임",
    "당직 관제관",
    "STANDBY",
    "010-3312-9014",
    "2025-05-13 22:15:48",
  ],
  [
    "FR-62940",
    "최현우",
    "hw.choi",
    "기계안전설비반 / 엔지니어",
    "유지보수원",
    "ACTIVE",
    "010-7781-4450",
    "2025-05-14 11:20:05",
  ],
  [
    "FR-55018",
    "윤도경",
    "dk.yoon",
    "네트워크통신망 / 기술원",
    "유지보수원",
    "OFFLINE",
    "010-5209-1830",
    "2025-05-12 17:45:09",
  ],
  [
    "FR-41002",
    "정민호",
    "mh.jung",
    "소방안전처 / 소방시설관리사",
    "당직 관제관",
    "ACTIVE",
    "010-6188-7290",
    "2025-05-14 06:00:18",
  ],
].map(([id, name, email, department, role, status, phone, last]) => ({
  id,
  name,
  email: `${email}@firis.kr`,
  department,
  role,
  status,
  phone,
  last,
}));
const initialCameras = [
  {
    id: "CCTV-01",
    location: "중앙 물류창고 A구역",
    resolution: "4K UHD",
    enabled: true,
  },
  {
    id: "CCTV-02",
    location: "제2 공정 도장라인",
    resolution: "1080p",
    enabled: true,
  },
  {
    id: "CCTV-03",
    location: "원자재 저장고 B동",
    resolution: "1080p",
    enabled: true,
  },
  {
    id: "CCTV-04",
    location: "전기 수변전실 전면",
    resolution: "1080p",
    enabled: true,
  },
  {
    id: "CCTV-05",
    location: "출하장 동측 출입구",
    resolution: "1080p",
    enabled: true,
  },
  {
    id: "CCTV-06",
    location: "옥외 위험물 보관소",
    resolution: "1080p",
    enabled: false,
  },
];
const emptyUser = {
  name: "",
  id: "",
  email: "",
  department: "미지정",
  role: "당직 관제관",
  phone: "",
};
const roles = ["시스템 총괄", "당직 관제관", "유지보수원"];
export default function Admin() {
  const [users, setUsers] = useState(initialUsers);
  const [tab, setTab] = useState("members");
  const [query, setQuery] = useState("");
  const [membersPage, setMembersPage] = useState(1);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyUser);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState(initialCameras);
  const [reviews, setReviews] = useState([
    {
      id: "FP-20250518-001",
      camera: "CCTV-02",
      location: "제2 공정 도장라인",
      reason: "용접 작업 불꽃",
      status: "검토 대기",
    },
    {
      id: "FP-20250517-003",
      camera: "CCTV-05",
      location: "출하장 동측 출입구",
      reason: "차량 배기가스",
      status: "검토 대기",
    },
  ]);
  const [audit, setAudit] = useState([]);
  function record(message) {
    setNotice(message);
    setAudit((prev) => [...prev, { time: new Date().toISOString(), message }]);
  }
  function openEditor(user) {
    setError("");
    setEditor(user ? user.id : "new");
    setForm(user ? { ...user } : { ...emptyUser });
  }
  function saveUser(e) {
    e.preventDefault();
    const clean = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ]),
    );
    if (
      !clean.name ||
      !clean.id ||
      !clean.email ||
      !clean.phone
    ) {
      setError("필수 항목을 모두 입력해 주세요.");
      return;
    }
    if (
      users.some(
        (user) =>
          (editor === "new" || user.id !== editor) &&
          user.id.toLowerCase() === clean.id.toLowerCase(),
      )
    ) {
      setError("이미 등록된 사원번호입니다.");
      return;
    }
    if (
      users.some(
        (user) =>
          (editor === "new" || user.id !== editor) &&
          user.email.toLowerCase() === clean.email.toLowerCase(),
      )
    ) {
      setError("이미 등록된 이메일입니다.");
      return;
    }
    if (editor === "new") {
      setUsers((prev) => [
        ...prev,
        {
          ...clean,
          status: "OFFLINE",
          last: "접속 기록 없음",
        },
      ]);
      record(`${clean.name} 관제관을 등록했습니다.`);
    } else {
      setUsers((prev) =>
        prev.map((user) => (user.id === editor ? { ...user, ...clean } : user)),
      );
      record(`${clean.name} 계정 정보를 수정했습니다.`);
    }
    setEditor(null);
  }
  const filtered = users.filter((user) =>
    `${user.name} ${user.id} ${user.department} ${user.email}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const membersPageCount = Math.max(
    1,
    Math.ceil(filtered.length / MEMBERS_PAGE_SIZE),
  );
  const currentMembersPage = Math.min(membersPage, membersPageCount);
  const membersPageStart = (currentMembersPage - 1) * MEMBERS_PAGE_SIZE;
  const visibleUsers = filtered.slice(
    membersPageStart,
    membersPageStart + MEMBERS_PAGE_SIZE,
  );
  const tabs = [
    ["members", "♙", "회원 관리", String(users.length).padStart(2, "0")],
    ["cameras", "▣", "CCTV 관리", `${cameras.length} CH`],
    [
      "reviews",
      "◎",
      "오탐 관리 및 AI 학습",
      `${reviews.filter((r) => r.status === "검토 대기").length} 대기`,
    ],
    ["stats", "▤", "통계 분석", "KPI"],
  ];
  return (
    <main className="console-page admin-page">
      <PageHeading
        eyebrow="FIRIS ROOT CONSOLE / SECURE LAYER"
        title="시스템 관리자 통제 센터"
      >
        <span className="console-muted">◉ 서버 연결 대기</span>
        <button
          onClick={() => {
            downloadFile(
              "FIRIS-backup.json",
              JSON.stringify(
                { sample: true, users, cameras, reviews },
                null,
                2,
              ),
              "application/json",
            );
            record("현재 설정 백업을 다운로드했습니다.");
          }}
        >
          ♧ 시스템 설정 백업
        </button>
        <button
          onClick={() =>
            downloadFile(
              "FIRIS-audit-log.json",
              JSON.stringify({ sample: true, records: audit }, null, 2),
              "application/json",
            )
          }
        >
          ▤ 감사 로그 내보내기
        </button>
      </PageHeading>
      <nav className="admin-tabs" aria-label="관리 메뉴">
        {tabs.map(([id, icon, label, count]) => (
          <button
            key={id}
            className={tab === id ? "admin-tabs__active" : ""}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <span aria-hidden="true">{icon}</span> {label}{" "}
            <small>{count}</small>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="console-notice" role="status">
          {notice}
        </div>
      )}
      {tab === "members" && (
        <>
          <section className="console-toolbar">
            <div>
              <h2>관제 요원 및 시스템 관리자 계정 목록</h2>
              <p>
                방재 관제 라이선스를 취득한 정식 요원과 보안 관리자의 역할 기반
                접근 제어(RBAC)
              </p>
            </div>
            <div className="console-actions">
              <input
                className="console-search"
                aria-label="관제관 검색"
                placeholder="⌕  성명, 사번, 직책 검색…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setMembersPage(1);
                }}
              />
              <button
                className="console-primary"
                onClick={() => openEditor(null)}
              >
                ♙ 신규 관제관 등록
              </button>
            </div>
          </section>
          <div className="console-table-wrap">
            <table className="console-table admin-table">
              <thead>
                <tr>
                  {[
                    "사번 / UID",
                    "성명",
                    "권한 등급",
                    "세션 상태",
                    "비상 연락처",
                    "최근 접속 기록",
                    "계정 제어",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="console-mono admin-user-id">{user.id}</td>
                    <td>
                      <div className="admin-person">
                        <span
                          className={`admin-avatar ${user.role === "시스템 총괄" ? "admin-avatar--root" : ""}`}
                        >
                          {user.name[0]}
                        </span>
                        <div>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge
                        tone={
                          user.role === "시스템 총괄"
                            ? "red"
                            : user.role === "당직 관제관"
                              ? "amber"
                              : ""
                        }
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td>
                      <span
                        className={`admin-session admin-session--${user.status.toLowerCase()}`}
                      >
                        ● <b>{user.status}</b>
                      </span>
                    </td>
                    <td className="console-mono">{user.phone}</td>
                    <td className="console-mono">
                      {user.last.includes(" ") &&
                      user.last.startsWith("2025") ? (
                        <>
                          {user.last.split(" ")[0]}
                          <small>{user.last.split(" ")[1]}</small>
                        </>
                      ) : (
                        user.last
                      )}
                    </td>
                    <td>
                      <button onClick={() => openEditor(user)}>
                        권한 수정
                      </button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan="7" className="console-empty">
                      검색 조건에 맞는 관제관이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span className="console-muted" aria-live="polite">
              총 {filtered.length}명 중{" "}
              {filtered.length ? membersPageStart + 1 : 0}–
              {Math.min(membersPageStart + MEMBERS_PAGE_SIZE, filtered.length)}
              명 표시
            </span>
            <nav aria-label="회원 목록 페이지">
              <button
                disabled={currentMembersPage === 1}
                onClick={() => setMembersPage(currentMembersPage - 1)}
              >
                ‹ 이전
              </button>
              {Array.from(
                { length: membersPageCount },
                (_, index) => index + 1,
              ).map((number) => (
                <button
                  key={number}
                  aria-label={`${number}페이지`}
                  aria-current={
                    currentMembersPage === number ? "page" : undefined
                  }
                  className={
                    currentMembersPage === number ? "console-primary" : ""
                  }
                  disabled={!filtered.length}
                  onClick={() => setMembersPage(number)}
                >
                  {number}
                </button>
              ))}
              <button
                disabled={currentMembersPage === membersPageCount}
                onClick={() => setMembersPage(currentMembersPage + 1)}
              >
                다음 ›
              </button>
            </nav>
          </div>
        </>
      )}
      {tab === "cameras" && (
        <>
          <section className="console-toolbar">
            <div>
              <h2>CCTV 채널 및 관제 구역 관리</h2>
              <p>채널별 감지 활성화 설정 · 스트림 연결 대기</p>
            </div>
            <Badge tone="amber">
              {cameras.filter((c) => c.enabled).length} / {cameras.length} 활성
            </Badge>
          </section>
          <div className="console-table-wrap">
            <table className="console-table">
              <thead>
                <tr>
                  {[
                    "채널 ID",
                    "설치 위치",
                    "해상도",
                    "감지 설정",
                    "채널 제어",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cameras.map((camera) => (
                  <tr key={camera.id}>
                    <td className="console-mono">{camera.id}</td>
                    <td>{camera.location}</td>
                    <td>{camera.resolution}</td>
                    <td>
                      <Badge tone={camera.enabled ? "green" : ""}>
                        {camera.enabled ? "감지 활성" : "감지 비활성"}
                      </Badge>
                    </td>
                    <td>
                      <button
                        aria-label={`${camera.id} 감지 ${camera.enabled ? "중지" : "활성화"}`}
                        onClick={() => {
                          setCameras((prev) =>
                            prev.map((c) =>
                              c.id === camera.id
                                ? { ...c, enabled: !c.enabled }
                                : c,
                            ),
                          );
                          record(
                            `${camera.id} 감지 설정을 변경했습니다.`,
                          );
                        }}
                      >
                        {camera.enabled ? "감지 중지" : "감지 활성화"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "reviews" && (
        <>
          <section className="console-toolbar">
            <div>
              <h2>오탐 검토 및 학습 데이터 관리</h2>
              <p>
                오탐 원인을 검토하고 학습 데이터 포함 여부를 지정합니다. 실제 AI
                학습은 서버 연동 후 지원됩니다.
              </p>
            </div>
          </section>
          <div className="admin-review-grid">
            {reviews.map((review) => (
              <article className="console-panel admin-review" key={review.id}>
                <div>
                  <span className="console-mono">{review.id}</span>
                  <Badge
                    tone={review.status === "검토 대기" ? "amber" : "green"}
                  >
                    {review.status}
                  </Badge>
                </div>
                <h3>{review.reason}</h3>
                <p>
                  {review.camera} · {review.location}
                </p>
                <button
                  disabled={review.status !== "검토 대기"}
                  onClick={() => {
                    setReviews((prev) =>
                      prev.map((r) =>
                        r.id === review.id
                          ? { ...r, status: "학습 후보 지정" }
                          : r,
                      ),
                    );
                    record(`${review.id}을 학습 후보로 지정했습니다.`);
                  }}
                >
                  ✓ 학습 후보로 지정
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {tab === "stats" && (
        <>
          <section className="console-toolbar">
            <div>
              <h2>관제 운영 통계</h2>
              <p>현재 화면의 계정 및 관리 설정을 기준으로 집계합니다.</p>
            </div>
          </section>
          <div className="admin-stats">
            {[
              ["등록 관제 요원", users.length, "명"],
              [
                "활성 세션",
                users.filter((u) => u.status === "ACTIVE").length,
                "개",
              ],
              ["활성 CCTV", cameras.filter((c) => c.enabled).length, "채널"],
              [
                "오탐 검토 대기",
                reviews.filter((r) => r.status === "검토 대기").length,
                "건",
              ],
            ].map(([label, value, unit]) => (
              <article className="console-panel" key={label}>
                <span>{label}</span>
                <strong>
                  {value}
                  <small>{unit}</small>
                </strong>
              </article>
            ))}
          </div>
          <section className="console-panel admin-role-stats">
            <h3>권한별 계정 분포</h3>
            {roles.map((role) => (
              <div key={role}>
                <span>{role}</span>
                <meter
                  min="0"
                  max={users.length}
                  value={users.filter((u) => u.role === role).length}
                />
                <b>{users.filter((u) => u.role === role).length}명</b>
              </div>
            ))}
          </section>
        </>
      )}
      <footer className="console-foot">
        <span>서버 연결 대기 · 변경 사항은 페이지를 나가면 초기화됩니다.</span>
        <span>FIRIS / ACCESS CONTROL SYSTEM</span>
      </footer>
      {editor && (
        <Modal
          title={
            editor === "new" ? "신규 관제관 등록" : "관제관 계정 및 권한 수정"
          }
          subtitle="PERSONNEL ACCESS MANAGEMENT"
          onClose={() => setEditor(null)}
        >
          <form onSubmit={saveUser}>
            <div className="console-modal__body console-form">
              {(editor === "new"
                ? [
                    ["name", "이름", "text"],
                    ["id", "사원번호", "text"],
                    ["email", "이메일", "email"],
                    ["phone", "연락처", "tel"],
                  ]
                : [
                    ["name", "성명", "text"],
                    ["email", "이메일", "email"],
                    ["phone", "비상 연락처", "tel"],
                  ]
              ).map(([key, label, type]) => (
                <label key={key}>
                  {label}
                  <input
                    required
                    maxLength={100}
                    type={type}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              {editor !== "new" && (
                <label>
                  권한 등급
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    {roles.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                </label>
              )}
              <p className="console-muted">
                서버 연결 대기 중입니다. 실제 계정 생성 및 접근 권한은 변경되지
                않습니다.
              </p>
              {error && (
                <p role="alert" className="admin-error">
                  {error}
                </p>
              )}
            </div>
            <footer className="console-modal__footer">
              <button type="button" onClick={() => setEditor(null)}>
                취소
              </button>
              <button type="submit" className="console-primary">
                {editor === "new" ? "관제관 등록" : "변경 사항 저장"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </main>
  );
}
