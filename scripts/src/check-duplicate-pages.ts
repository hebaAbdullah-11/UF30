import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export type DuplicateSourceProblem = {
  line: number;
  message: string;
};

function isDirective(statement: ts.Statement) {
  return (
    ts.isExpressionStatement(statement) &&
    ts.isStringLiteral(statement.expression)
  );
}

function isImport(statement: ts.Statement) {
  return (
    ts.isImportDeclaration(statement) ||
    ts.isImportEqualsDeclaration(statement)
  );
}

function declarationNames(statement: ts.Statement) {
  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement)) &&
    statement.name
  ) {
    return [statement.name];
  }

  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations
      .map((declaration) => declaration.name)
      .filter(ts.isIdentifier);
  }

  return [];
}

function isPageComponentName(name: string) {
  return /^[A-Z]/.test(name);
}

export function findDuplicateSourceProblems(
  sourceText: string,
  fileName = 'source.tsx',
): DuplicateSourceProblem[] {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const problems: DuplicateSourceProblem[] = [];
  const components = new Map<string, number>();
  let importsFinished = false;
  let defaultExportLine: number | undefined;

  for (const statement of source.statements) {
    const line = source.getLineAndCharacterOfPosition(statement.getStart()).line + 1;

    if (isImport(statement)) {
      if (importsFinished) {
        problems.push({
          line,
          message: 'found a second top-level import block',
        });
      }
      continue;
    }

    if (!isDirective(statement)) {
      importsFinished = true;
    }

    for (const name of declarationNames(statement)) {
      if (!isPageComponentName(name.text)) continue;

      const firstLine = components.get(name.text);
      if (firstLine !== undefined) {
        problems.push({
          line,
          message: `page component ${name.text} duplicates its declaration on line ${firstLine}`,
        });
      } else {
        components.set(name.text, line);
      }
    }

    const modifiers = ts.canHaveModifiers(statement)
      ? ts.getModifiers(statement)
      : undefined;
    const isDefaultExport = modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
    );
    if (isDefaultExport) {
      if (defaultExportLine !== undefined) {
        problems.push({
          line,
          message: `default page export duplicates the export on line ${defaultExportLine}`,
        });
      } else {
        defaultExportLine = line;
      }
    }
  }

  return problems;
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(entryPath);
      return /\.[cm]?tsx?$/.test(entry.name) ? [entryPath] : [];
    }),
  );
  return files.flat();
}

export async function checkDirectory(directory: string) {
  const failures: string[] = [];
  for (const file of await sourceFiles(directory)) {
    const sourceText = await readFile(file, 'utf8');
    for (const problem of findDuplicateSourceProblems(sourceText, file)) {
      failures.push(`${file}:${problem.line} ${problem.message}`);
    }
  }
  return failures;
}

async function main() {
  const workspaceDirectory = fileURLToPath(new URL('../../', import.meta.url));
  const sourceDirectory = path.resolve(
    workspaceDirectory,
    'artifacts/mindful-companion/src',
  );
  const failures = await checkDirectory(sourceDirectory);
  if (failures.length > 0) {
    console.error('Duplicate TypeScript source detected:\n');
    console.error(failures.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`Duplicate source check passed for ${sourceDirectory}`);
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  await main();
}