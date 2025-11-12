import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { load } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { type MockDocument } from '@/app/api/docs/mockData';
import { resolveDocument } from '@/app/api/docs/documentService';

export async function POST(request: NextRequest) {
  try {
    const { companyId, format, mock } = await request.json();

    if (!companyId) {
      return NextResponse.json({ error: 'Missing company ID' }, { status: 400 });
    }

    if (!format || !['html', 'docx'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be "html" or "docx"' },
        { status: 400 }
      );
    }

    const parsedCompanyId =
      typeof companyId === 'number' ? companyId : Number.parseInt(companyId, 10);

    if (mock !== true && Number.isNaN(parsedCompanyId)) {
      return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
    }

    const docContent = await resolveDocument({
      companyId: Number.isNaN(parsedCompanyId) ? -1 : parsedCompanyId,
      useMock: mock === true,
    });

    if (format === 'html') {
      const html = generateHTML(docContent);
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="knowledge-handbook-${companyId}.html"`,
        },
      });
    } else {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: `${docContent.companyName} - Knowledge Handbook`,
                heading: HeadingLevel.TITLE,
              }),
              new Paragraph({
                text: `Generated on ${new Date(docContent.generatedAt).toLocaleDateString()}`,
                spacing: { after: 400 },
              }),
              ...buildDocxParagraphs(docContent),
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

type DocumentSection = MockDocument['sections'][number];

const headingLevels = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

function buildDocxParagraphs(content: MockDocument) {
  return content.sections.flatMap((section) => buildSectionParagraphs(section, 1));
}

function buildSectionParagraphs(section: DocumentSection, depth: number): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: section.title,
      heading: headingLevels[Math.min(depth - 1, headingLevels.length - 1)],
      spacing: { before: depth === 1 ? 400 : 200, after: 160 },
    }),
  ];

  const textBlocks = extractTextBlocks(section.content);
  textBlocks.forEach((text) => {
    paragraphs.push(
      new Paragraph({
        text,
        spacing: { after: 120 },
      })
    );
  });

  (section.subsections ?? []).forEach((subsection) => {
    paragraphs.push(...buildSectionParagraphs(subsection, depth + 1));
  });

  return paragraphs;
}

function extractTextBlocks(html: string): string[] {
  const $ = load(`<body>${html}</body>`);
  const blocks: string[] = [];

  const pushText = (text: string, prefix: string | null = null) => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized) {
      blocks.push(prefix ? `${prefix} ${normalized}` : normalized);
    }
  };

  const processNode = (node: AnyNode, listPrefix: string | null = null) => {
    if (node.type === 'text') {
      pushText(node.data || '', listPrefix);
      return;
    }

    if (node.type !== 'tag') {
      return;
    }

    const tag = node.tagName?.toLowerCase();
    const element = $(node);

    switch (tag) {
      case 'p':
      case 'div':
      case 'section':
        pushText(element.text());
        break;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        pushText(element.text());
        break;
      case 'ul':
      case 'ol':
        element.children('li').each((_, li) => processNode(li, '-'));
        break;
      case 'li':
        {
          const clone = element.clone();
          clone.children('ul,ol').remove();
          pushText(clone.text(), listPrefix ?? '-');
          element.children('ul,ol').each((_, child) => processNode(child, listPrefix));
        }
        break;
      default:
        element.contents().each((_, child) => processNode(child, listPrefix));
    }
  };

  const wrapper = $('body').first();
  wrapper.contents().each((_, node) => {
    processNode(node);
  });

  return blocks;
}

function generateHTML(content: MockDocument): string {
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
    <p class="generated-date">Generated on ${new Date(content.generatedAt).toLocaleDateString()}</p>
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
      <div>${section.content}</div>
      ${(section.subsections ?? [])
        .map(
          (sub: any) => `
          <div class="subsection">
            <h3>${sub.title}</h3>
            <div>${sub.content}</div>
          </div>
        `
        )
        .join('')}
    </div>
  `).join('')}

  <footer style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center;">
    <p>Generated by Knowledge Harvest &copy; ${new Date().getFullYear()}</p>
  </footer>
</body>
</html>`;
}
