import { db } from '@/lib/db';
import { companies, topicTrees, knowledgeAtoms, interviewSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TopicTree, Topic } from '@/lib/types';
import { mockDocument, type MockDocument } from './mockData';

type KnowledgeAtom = typeof knowledgeAtoms.$inferSelect;

type GeneratedDocument = MockDocument;

export function buildMockDocument(): GeneratedDocument {
  return {
    ...mockDocument,
    generatedAt: new Date().toISOString(),
  };
}

function generateSections(topics: Topic[], atomsByTopic: Map<string, KnowledgeAtom[]>): any[] {
  const sections: any[] = [];

  for (const topic of topics) {
    const topicAtoms = atomsByTopic.get(topic.id) || [];

    const procedures = topicAtoms.filter((a) => a.type === 'procedure');
    const facts = topicAtoms.filter((a) => a.type === 'fact');
    const troubleshooting = topicAtoms.filter((a) => a.type === 'troubleshooting');
    const bestPractices = topicAtoms.filter((a) => a.type === 'best_practice');

    const contentParts: string[] = [];

    if (facts.length > 0) {
      contentParts.push('<h3>Overview</h3>');
      contentParts.push('<ul>');
      facts.forEach((fact) => {
        contentParts.push(`<li><strong>${fact.title}:</strong> ${fact.content}</li>`);
      });
      contentParts.push('</ul>');
    }

    if (procedures.length > 0) {
      procedures.forEach((proc) => {
        contentParts.push(`<h3>${proc.title}</h3>`);
        contentParts.push(`<p>${proc.content}</p>`);
      });
    }

    if (bestPractices.length > 0) {
      contentParts.push('<h3>Best Practices</h3>');
      contentParts.push('<ul>');
      bestPractices.forEach((bp) => {
        contentParts.push(`<li><strong>${bp.title}:</strong> ${bp.content}</li>`);
      });
      contentParts.push('</ul>');
    }

    if (troubleshooting.length > 0) {
      contentParts.push('<h3>Troubleshooting</h3>');
      troubleshooting.forEach((ts) => {
        contentParts.push(`<h4>${ts.title}</h4>`);
        contentParts.push(`<p>${ts.content}</p>`);
      });
    }

    const content =
      contentParts.length > 0 ? contentParts.join('\n') : '<p>No knowledge captured for this topic yet.</p>';

    const subsections = topic.children && topic.children.length > 0 ? generateSections(topic.children, atomsByTopic) : [];

    sections.push({
      id: topic.id,
      title: topic.name,
      content,
      subsections,
    });
  }

  return sections;
}

export async function generateRealDocument(companyId: number): Promise<GeneratedDocument | null> {
  const companyRecords = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);

  if (companyRecords.length === 0) {
    return null;
  }

  const topicTreeRecords = await db
    .select()
    .from(topicTrees)
    .where(eq(topicTrees.companyId, companyId))
    .limit(1);

  if (topicTreeRecords.length === 0) {
    return null;
  }

  let topicTree: TopicTree;
  try {
    topicTree = JSON.parse(topicTreeRecords[0].topicData);
  } catch (error) {
    console.warn('Failed to parse topic tree for company', companyId, error);
    return null;
  }

  const atomRows = await db
    .select({ atom: knowledgeAtoms })
    .from(knowledgeAtoms)
    .innerJoin(interviewSessions, eq(knowledgeAtoms.sessionId, interviewSessions.id))
    .where(eq(interviewSessions.companyId, companyId));

  const atoms = atomRows.map((row) => row.atom);
  const atomsByTopic = new Map<string, KnowledgeAtom[]>();

  for (const atom of atoms) {
    if (!atomsByTopic.has(atom.topicId)) {
      atomsByTopic.set(atom.topicId, []);
    }
    atomsByTopic.get(atom.topicId)!.push(atom);
  }

  const sections = generateSections(topicTree.topics, atomsByTopic);

  return {
    companyName: companyRecords[0].name,
    generatedAt: new Date().toISOString(),
    sections,
  };
}

export async function resolveDocument({
  companyId,
  useMock = false,
  fallbackToMock = true,
}: {
  companyId: number;
  useMock?: boolean;
  fallbackToMock?: boolean;
}): Promise<GeneratedDocument> {
  if (useMock) {
    return buildMockDocument();
  }

  const realDocument = await generateRealDocument(companyId);

  if (realDocument) {
    return realDocument;
  }

  if (!fallbackToMock) {
    throw new Error(`Document not found for company ${companyId}`);
  }

  console.warn(`Company data not found for ID ${companyId}; falling back to mock document.`);
  return buildMockDocument();
}
