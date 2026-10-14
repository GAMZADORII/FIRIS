export const isAdministrator = (role) => role === 'SUPER_ADMIN' || role === 'ADMIN';
export const roleLabel = (role) => ({ SUPER_ADMIN: '최고 관리자', ADMIN: '관리자', WORKER: '작업자' })[role] || '사용자';
