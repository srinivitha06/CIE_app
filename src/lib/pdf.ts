import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function generateStudentResultPdf(args: {
  exam: { title?: string; category?: string };
  student: { full_name?: string | null; email?: string | null; roll_number?: string | null; class_name?: string | null };
  result: { score: number; total_marks: number; correct_count: number; total_questions: number; auto_submitted: boolean; submitted_at: string };
  violations: { violation: string; detail?: string | null; created_at?: string }[];
}) {
  const { exam, student, result, violations } = args;
  const doc = new jsPDF();
  const pct = result.total_marks ? Math.round((result.score / result.total_marks) * 100) : 0;
  const passed = pct >= 50;

  doc.setFontSize(18);
  doc.text("CIE Exam Portal — Result Report", 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`${exam.category ?? ""} · ${exam.title ?? ""}`, 14, 26);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 34,
    theme: "plain",
    body: [
      ["Student", student.full_name || student.email || "—"],
      ["Email", student.email || "—"],
      ["Roll number", student.roll_number || "—"],
      ["Class", student.class_name || "—"],
      ["Submitted", new Date(result.submitted_at).toLocaleString()],
      ["Submission mode", result.auto_submitted ? "Auto-submitted" : "Manual"],
    ],
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
  });

  const y1 = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(13);
  doc.text("Score Summary", 14, y1);
  autoTable(doc, {
    startY: y1 + 4,
    head: [["Score", "Total marks", "Correct", "Total questions", "Percentage", "Status"]],
    body: [[
      String(result.score), String(result.total_marks),
      String(result.correct_count), String(result.total_questions),
      `${pct}%`, passed ? "Passed" : "Did not pass",
    ]],
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 10 },
  });

  const y2 = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(13);
  doc.text(`Violations (${violations.length})`, 14, y2);
  if (violations.length) {
    autoTable(doc, {
      startY: y2 + 4,
      head: [["#", "Type", "Detail", "Time"]],
      body: violations.map((v, i) => [String(i + 1), v.violation, v.detail || "—", v.created_at ? new Date(v.created_at).toLocaleString() : "—"]),
      headStyles: { fillColor: [127, 29, 29] },
      styles: { fontSize: 9 },
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("No violations recorded.", 14, y2 + 8);
    doc.setTextColor(0);
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()} · CIE Exam Portal`, 14, doc.internal.pageSize.getHeight() - 8);

  const safe = (exam.title || "result").replace(/[^a-z0-9]+/gi, "_");
  doc.save(`${safe}_${student.roll_number || student.email || "student"}.pdf`);
}

export function generateExamReportPdf(args: {
  exam: { title?: string; category?: string; total_questions?: number; duration_minutes?: number };
  rows: {
    name: string; email: string; roll: string; class_name: string;
    score: string; total: string; correct: string; violations: number; status: string;
  }[];
}) {
  const { exam, rows } = args;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("CIE Exam Portal — Exam Report", 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${exam.category ?? ""} · ${exam.title ?? ""} · ${exam.total_questions ?? 0} Qs · ${exam.duration_minutes ?? 0} min`, 14, 22);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 28,
    head: [["Name", "Email", "Roll", "Class", "Score", "Correct", "Violations", "Status"]],
    body: rows.map((r) => [r.name, r.email, r.roll, r.class_name, `${r.score}/${r.total}`, r.correct, String(r.violations), r.status]),
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 },
  });

  const submitted = rows.filter((r) => r.status !== "Pending").length;
  doc.setFontSize(10);
  doc.text(`Assigned: ${rows.length} · Submitted: ${submitted}`, 14, (doc as any).lastAutoTable.finalY + 8);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, doc.internal.pageSize.getHeight() - 8);

  const safe = (exam.title || "report").replace(/[^a-z0-9]+/gi, "_");
  doc.save(`${safe}_report.pdf`);
}
