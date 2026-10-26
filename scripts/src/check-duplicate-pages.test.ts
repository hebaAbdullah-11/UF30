import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { findDuplicateSourceProblems } from './check-duplicate-pages.js';

test('detects a concatenated page fixture', async () => {
  const fixtureUrl = new URL(
    './fixtures/concatenated-page.fixture.txt',
    import.meta.url,
  );
  const source = await readFile(fileURLToPath(fixtureUrl), 'utf8');
  const problems = findDuplicateSourceProblems(source, 'dashboard.tsx');

  assert.ok(
    problems.some((problem) =>
      problem.message.includes('second top-level import block'),
    ),
  );
  assert.ok(
    problems.some((problem) =>
      problem.message.includes('page component Dashboard duplicates'),
    ),
  );
});

test('allows one import block and multiple distinct components', () => {
  const problems = findDuplicateSourceProblems(`
    import React from 'react';
    function Header() { return <header />; }
    export default function Dashboard() { return <Header />; }
  `);

  assert.deepEqual(problems, []);
});