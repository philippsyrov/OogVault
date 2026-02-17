/**
 * OogVault Search Engine
 * Full-text search and fuzzy matching for conversations and messages.
 */

import { getAllConversations, getMessagesForConversation, getAllNuggets } from './db.js';

/**
 * Common stop words to filter out during keyword matching.
 * These dilute match scores when included in token averaging.
 */
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they',
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'doing', 'done',
  'have', 'has', 'had', 'having',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'into', 'about',
  'and', 'or', 'but', 'not', 'no', 'if', 'so', 'then', 'than',
  'what', 'how', 'when', 'where', 'which', 'who', 'why',
  'up', 'out', 'just', 'also', 'very', 'really', 'please', 'pls',
  'want', 'wanna', 'gonna', 'need', 'like', 'know', 'think', 'get', 'got',
  'hey', 'hi', 'hello', 'heya', 'ok', 'okay', 'thanks', 'thank',
  'tell', 'ask', 'help', 'make', 'let', 'give', 'show', 'use',
  'im', 'dont', 'cant', 'wont', 'its', 'thats', 'whats', 'heres',
  'some', 'any', 'all', 'more', 'much', 'many', 'most', 'other',
  'here', 'there', 'now', 'well', 'too', 'still', 'already',
]);

/**
 * Tokenize and normalize text for matching.
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Extract meaningful keywords (filter out stop words and short tokens).
 */
function extractKeywords(text) {
  return tokenize(text).filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

/**
 * Calculate simple relevance score between query tokens and text tokens.
 * Returns a 0-1 score based on token overlap.
 */
function relevanceScore(queryTokens, textTokens) {
  if (queryTokens.length === 0 || textTokens.length === 0) return 0;

  const textSet = new Set(textTokens);
  let matches = 0;

  for (const qt of queryTokens) {
    for (const tt of textSet) {
      if (tt.includes(qt) || qt.includes(tt)) {
        matches++;
        break;
      }
    }
  }

  return matches / queryTokens.length;
}

/**
 * Simple Levenshtein distance for fuzzy matching.
 */
function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Keyword-smart match score between two strings (0-1, higher is better).
 * Filters out stop words so only meaningful keywords are compared.
 * REQUIRES at least one keyword to genuinely match (exact, substring, or
 * very close Levenshtein). Results with zero keyword overlap return 0.
 */
function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Direct substring match
  if (t.includes(q)) return 1.0;

  const qKeywords = extractKeywords(q);
  const tTokens = tokenize(t);

  // If no meaningful keywords in query, fall back to all tokens
  const queryTokens = qKeywords.length > 0 ? qKeywords : tokenize(q);
  if (queryTokens.length === 0) return 0;

  let totalScore = 0;
  let strongHits = 0;

  for (const qt of queryTokens) {
    let bestMatch = 0;
    for (const tt of tTokens) {
      // Exact match
      if (tt === qt) {
        bestMatch = 1.0;
        break;
      }
      // Substring containment (one word inside the other)
      if (tt.includes(qt) || qt.includes(tt)) {
        // Only count if the shorter word is >= 4 chars to avoid tiny word noise
        const shorter = Math.min(qt.length, tt.length);
        if (shorter >= 4) {
          bestMatch = Math.max(bestMatch, 0.9);
        }
        continue;
      }
      // Levenshtein only for tokens of similar length AND >= 4 chars
      if (qt.length >= 4 && Math.abs(qt.length - tt.length) <= 2) {
        const maxLen = Math.max(qt.length, tt.length);
        const dist = levenshtein(qt, tt);
        const sim = 1 - dist / maxLen;
        // Only accept very close matches (>= 0.7 similarity)
        if (sim >= 0.7 && sim > bestMatch) bestMatch = sim;
      }
    }
    totalScore += bestMatch;
    if (bestMatch >= 0.8) strongHits++;
  }

  // Hard gate: if no keyword genuinely matched, score is 0.
  // This prevents unrelated results from leaking through.
  if (strongHits === 0) return 0;

  const avgScore = totalScore / queryTokens.length;

  // Boost based on how many keywords matched strongly
  if (strongHits >= 2) {
    return Math.max(avgScore, 0.5 + strongHits * 0.1);
  }
  if (strongHits >= 1) {
    return Math.max(avgScore, 0.4);
  }

  return avgScore;
}

