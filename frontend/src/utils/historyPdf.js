import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import fontUrl from '../assets/fonts/NanumGothic-Regular.ttf?url';

let fontData;
async function loadFont() {
  if (!fontData) {
    fontData = fetch(fontUrl).then(async (response) => {
      if (!response.ok) throw new Error('PDF 한글 글꼴을 불러오지 못했습니다.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      }
      return btoa(binary);
    }).catch((error) => { fontData = undefined; throw error; });
  }
  return fontData;
}

export async function createHistoryPdf({ rows, filters, generatedAt = new Date() }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('NanumGothic-Regular.ttf', await loadFont());
  doc.addFont('NanumGothic-Regular.ttf', 'NanumGothic', 'normal');
  doc.setFont('NanumGothic', 'normal');
  doc.setProperties({ title: 'FIRIS 이벤트 이력', creator: 'FIRIS' });
  const created = generatedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
  doc.setFontSize(18);
  doc.text('FIRIS 이벤트 이력', 12, 16);
  doc.setFontSize(9);
  doc.text(`총 ${rows.length}건 · 생성 시각: ${created} (KST)`, 12, 24);
  const filterLines = doc.splitTextToSize(`조회 조건: ${filters}`, 273);
  doc.text(filterLines, 12, 30);
  autoTable(doc, {
    startY: 34 + filterLines.length * 4,
    margin: { top: 12, right: 12, bottom: 16, left: 12 },
    head: [['이벤트 ID', '발생 시각', '채널', '위치', '유형', '신뢰도', '상태']],
    body: rows.length ? rows : [[{ content: '검색 조건에 맞는 이벤트가 없습니다.', colSpan: 7 }]],
    styles: { font: 'NanumGothic', fontStyle: 'normal', fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fontStyle: 'normal', fillColor: [24, 45, 62] },
    columnStyles: { 0: { cellWidth: 27 }, 1: { cellWidth: 45 }, 2: { cellWidth: 26 }, 4: { cellWidth: 25 }, 5: { cellWidth: 23 }, 6: { cellWidth: 27 } },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
  });
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('NanumGothic', 'normal');
    doc.setFontSize(9);
    doc.text(`${page} / ${pageCount}`, 285, 203, { align: 'right' });
  }
  return doc;
}
