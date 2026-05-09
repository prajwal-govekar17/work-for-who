import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      reportId,
      summary,
      riskLevel,
      trustScore,
      employerName,
    }: {
      reportId: string;
      summary?: string;
      riskLevel?: string;
      trustScore?: number;
      employerName?: string;
    } = body;

    const doc = await PDFDocument.create();
    const page = doc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();

    const fontBold   = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontNormal = await doc.embedFont(StandardFonts.Helvetica);

    const DARK   = rgb(0.05, 0.08, 0.15);
    const BLUE   = rgb(0.14, 0.38, 0.92);
    const MUTED  = rgb(0.45, 0.50, 0.58);
    const WHITE  = rgb(1, 1, 1);
    const riskColor =
      riskLevel === 'high'   ? rgb(0.86, 0.15, 0.15) :
      riskLevel === 'medium' ? rgb(0.93, 0.57, 0.05) :
                               rgb(0.13, 0.71, 0.42);

    // ── Header bar ──────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: height - 88, width, height: 88, color: DARK });

    page.drawText('WORKFORWHO', {
      x: 40, y: height - 44,
      font: fontBold, size: 22, color: WHITE,
    });
    page.drawText('ANONYMOUS REPORT RECEIPT', {
      x: 40, y: height - 65,
      font: fontNormal, size: 9, color: rgb(0.55, 0.62, 0.72),
    });

    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    page.drawText(dateStr, {
      x: width - 40 - fontNormal.widthOfTextAtSize(dateStr, 9),
      y: height - 60,
      font: fontNormal, size: 9, color: rgb(0.55, 0.62, 0.72),
    });

    // ── Section helper ───────────────────────────────────────────────────────
    let cursor = height - 120;
    const section = (label: string) => {
      page.drawText(label.toUpperCase(), {
        x: 40, y: cursor,
        font: fontBold, size: 7.5, color: MUTED,
      });
      cursor -= 5;
      page.drawLine({ start: { x: 40, y: cursor }, end: { x: width - 40, y: cursor }, thickness: 0.5, color: rgb(0.87, 0.89, 0.92) });
      cursor -= 16;
    };
    const field = (label: string, value: string, valueColor = DARK) => {
      page.drawText(label, { x: 40, y: cursor, font: fontNormal, size: 9, color: MUTED });
      page.drawText(value, { x: 180, y: cursor, font: fontBold, size: 9, color: valueColor });
      cursor -= 18;
    };
    const paragraph = (text: string, maxWidth = width - 80) => {
      const words = text.split(' ');
      let line = '';
      const lines: string[] = [];
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (fontNormal.widthOfTextAtSize(test, 9.5) > maxWidth) {
          lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      for (const l of lines) {
        page.drawText(l, { x: 40, y: cursor, font: fontNormal, size: 9.5, color: DARK });
        cursor -= 15;
      }
      cursor -= 6;
    };

    // ── Report details ───────────────────────────────────────────────────────
    section('Report Details');
    field('Report ID',     reportId ?? '—');
    field('Employer',      employerName ?? 'Unmatched — AI is matching regionally');
    field('Submitted',     new Date().toISOString());
    field('Source',        'WorkForWho Community Platform');
    cursor -= 6;

    // ── AI extraction ────────────────────────────────────────────────────────
    section('AI Extraction Summary');
    if (summary) {
      paragraph(`"${summary}"`);
    } else {
      paragraph('AI extraction is still processing. The system will update the community risk profile once analysis completes.');
    }

    // ── Community consensus ──────────────────────────────────────────────────
    section('Community Risk Consensus');
    if (trustScore !== undefined) {
      field('Trust Score',  `${trustScore} / 100`);
    }
    if (riskLevel) {
      const label = riskLevel === 'high' ? 'HIGH RISK — Community Warning Active' :
                    riskLevel === 'medium' ? 'MEDIUM RISK — Monitor Advised' :
                    'LOW RISK — No Active Warnings';
      field('Risk Level', label, riskColor);
    }
    cursor -= 6;

    // ── Risk badge pill ──────────────────────────────────────────────────────
    if (riskLevel) {
      const badgeText = `${(riskLevel ?? '').toUpperCase()} RISK`;
      const badgeW = fontBold.widthOfTextAtSize(badgeText, 10) + 28;
      page.drawRectangle({ x: 40, y: cursor - 4, width: badgeW, height: 22, color: riskColor });
      page.drawText(badgeText, { x: 40 + 14, y: cursor + 4, font: fontBold, size: 10, color: WHITE });
      cursor -= 36;
    }

    // ── Anonymity notice ─────────────────────────────────────────────────────
    section('Anonymity & Privacy Notice');
    paragraph(
      'This report was submitted anonymously through WorkForWho. No personally identifiable information was collected or stored. Your IP address was not logged. This receipt is generated client-side and is not stored on our servers.'
    );

    // ── Footer ───────────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 0, width, height: 46, color: rgb(0.96, 0.97, 0.98) });
    page.drawText('workforwho.com  ·  Community Safety Infrastructure  ·  Your voice protects the next worker.', {
      x: 40, y: 16,
      font: fontNormal, size: 8, color: MUTED,
    });

    // Thin blue accent line above footer
    page.drawRectangle({ x: 0, y: 46, width, height: 3, color: BLUE });

    const pdfBytes = await doc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="WorkForWho-Report-${reportId?.slice(0, 8) ?? 'receipt'}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'PDF generation failed' }, { status: 500 });
  }
}