/**
 * Search conversations by keyword. Returns conversations with matching score.
 * Uses keyword extraction to focus on meaningful terms.
 */
export async function searchConversations(query, limit = 20) {
  if (!query || query.trim().length === 0) return [];

  const conversations = await getAllConversations();
  const queryKeywords = extractKeywords(query);
  const queryAllTokens = tokenize(query);
  // Use keywords if available, fall back to all tokens
  const queryTokens = queryKeywords.length > 0 ? queryKeywords : queryAllTokens;
  const results = [];

  for (const conv of conversations) {
    const messages = await getMessagesForConversation(conv.id);
    let bestScore = 0;
    let matchedContent = '';

    // Check title using keyword-smart fuzzyScore
    const titleScore = fuzzyScore(query, conv.title);
    if (titleScore > bestScore) {
      bestScore = titleScore;
      matchedContent = conv.title;
    }

    // Check messages using keyword-smart fuzzyScore
    for (const msg of messages) {
      const msgScore = fuzzyScore(query, msg.content);
      if (msgScore > bestScore) {
        bestScore = msgScore;
        matchedContent = msg.content.substring(0, 200);
      }
    }

    if (bestScore > 0.25) {
      results.push({
        ...conv,
        messages,
        score: bestScore,
        matchedContent,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Search for similar past questions (user messages + nuggets).
 * Uses keyword-smart matching: extracts meaningful keywords from the query
 * and matches them against saved content, ignoring filler/stop words.
 */
export async function searchSimilarQuestions(query, limit = 5) {
  if (!query || query.trim().length < 8) return [];

  const queryKw = extractKeywords(query);
  // Need at least one meaningful keyword to search
  if (queryKw.length === 0) return [];

  const conversations = await getAllConversations();
  const results = [];
  const seen = new Set();

  // Search user messages in conversations
  for (const conv of conversations) {
    const messages = await getMessagesForConversation(conv.id);
    const userMessages = messages.filter((m) => m.role === 'user');

    for (const msg of userMessages) {
      const score = fuzzyScore(query, msg.content);

      if (score > 0.3) {
        const key = msg.content.substring(0, 100).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const msgIndex = messages.indexOf(msg);
        const response = messages[msgIndex + 1];

        results.push({
          question: msg.content.substring(0, 200),
          answer: response ? response.content.substring(0, 300) : null,
          conversationId: conv.id,
          conversationTitle: conv.title,
          platform: conv.platform,
          timestamp: msg.timestamp,
          score,
          source: 'conversation',
        });
      }
    }
  }

  // Also search Knowledge Nuggets (distilled Q&A pairs match better)
  try {
    const nuggets = await getAllNuggets();
    for (const nugget of nuggets) {
      const qScore = fuzzyScore(query, nugget.question);
      const tScore = nugget.tags
        ? Math.max(...nugget.tags.map((tag) => fuzzyScore(query, tag)), 0)
        : 0;
      const score = Math.max(qScore, tScore * 0.9);

      if (score > 0.3) {
        const key = nugget.question.substring(0, 100).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({
          question: nugget.question.substring(0, 200),
          answer: nugget.answer ? nugget.answer.substring(0, 300) : null,
          conversationId: nugget.conversationId,
          conversationTitle: nugget.question.substring(0, 60),
          platform: 'nugget',
          timestamp: nugget.createdAt,
          score,
          source: 'nugget',
        });
      }
    }
  } catch (e) {
    // Nuggets search is optional, don't break if it fails
    console.warn('[OogVault] Nugget search failed:', e);
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Export a conversation as Markdown.
 */
export async function exportAsMarkdown(conversationId) {
  const conversations = await getAllConversations();
  const conv = conversations.find((c) => c.id === conversationId);
  if (!conv) return null;

  const messages = await getMessagesForConversation(conversationId);
  const lines = [
    `# ${conv.title}`,
    `**Platform:** ${conv.platform} | **Date:** ${new Date(conv.created_at).toLocaleString()}`,
    '',
    '---',
    '',
  ];

  for (const msg of messages) {
    const role = msg.role === 'user' ? '**You**' : '**Assistant**';
    lines.push(`### ${role}`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a summary of a conversation for "Continue Conversation" feature.
 */
export async function generateConversationSummary(conversationId) {
  const messages = await getMessagesForConversation(conversationId);
  if (messages.length === 0) return null;

  const userMessages = messages.filter((m) => m.role === 'user');

  const topicsDiscussed = userMessages
    .map((m) => `- ${m.content.substring(0, 100)}`)
    .join('\n');

  const lastExchange = messages.slice(-4).map((m) => {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    return `${role}: ${m.content.substring(0, 200)}`;
  }).join('\n\n');

  return [
    'I\'m continuing a previous conversation. Here\'s a summary:',
    '',
    '## Topics we discussed:',
    topicsDiscussed,
    '',
    '## Last exchange:',
    lastExchange,
    '',
    'Please continue from where we left off.',
  ].join('\n');
}

/**
 * Extract Q&A nuggets from a conversation's messages.
 * Each user message paired with the following assistant response becomes one nugget.
 * Returns an array of { question, answer } objects.
 */
export function extractNuggets(messages, platform) {
  const nuggets = [];
  const now = new Date().toISOString();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'user') continue;

    const question = msg.content.trim();
    if (question.length < 10) continue;

    // Find the next assistant response
    const nextMsg = messages[i + 1];
    if (!nextMsg || nextMsg.role !== 'assistant') continue;

    const fullAnswer = nextMsg.content.trim();
    if (fullAnswer.length < 5) continue;

    // Truncate question to first 300 chars, answer snippet to first 500 chars
    nuggets.push({
      id: crypto.randomUUID(),
      question: question.substring(0, 300),
      answer: fullAnswer.substring(0, 500),
      platform: platform || '',
      created_at: msg.timestamp || now,
    });
  }

  return nuggets;
}

/**
 * Search nuggets by query text (fuzzy match on question and answer).
 */
export async function searchNuggetsText(query, limit = 10) {
  if (!query || query.trim().length === 0) return [];

  const nuggets = await getAllNuggets();
  const queryTokens = tokenize(query);

  const scored = nuggets.map((n) => {
    const qScore = relevanceScore(queryTokens, tokenize(n.question));
    const aScore = relevanceScore(queryTokens, tokenize(n.answer));
    return { ...n, score: Math.max(qScore, aScore * 0.8) };
  });

  return scored
    .filter((n) => n.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Export all nuggets as a structured knowledge.md file.
 */
export async function exportKnowledgeMarkdown() {
  const nuggets = await getAllNuggets();
  if (nuggets.length === 0) return null;

  // Group nuggets by platform
  const grouped = {};
  for (const n of nuggets) {
    const key = n.platform || 'General';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(n);
  }

  const lines = [
    '# OogVault Knowledge Base',
    '',
    `> Auto-generated on ${new Date().toLocaleString()} · ${nuggets.length} knowledge nuggets`,
    '',
    '---',
    '',
  ];

  for (const [platform, items] of Object.entries(grouped)) {
    lines.push(`## ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
    lines.push('');

    for (const nugget of items) {
      lines.push(`### Q: ${nugget.question}`);
      lines.push('');
      lines.push(`**A:** ${nugget.answer}`);
      lines.push('');
      lines.push(`_${new Date(nugget.created_at).toLocaleDateString()}_`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}
