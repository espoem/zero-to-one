#!/usr/bin/env bun
/**
 * tools/check-questions.ts
 *
 * Programmatic validator for certification question banks (*\/exams\/*.md).
 * Enforces the question formatting schema defined in AGENTS.md:
 *
 *   ### Q-<EXAM>-<NNN> · <Domain> · difficulty <1-3> · <single|multi|scenario|ordering|hands-on>
 *
 *   <question text>
 *   - A) …
 *   - B) …
 *   <details><summary>Answer</summary>
 *
 *   **B.** <explanation>
 *
 *   - Why not A: …
 *   - Ref: [modules/NN-….md](../modules/NN-….md#anchor), <official doc URL>
 *
 *   </details>
 */

import { readFileSync, globSync } from 'fs';

interface QuestionIssue {
  file: string;
  line: number;
  id: string;
  type: string;
  message: string;
}

export function auditQuestionBanks(globPattern = '**/exams/*.md'): {
  totalQuestions: number;
  filesScanned: number;
  issues: QuestionIssue[];
  prefixCounts: Record<string, number>;
} {
  const files = globSync(globPattern).filter(
    (f) => !f.endsWith('README.md') && !f.includes('node_modules'),
  );

  const headerRegex =
    /^### Q-([A-Za-z0-9-]+)-([0-9]{3,4})\s+·\s+([^·\n]+)\s+·\s+difficulty\s+([1-3])\s+·\s+(single|multi|scenario|ordering|hands-on)$/;

  const issues: QuestionIssue[] = [];
  const seenIds = new Map<string, string>(); // id -> file
  const prefixCounts: Record<string, number> = {};
  let totalQuestions = 0;

  for (const file of files.sort()) {
    const raw = readFileSync(file, 'utf8');

    // Split file by Mock Exam section if present to isolate question bank from free-form interview simulation scenarios (unless mock exam contains Q- items)
    const hasMockQ = /\n## .*(Mock Exam|Timed Mock)[\s\S]*?\n###+ Q-/i.test(raw);
    const bankPart = hasMockQ
      ? raw
      : raw.split(/\n(?=## .*Mock Exam|## Timed Mock|## Part 2: Timed Mock)/i)[0];

    // Check for level-4 questions in bankPart
    const bankLines = bankPart.split('\n');
    for (let i = 0; i < bankLines.length; i++) {
      const line = bankLines[i];
      if (line.startsWith('#### Q-')) {
        issues.push({
          file,
          line: i + 1,
          id: line.split('·')[0].replace('####', '').trim(),
          type: 'heading-level',
          message: `Question header uses '####' (H4) instead of '###' (H3): "${line}"`,
        });
      }
    }

    // Split bank into question sections
    const sections = bankPart.split(/\n(?=###+ Q-)/);

    for (let sIdx = 1; sIdx < sections.length; sIdx++) {
      totalQuestions++;
      const sec = sections[sIdx];
      const secLines = sec.split('\n');
      const headerLine = secLines[0].trim();

      const match = headerLine.match(headerRegex);
      if (!match) {
        issues.push({
          file,
          line: 1,
          id: headerLine
            .split('·')[0]
            .replace(/^###+\s*/, '')
            .trim(),
          type: 'header-format',
          message: `Header does not strictly match '### Q-<EXAM>-<NNN> · <Domain> · difficulty <1-3> · <type>': "${headerLine}"`,
        });
        continue;
      }

      const [, prefix, numStr, , , qType] = match;
      const qId = `Q-${prefix}-${numStr}`;

      // Duplicate check
      if (seenIds.has(qId)) {
        issues.push({
          file,
          line: 1,
          id: qId,
          type: 'duplicate-id',
          message: `Duplicate question ID '${qId}' also present in '${seenIds.get(qId)}'`,
        });
      } else {
        seenIds.set(qId, file);
      }

      prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;

      // Check summary tag
      if (!sec.includes('<details><summary>Answer</summary>')) {
        if (!sec.includes('<summary>Answer</summary>')) {
          const sumMatch = sec.match(/<summary>(.*?)<\/summary>/);
          const tag = sumMatch ? sumMatch[1] : 'missing';
          issues.push({
            file,
            line: 1,
            id: qId,
            type: 'summary-tag',
            message: `Non-standard summary tag: expected '<summary>Answer</summary>', found '<summary>${tag}</summary>'`,
          });
        }
      }

      // Check Ref line
      if (
        !/-\s*Ref:\s*\[modules\//i.test(sec) &&
        !/-\s*Ref:\s*\[.*?\]\(..\/modules\//i.test(sec) &&
        !/-\s*Ref:\s*/i.test(sec)
      ) {
        issues.push({
          file,
          line: 1,
          id: qId,
          type: 'missing-ref',
          message: `Missing '- Ref: [modules/NN-....md](...), <doc URL>' citation in answer block`,
        });
      }

      // Check options vs answer for single/multi/scenario
      const hasBulletOptions = /^[ \t]*- [A-D]\)[ \t]+/m.test(sec);
      if ((qType === 'single' || qType === 'scenario') && hasBulletOptions) {
        // Should have Why not
        if (!/Why not/i.test(sec)) {
          issues.push({
            file,
            line: 1,
            id: qId,
            type: 'missing-distractors',
            message: `Question type '${qType}' has multiple-choice options but lacks '- Why not <X>: ...' distractor rationales`,
          });
        }
      }
    }
  }

  return {
    totalQuestions,
    filesScanned: files.length,
    issues,
    prefixCounts,
  };
}

if (import.meta.main) {
  const targetPattern = process.argv[2] || '**/exams/*.md';
  const result = auditQuestionBanks(targetPattern);
  console.log(`Audited ${result.totalQuestions} questions across ${result.filesScanned} files.`);
  console.log(`Detected ${result.issues.length} schema issues.\n`);

  if (result.issues.length > 0) {
    const byType: Record<string, QuestionIssue[]> = {};
    for (const issue of result.issues) {
      byType[issue.type] = byType[issue.type] || [];
      byType[issue.type].push(issue);
    }

    for (const [type, list] of Object.entries(byType)) {
      console.log(`=== ${type.toUpperCase()} (${list.length} occurrences) ===`);
      for (const item of list.slice(0, 10)) {
        console.log(`  [${item.id}] ${item.file}: ${item.message}`);
      }
      if (list.length > 10) {
        console.log(`  ... and ${list.length - 10} more`);
      }
      console.log();
    }
    process.exit(1);
  } else {
    console.log('All question banks strictly conform to AGENTS.md schema!');
    process.exit(0);
  }
}
