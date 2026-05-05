import jsPDF from "jspdf";

export type CertificateInput = {
  title: string;
  subtitle?: string;
  programName: string;
  memberName: string;
  completionDate: string; // human readable
  churchName?: string;
  signatureName?: string;
  signatureTitle?: string;
};

export function downloadCertificatePdf(c: CertificateInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Border
  doc.setDrawColor(184, 134, 11); // gold-ish
  doc.setLineWidth(6);
  doc.rect(24, 24, w - 48, h - 48);
  doc.setLineWidth(1);
  doc.rect(36, 36, w - 72, h - 72);

  doc.setFont("times", "bold");
  doc.setFontSize(36);
  doc.setTextColor(20, 20, 30);
  doc.text(c.title || "Certificate of Completion", w / 2, 130, { align: "center" });

  if (c.subtitle) {
    doc.setFont("times", "italic");
    doc.setFontSize(16);
    doc.text(c.subtitle, w / 2, 160, { align: "center" });
  }

  doc.setFont("times", "normal");
  doc.setFontSize(14);
  doc.text("This certifies that", w / 2, 220, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(32);
  doc.text(c.memberName, w / 2, 270, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(14);
  doc.text("has successfully completed", w / 2, 305, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.text(c.programName, w / 2, 345, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(13);
  doc.text(`on ${c.completionDate}`, w / 2, 380, { align: "center" });

  // Signature line
  if (c.signatureName) {
    doc.setLineWidth(0.5);
    doc.line(w / 2 - 130, h - 110, w / 2 + 130, h - 110);
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.text(c.signatureName, w / 2, h - 90, { align: "center" });
    if (c.signatureTitle) {
      doc.setFont("times", "italic");
      doc.setFontSize(11);
      doc.text(c.signatureTitle, w / 2, h - 74, { align: "center" });
    }
  }

  if (c.churchName) {
    doc.setFont("times", "italic");
    doc.setFontSize(12);
    doc.text(c.churchName, w / 2, h - 50, { align: "center" });
  }

  const safe = c.programName.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  doc.save(`certificate_${safe}.pdf`);
}
