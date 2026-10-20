export default function Header({ tab, pendingCount, onTabChange }) {
  return (
    <header className="topbar"><div className="brand"><span className="brand-mark">119</span><div><strong>119 CENTER</strong><small>FIRIS 모의 신고 접수센터</small></div></div><nav className="tabs" aria-label="접수센터 메뉴"><button className={tab==='intake'?'active':''} aria-current={tab==='intake'?'page':undefined} onClick={()=>onTabChange('intake')}>신고 접수 <span>{pendingCount}</span></button><button className={tab==='history'?'active':''} aria-current={tab==='history'?'page':undefined} onClick={()=>onTabChange('history')}>신고 이력</button></nav></header>
  );
}
