import { NextRequest, NextResponse } from 'next/server';
import { AzureOpenAI } from 'openai';
import { db } from '@/lib/db';
import { companies, topicTrees } from '@/lib/db/schema';
import { TopicTree } from '@/lib/types';
import * as cheerio from 'cheerio';

const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
});

async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeHarvest/1.0)',
      },
    });

    if (!response.ok) {
      return '';
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script and style elements
    $('script, style, nav, footer').remove();

    // Get text content
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    // Limit to first 3000 characters to avoid token limits
    return text.substring(0, 3000);
  } catch (error) {
    console.error('Error fetching website:', error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, companyName, description } = await request.json();

    if (!companyName || !description) {
      return NextResponse.json(
        { error: 'Company name and description are required' },
        { status: 400 }
      );
    }

    // Fetch website content if URL provided
    let websiteContent = '';
    if (url) {
      websiteContent = await fetchWebsiteContent(url);
    }

    // Create prompt for topic tree generation
    const systemPrompt = `You are an expert at analyzing companies and creating comprehensive knowledge taxonomies.
Your task is to generate a structured topic tree that captures all the critical knowledge areas for this organization.

Focus on these main categories as appropriate:
- Products/Services
- Processes and Procedures
- Equipment and Tools
- Suppliers and Vendors
- Safety and Compliance
- Troubleshooting
- Quality Control
- Onboarding

For each topic, create specific, actionable target questions that an expert should be able to answer.
Mark critical questions as required=true.

Return ONLY valid JSON in this exact format:
{
  "company": "Company Name",
  "topics": [
    {
      "id": "unique_id",
      "name": "Topic Name",
      "weight": 5,
      "targets": [
        {"id": "t1", "q": "Specific question?", "required": true},
        {"id": "t2", "q": "Another question?", "required": false}
      ],
      "children": []
    }
  ]
}`;

    const userPrompt = `Company: ${companyName}

Description: ${description}

${websiteContent ? `Website Content:\n${websiteContent}\n` : ''}

Generate a comprehensive topic tree for capturing this organization's knowledge.`;

    // Call Azure OpenAI with structured outputs
    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const topicTree: TopicTree = JSON.parse(content);

    // Store in database
    const now = new Date();

    const [company] = await db.insert(companies).values({
      name: companyName,
      url: url || null,
      description,
      createdAt: now,
    }).returning();

    await db.insert(topicTrees).values({
      companyId: company.id,
      topicData: JSON.stringify(topicTree),
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      topicTree,
      companyId: company.id,
    });
  } catch (error) {
    console.error('Error generating topic tree:', error);
    return NextResponse.json(
      { error: 'Failed to generate topic tree' },
      { status: 500 }
    );
  }
}
