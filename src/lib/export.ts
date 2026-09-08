import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// Utility to trigger file download
function triggerDownload(data: any, fileName: string, fileType: string) {
  const blob = new Blob([data], { type: fileType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Helper to sanitize position names for PDF
const sanitizePosition = (pos: string) => {
    if (!pos) return '-';
    return pos.replace('PPPK Paruh Waktu (PW)', 'PPPK PW');
};

// --- SUMMARY EXCEL EXPORT --- //
export function exportToExcel(
  summaryData: { [key: string]: any[] },
  currentMonth: Date,
  activeTab: string
) {
  try {
    const monthName = currentMonth.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    const tabName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    const fileName = `Laporan Kehadiran - ${tabName} - ${monthName}.xlsx`;

    const dataToExport = summaryData[activeTab] || [];

    if (dataToExport.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const worksheetData = dataToExport.map((user, index) => ({
      'No.': user.sequenceNumber || index + 1,
      'Nama': user.name,
      'NIP': user.nip || '-',
      'Status': user.position || '-',
      'Hadir': user.hadir,
      'Izin': user.izin,
      'Sakit': user.sakit,
      'Alpa': user.alpa,
      'Persen': user.presentasi,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tabName);

    const colWidths = [
        { wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 8 }, 
        { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }
    ];
    worksheet['!cols'] = colWidths;

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    triggerDownload(excelBuffer, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  } catch (error) {
    console.error("Error exporting to Excel:", error);
    alert("Terjadi kesalahan saat mengekspor ke Excel. Silakan coba lagi.");
  }
}

// --- SUMMARY PDF EXPORT --- //
export function exportToPdf(
  summaryData: { [key: string]: any[] },
  currentMonth: Date,
  activeTab: string,
  reportConfig: any,
  academicYearOverride?: string,
  monthlyConfig?: any
) {
    try {
        const monthName = currentMonth.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
        const tabName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
        const fileName = `Laporan_Kehadiran_${tabName}_${monthName.replace(/\s+/g, '_')}.pdf`;
        
        const dataToExport = summaryData[activeTab] || [];
        if (dataToExport.length === 0) {
            alert('Tidak ada data untuk diekspor.');
            return;
        }

        const doc = new jsPDF();
        const pageCenter = doc.internal.pageSize.getWidth() / 2;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;

        const config = reportConfig || {};
        const mConfig = monthlyConfig || {};
        const instansi = (config.governmentAgency || 'PEMERINTAH KABUPATEN MANGGARAI').toUpperCase();
        const dinas = (config.educationAgency || 'DINAS PENDIDIKAN, KEPEMUDAAN DAN OLAHRAGA').toUpperCase();
        const sekolah = (config.schoolName || 'SMP NEGERI 5 LANGKE REMBONG').toUpperCase();
        const alamat = config.address || 'Alamat Sekolah';
        const kotaLaporan = config.reportCity || 'Mando';
        const namaKepsek = config.headmasterName || 'Lodovikus Jangkar, S.Pd.Gr';
        const nipKepsek = config.headmasterNip || '198507272011011020';
        const tahunAjaran = academicYearOverride || config.academicYear || '-';
        const footerNote = config.reportFooterNote || 'Dokumen absensi ini adalah dokumen resmi yang dibuat secara otomatis oleh aplikasi.';

        // Header (Kop Surat)
        doc.setFont('times', 'bold').setFontSize(14);
        doc.text(instansi, pageCenter, 15, { align: 'center' });
        doc.text(dinas, pageCenter, 21, { align: 'center' });
        doc.setFontSize(12);
        doc.text(sekolah, pageCenter, 28, { align: 'center' });
        doc.setFont('times', 'normal').setFontSize(9);
        doc.text(`Alamat: ${alamat}`, pageCenter, 34, { align: 'center' });
        doc.setLineWidth(0.8).line(margin, 38, pageWidth - margin, 38);
        doc.setLineWidth(0.2).line(margin, 38.8, pageWidth - margin, 38.8);

        // Judul Laporan
        doc.setFont('times', 'bold').setFontSize(12);
        doc.text('LAPORAN KEHADIRAN GURU/TENDIK', pageCenter, 48, { align: 'center' });
        doc.text(`Bulan ${monthName}`, pageCenter, 54, { align: 'center' });
        doc.setFontSize(10).setFont('times', 'normal');
        doc.text(`Tahun Ajaran: ${tahunAjaran}`, pageCenter, 60, { align: 'center' });

        let currentY = 68;
        const tableHead = [['No', 'Nama', 'NIP', 'Status', 'Hadir', 'Izin', 'Sakit', 'Alpa', '%']];
        const tableRows = dataToExport.map((user, index) => [
            user.sequenceNumber || index + 1,
            user.name,
            user.nip || '-',
            sanitizePosition(user.position || '-'),
            user.hadir, 
            user.izin, 
            user.sakit, 
            user.alpa, 
            user.presentasi
        ]);

        (doc as any).autoTable({
            startY: currentY,
            head: tableHead,
            body: tableRows,
            theme: 'striped',
            margin: { bottom: 65 },
            headStyles: { 
                fillColor: [52, 152, 219], 
                textColor: 255, 
                fontStyle: 'bold', 
                halign: 'center',
                valign: 'middle',
                minCellHeight: 12,
                lineWidth: 0
            },
            alternateRowStyles: {
                fillColor: [225, 242, 254] 
            },
            styles: { 
              cellPadding: 1.0,
              fontSize: 10,
              font: 'times', 
              textColor: [0, 0, 0],
              lineColor: [200, 200, 200], 
              lineWidth: 0,
              valign: 'middle',
              fillColor: [248, 250, 252]
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 8 },
                1: { halign: 'left', cellWidth: 'auto' }, 
                2: { halign: 'left', cellWidth: 36 }, 
                3: { halign: 'center', cellWidth: 14 }, 
                4: { halign: 'center', cellWidth: 13 },
                5: { halign: 'center', cellWidth: 10 },
                6: { halign: 'center', cellWidth: 13 },
                7: { halign: 'center', cellWidth: 10 },
                8: { halign: 'right', cellWidth: 15 }
            }
        });

        // --- SMART BOTTOM ANCHOR LOGIC ---
        const footerLineY = pageHeight - 15;
        const bottomSafeLimit = footerLineY - 2; 
        const signatureHeight = 45;
        const notesLineHeight = 4;
        const labelAreaHeight = 16; 
        
        let totalNotesHeight = 0;
        const processedNotes = [];
        if (mConfig.isHolidayNotesActive && mConfig.holidayNotes) {
            mConfig.holidayNotes.forEach((n: any, idx: number) => {
                const text = `${idx + 1}. Tanggal ${n.date || '-'}: ${n.content || '-'}`;
                const split = doc.splitTextToSize(text, pageWidth - (margin * 2));
                totalNotesHeight += (split.length * notesLineHeight);
                processedNotes.push({ split, isRed: n.isRed });
            });
        }

        const notesBlockTotalHeight = mConfig.isHolidayNotesActive ? (labelAreaHeight + totalNotesHeight) : 0;
        const currentTableEndY = (doc as any).lastAutoTable.finalY;

        let closureStartY;
        if (currentTableEndY + signatureHeight + notesBlockTotalHeight + 10 > bottomSafeLimit) {
            doc.addPage();
            closureStartY = 20;
        } else {
            closureStartY = currentTableEndY + 10;
        }

        // Render Signature (Top part of closure)
        const signatureX = pageWidth - 85;
        const todayStr = format(new Date(), 'd MMMM yyyy', { locale: id });
        doc.setTextColor(0, 0, 0).setFontSize(10).setFont('times', 'normal').text(`${kotaLaporan}, ${todayStr}`, signatureX, closureStartY);
        doc.text('Mengetahui,', signatureX, closureStartY + 6);
        doc.text('Kepala Sekolah', signatureX, closureStartY + 12);
        doc.setFont('times', 'bold').text(namaKepsek, signatureX, closureStartY + 38);
        doc.setFont('times', 'normal').text(`NIP. ${nipKepsek}`, signatureX, closureStartY + 44);

        // Render Notes (ANCHORED TO BOTTOM LINE)
        if (mConfig.isHolidayNotesActive) {
            const listItemsStartY = bottomSafeLimit - totalNotesHeight;
            const labelsStartY = listItemsStartY - labelAreaHeight + 2;

            doc.setTextColor(0, 0, 0).setFontSize(10).setFont('times', 'bold').text(`Hari Kerja Efektif: ${mConfig.manualWorkDays || '-'} Hari`, margin, labelsStartY);
            doc.text('Keterangan Hari Libur:', margin, labelsStartY + 7.5);

            let noteCursorY = listItemsStartY;
            processedNotes.forEach((note) => {
                if (note.isRed) doc.setTextColor(255, 0, 0).setFont('times', 'bold');
                else doc.setTextColor(0, 0, 0).setFont('times', 'normal');
                doc.text(note.split, margin, noteCursorY);
                noteCursorY += note.split.length * notesLineHeight;
            });
        }

        // Global Page Footer
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            const ph = doc.internal.pageSize.getHeight();
            doc.setTextColor(0, 0, 0).setLineWidth(0.2).line(margin, ph - 15, pageWidth - margin, ph - 15);
            doc.setFontSize(8).setFont('times', 'italic').text(footerNote, margin, ph - 10);
            doc.setFontSize(9).setFont('times', 'normal').text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, ph - 10, { align: 'right' });
        }
        doc.save(fileName);
    } catch (error) {
        console.error("Error exporting to PDF:", error);
        alert("Terjadi kesalahan saat mengekspor ke PDF. Silakan coba lagi.");
    }
}
