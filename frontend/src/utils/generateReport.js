import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Brand colors
const C = {
  purple:    [74,  14, 143],
  purpleHex: '#4A0E8F',
  gold:      [201, 168, 76],
  goldHex:   '#C9A84C',
  green:     [27,  94, 32],
  dark:      [30,  41, 59],
  gray:      [148, 163, 184],
  light:     [248, 250, 252],
  white:     [255, 255, 255],
  red:       [153, 80,  80],
};

// Handles numbers, numeric strings, null, undefined and 0 safely
const toNum = v => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const fmt = v => `R$ ${toNum(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const fmtMonth = m => {
  const label = format(new Date(m + '-02'), 'MMMM/yyyy', { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

async function loadLogoBase64(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth  || img.width  || 1;
        canvas.height = img.naturalHeight || img.height || 1;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('[generateReport] Falha ao converter logo:', e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url + '?t=' + Date.now();
  });
}

export async function generateMonthlyReport(data) {
  console.log('[generateReport] Dados recebidos:', JSON.stringify(data, null, 2));

  try {
    const {
      accounting = {},
      month = '',
      payment = null,
      summary = {},
      by_employee = [],
      referrals = [],
    } = data || {};

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W   = doc.internal.pageSize.getWidth();
    const H   = doc.internal.pageSize.getHeight();

    const logoBase64 = await loadLogoBase64('/logo-header.png');

    // ── HEADER BAND ──────────────────────────────────────────────────────────
    doc.setFillColor(...C.purple);
    doc.rect(0, 0, W, 40, 'F');

    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 10, 7, 40, 0);
      } catch (e) {
        console.warn('[generateReport] Falha ao inserir logo:', e);
      }
    }

    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Relatorio Mensal de Comissoes', W / 2, 17, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(fmtMonth(month), W / 2, 26, { align: 'center' });

    // Gold accent line
    doc.setFillColor(...C.gold);
    doc.rect(0, 40, W, 1.5, 'F');

    // ── PARTNER INFO BOX ─────────────────────────────────────────────────────
    let y = 50;
    doc.setFillColor(...C.light);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(10, y, W - 20, 24, 2, 2, 'FD');

    doc.setTextColor(...C.dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(accounting.name || '', 16, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.gray);
    doc.text(`Codigo: ${accounting.code || ''}`, 16, y + 14);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy')}`, 16, y + 20);

    if (payment) {
      const datePay = format(new Date(payment.payment_date + 'T12:00:00'), 'dd/MM/yyyy');
      doc.text(`Pagamento PIX registrado: ${datePay}`, W / 2, y + 14);
      doc.setTextColor(...C.green);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(fmt(payment.amount), W - 14, y + 11, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.gray);
      doc.text('recebido via PIX', W - 14, y + 17, { align: 'right' });
    } else {
      doc.setTextColor(180, 120, 30);
      doc.text('Pagamento ainda nao registrado neste mes', W / 2, y + 14);
    }

    y += 32;

    // ── FINANCIAL SUMMARY ────────────────────────────────────────────────────
    doc.setTextColor(...C.purple);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Resumo Financeiro', 14, y);

    doc.setFillColor(...C.gold);
    doc.circle(11, y - 1, 1.2, 'F');

    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: 10, right: 10 },
      tableWidth: W - 20,
      head: [['Descricao', 'Valor', '%']],
      showHead: 'never',
      body: [
        ['Total bruto da comissao (100%)',                      fmt(summary.total_bruto),       '100%'],
        ['Valor a repassar aos funcionarios',                   fmt(summary.funcionario_total), '51%' ],
        ['Valor liquido da contabilidade',                      fmt(summary.contabilidade_net), '34%' ],
        ['Imposto retido - responsabilidade da contabilidade',  fmt(summary.imposto),           '15%' ],
      ],
      columnStyles: {
        0: { cellWidth: 'auto', textColor: C.dark, fontSize: 8.5 },
        1: { cellWidth: 42, textColor: C.green, fontStyle: 'bold', halign: 'right', fontSize: 9 },
        2: { cellWidth: 18, textColor: C.gray, halign: 'center', fontSize: 8 },
      },
      styles: { cellPadding: 2.8, lineColor: [226, 232, 240], lineWidth: 0.2 },
      alternateRowStyles: { fillColor: C.light },
      rowPageBreak: 'avoid',
    });

    y = (doc.lastAutoTable && doc.lastAutoTable.finalY != null)
      ? doc.lastAutoTable.finalY + 10
      : y + 50;

    // ── BY-EMPLOYEE TABLE ─────────────────────────────────────────────────────
    if (Array.isArray(by_employee) && by_employee.length > 0) {
      doc.setTextColor(...C.purple);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Resumo por Funcionario', 14, y);
      doc.setFillColor(...C.gold);
      doc.circle(11, y - 1, 1.2, 'F');
      y += 4;

      const empTotalRow = ['', '', `${by_employee.reduce((s, e) => s + (e.count || 0), 0)} total`, fmt(summary.funcionario_total)];

      autoTable(doc, {
        startY: y,
        margin: { left: 10, right: 10 },
        tableWidth: W - 20,
        head: [['Nome', 'Codigo', 'Qtd. Indicacoes', 'Total a Repassar']],
        body: [
          ...by_employee.map(e => [
            e.name || '',
            e.code || '',
            String(e.count || 0),
            fmt(e.total),
          ]),
          empTotalRow,
        ],
        headStyles: { fillColor: C.purple, textColor: C.white, fontSize: 8.5, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 'auto', fontSize: 8.5 },
          1: { cellWidth: 35, fontStyle: 'bold', textColor: C.gold, fontSize: 8.5 },
          2: { cellWidth: 28, halign: 'center', fontSize: 8.5 },
          3: { cellWidth: 40, halign: 'right', textColor: C.green, fontStyle: 'bold', fontSize: 9 },
        },
        styles: { cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.2 },
        alternateRowStyles: { fillColor: C.light },
        didParseCell: (hook) => {
          if (hook.row.index === by_employee.length) {
            hook.cell.styles.fontStyle = 'bold';
            hook.cell.styles.fillColor = [235, 228, 252];
            hook.cell.styles.textColor = C.purple;
          }
        },
        rowPageBreak: 'avoid',
      });

      y = (doc.lastAutoTable && doc.lastAutoTable.finalY != null)
        ? doc.lastAutoTable.finalY + 10
        : y + 50;
    }

    // ── DETAILED REFERRALS TABLE ──────────────────────────────────────────────
    if (y > H - 70) { doc.addPage(); y = 15; }

    doc.setTextColor(...C.purple);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Detalhamento por Indicacao', 14, y);
    doc.setFillColor(...C.gold);
    doc.circle(11, y - 1, 1.2, 'F');
    y += 4;

    if (!Array.isArray(referrals) || referrals.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...C.gray);
      doc.text('Nenhuma indicacao encontrada neste periodo.', 14, y + 6);
      y += 14;
    } else {
      autoTable(doc, {
        startY: y,
        margin: { left: 10, right: 10 },
        tableWidth: W - 20,
        head: [['Protocolo', 'Cliente', 'Produto', 'Funcionario', 'Vl. Operado', 'Comissao', 'Func. 51%', 'Cont. 34%', 'Imp. 15%']],
        body: referrals.map(r => [
          r.protocol || '',
          r.client_name || '',
          r.product_name || '',
          r.employee_name || '',
          toNum(r.operated_value) > 0 ? fmt(r.operated_value) : '-',
          fmt(r.total_commission),
          fmt(r.funcionario_51),
          fmt(r.contabilidade_34),
          fmt(r.imposto_15),
        ]),
        headStyles: { fillColor: C.purple, textColor: C.white, fontSize: 7, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 2 },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold', textColor: C.gold },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 28 },
          3: { cellWidth: 24 },
          4: { cellWidth: 18, halign: 'right' },
          5: { cellWidth: 18, halign: 'right', textColor: C.dark, fontStyle: 'bold' },
          6: { cellWidth: 16, halign: 'right', textColor: C.green },
          7: { cellWidth: 16, halign: 'right' },
          8: { cellWidth: 14, halign: 'right', textColor: C.red },
        },
      });
    }

    // ── FOOTER ON ALL PAGES ───────────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      const fy = H - 14;
      doc.setFillColor(...C.light);
      doc.rect(0, fy - 3, W, 17, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(0, fy - 3, W, fy - 3);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.gray);
      doc.text(
        'Este relatorio detalha a distribuicao da comissao paga pelo Grupo Movv. ' +
        'A contabilidade e responsavel por repassar a parcela do funcionario e pelos tributos sobre o servico.',
        W / 2, fy + 1, { align: 'center', maxWidth: W - 24 }
      );
      doc.text(`Contato: (64) 99325-2996  |  Grupo Movv Itumbiara/GO  |  Pagina ${i} de ${totalPages}`, W / 2, fy + 6, { align: 'center' });
    }

    // Save
    doc.save(`relatorio-comissoes-${accounting.code || 'sem-codigo'}-${month}.pdf`);
    console.log('[generateReport] PDF gerado com sucesso.');

  } catch (err) {
    console.error('[generateReport] ERRO ao gerar PDF:', err);
    console.error('[generateReport] Stack:', err?.stack);
    throw err;
  }
}
