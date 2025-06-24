import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import type { AnnotationDataStreamWriter } from './annotation-stream';
import { webSearchStep } from './steps/web-search';

export const QueryCompletionSchema = z.object({
  type: z.literal('query_completion'),
  data: z.object({
    query: z.string(),
    index: z.number(),
    total: z.number(),
    status: z.literal('completed'),
    resultsCount: z.number(),
    imagesCount: z.number(),
  }),
});

const extractDomain = (url: string): string => {
  const urlPattern = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i;
  return url.match(urlPattern)?.[1] || url;
};

const deduplicateByDomainAndUrl = <T extends { url: string }>(
  items: T[],
): T[] => {
  const seenDomains = new Set<string>();
  const seenUrls = new Set<string>();

  return items.filter((item) => {
    const domain = extractDomain(item.url);
    const isNewUrl = !seenUrls.has(item.url);
    const isNewDomain = !seenDomains.has(domain);

    if (isNewUrl && isNewDomain) {
      seenUrls.add(item.url);
      seenDomains.add(domain);
      return true;
    }
    return false;
  });
};

function sanitizeUrl(url: string): string {
  return url.replace(/\s+/g, '%20');
}

async function isValidImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return (
      response.ok &&
      (response.headers.get('content-type')?.startsWith('image/') ?? false)
    );
  } catch {
    return false;
  }
}

interface WebSearchProps {
  session: Session;
  dataStream: AnnotationDataStreamWriter;
}

export const webSearch = ({ session, dataStream }: WebSearchProps) =>
  tool({
    description: `Multi-query web search (supports depth, topic & result limits). Always cite sources inline.

Usage:
- General information gathering via web search

Citation rules:
- Insert citation right after the relevant sentence/paragraph — not in a footer
- Format exactly: [Source Title](URL)
- Cite only the most relevant hits and avoid fluff

Avoid:
- Pulling content from a single known URL (use retrieve instead)`,
    parameters: z.object({
      search_queries: z
        .array(
          z.object({
            query: z.string(),
            rationale: z.string().describe('The rationale for the query.'),
            // source: z.enum(['web', 'academic', 'x', 'all']),
            priority: z
              .number()
              .min(1)
              .max(5)
              .describe('The priority of the query. Use from 2 to 4.'),
          }),
        )
        .max(12),
      thinking: z
        .object({
          header: z.string().describe('Search plan title.'),
          body: z.string().describe('Explanation of the search plan.'),
        })
        .describe('The thinking process of the search plan.'),

      topics: z.array(
        z
          .enum(['general', 'news'])
          .describe('Array of topic types to search for.'),
      ),
      searchDepth: z.array(
        z
          .enum(['basic', 'advanced'])
          .describe('Array of search depths to use.'),
      ),
      exclude_domains: z
        .array(z.string())
        .describe(
          'A list of domains to exclude from all search results. Defaults to empty array.',
        ),
    }),
    execute: async ({
      search_queries,
      topics,
      searchDepth,
      exclude_domains,
      thinking,
    }: {
      search_queries: { query: string; rationale: string; priority: number }[];
      topics: ('general' | 'news')[];
      searchDepth: ('basic' | 'advanced')[];
      exclude_domains?: string[];
      thinking: { header: string; body: string };
    }) => {
      console.log('Queries:', search_queries);
      console.log('Topics:', topics);
      console.log('Search Depths:', searchDepth);
      console.log('Exclude Domains:', exclude_domains);
      console.log('Search Queries:', search_queries);

      let completedSteps = 0;
      const totalSteps = 1; // TODO: Web search is very simple for now
      // Complete plan status
      dataStream.writeMessageAnnotation({
        type: 'research_update',
        data: {
          id: 'research-plan',
          type: 'thoughts',
          status: 'completed',
          title: 'Web search plan',
          message: 'Search plan created',
          timestamp: Date.now(),
          overwrite: true,
          thoughtItems: [
            {
              header: thinking.header,
              body: thinking.body,
            },
          ],
        },
      });

      // Execute searches in parallel
      const searchPromises = search_queries.map(async (query, index) => {
        const data = await webSearchStep({
          // TODO: Make compatible with other providers
          query: query.query,
          providerOptions: {
            provider: 'tavily',
            topic: topics[index] || topics[0] || 'general',
            days: topics[index] === 'news' ? 7 : undefined,
            maxResults: Math.min(6 - query.priority, 10),
            searchDepth: searchDepth[index] || searchDepth[0] || 'basic',
            includeAnswer: true,
            includeImages: false,
            includeImageDescriptions: false,
            excludeDomains: exclude_domains,
          },
          dataStream,
          stepId: `web-search-${index}`,
        });

        return {
          query,
          results: deduplicateByDomainAndUrl(data.results).map((obj: any) => ({
            url: obj.url,
            title: obj.title,
            content: obj.content,
            raw_content: obj.raw_content,
            published_date:
              topics[index] === 'news' ? obj.published_date : undefined,
          })),
        };
      });
      completedSteps++;

      const searchResults = await Promise.all(searchPromises);

      // Final progress update
      dataStream.writeMessageAnnotation({
        type: 'research_update',
        data: {
          id: 'research-progress',
          type: 'progress',
          status: 'completed',
          title: 'Done',
          message: `Research complete`,
          completedSteps,
          totalSteps,
          overwrite: true,
          timestamp: Date.now(),
        },
      });
      return {
        searches: searchResults,
      };
    },
  });
