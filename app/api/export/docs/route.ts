import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export async function POST(request: NextRequest) {
  try {
    const { companyId, format } = await request.json();

    if (!format || !['html', 'docx'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be "html" or "docx"' },
        { status: 400 }
      );
    }

    // Fetch document data (for demo, using mock data)
    const mockContent = {
      companyName: 'Acme Manufacturing Co.',
      sections: [
        {
          title: 'Products & Services',
          content: 'Acme Manufacturing specializes in precision automotive components...',
        },
        {
          title: 'Manufacturing Processes',
          content: 'Our manufacturing facility operates on a lean production system...',
        },
        {
          title: 'Equipment & Machinery',
          content: 'Primary equipment inventory includes CNC machines, furnaces, and quality control systems...',
        },
      ],
    };

    if (format === 'html') {
      const html = generateHTML(mockContent);
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="knowledge-handbook-${companyId}.html"`,
        },
      });
    } else {
      // Generate DOCX
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: `${mockContent.companyName} - Knowledge Handbook`,
                heading: HeadingLevel.TITLE,
              }),
              new Paragraph({
                text: `Generated on ${new Date().toLocaleDateString()}`,
                spacing: { after: 400 },
              }),
              ...mockContent.sections.flatMap((section) => [
                new Paragraph({
                  text: section.title,
                  heading: HeadingLevel.HEADING_1,
                  spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                  text: section.content,
                  spacing: { after: 200 },
                }),
              ]),
            ],
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      const uint8Array = new Uint8Array(buffer);

      return new NextResponse(uint8Array, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="knowledge-handbook-${companyId}.docx"`,
        },
      });
    }
  } catch (error) {
    console.error('Error exporting document:', error);
    return NextResponse.json(
      { error: 'Failed to export document' },
      { status: 500 }
    );
  }
}

function generateHTML(content: any): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.companyName} - Knowledge Handbook</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1 {
      color: #2563eb;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 10px;
    }
    h2 {
      color: #4f46e5;
      margin-top: 30px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
    }
    h3 {
      color: #6366f1;
      margin-top: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .generated-date {
      color: #6b7280;
      font-size: 14px;
    }
    .section {
      margin-bottom: 30px;
    }
    ul, ol {
      margin-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    strong {
      color: #1f2937;
    }
    .toc {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .toc ul {
      list-style: none;
      padding-left: 0;
    }
    .toc li {
      margin-bottom: 8px;
    }
    .toc a {
      color: #4f46e5;
      text-decoration: none;
    }
    .toc a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${content.companyName}</h1>
    <h2>Knowledge Handbook</h2>
    <p class="generated-date">Generated on ${new Date().toLocaleDateString()}</p>
  </div>

  <div class="toc">
    <h3>Table of Contents</h3>
    <ul>
      ${content.sections.map((section: any, idx: number) =>
        `<li><a href="#section-${idx}">${section.title}</a></li>`
      ).join('')}
    </ul>
  </div>

  ${content.sections.map((section: any, idx: number) => `
    <div class="section" id="section-${idx}">
      <h2>${section.title}</h2>
      <p>${section.content}</p>
    </div>
  `).join('')}

  <footer style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center;">
    <p>Generated by Knowledge Harvest &copy; ${new Date().getFullYear()}</p>
  </footer>
</body>
</html>`;
}
