import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { linter, type Diagnostic } from '@codemirror/lint';
import * as alphaTab from '@coderline/alphatab';

type AlphaTexDiagnostic = alphaTab.importer.alphaTex.AlphaTexDiagnostic;
type AlphaTexDiagnosticBag = alphaTab.importer.alphaTex.AlphaTexDiagnosticBag;

type DiagnosticErrorCandidate = {
	iterateDiagnostics?: () => Iterable<AlphaTexDiagnostic>;
	cause?: unknown;
	inner?: unknown;
};

const DIAGNOSTIC_DELAY_MS = 400;

function collectDiagnosticsFromBag(
	bag: AlphaTexDiagnosticBag | undefined,
	target: AlphaTexDiagnostic[]
): void {
	if (!bag) return;
	for (const diagnostic of bag) {
		target.push(diagnostic);
	}
}

function collectDiagnosticsFromError(error: unknown, target: AlphaTexDiagnostic[]): void {
	if (!error || typeof error !== 'object') return;

	const candidate = error as DiagnosticErrorCandidate;
	if (typeof candidate.iterateDiagnostics === 'function') {
		for (const diagnostic of candidate.iterateDiagnostics()) {
			target.push(diagnostic);
		}
	}

	collectDiagnosticsFromError(candidate.cause, target);
	collectDiagnosticsFromError(candidate.inner, target);
}

function toSeverity(
	severity: alphaTab.importer.alphaTex.AlphaTexDiagnosticsSeverity
): Diagnostic['severity'] {
	if (severity === alphaTab.importer.alphaTex.AlphaTexDiagnosticsSeverity.Error) {
		return 'error';
	}
	if (severity === alphaTab.importer.alphaTex.AlphaTexDiagnosticsSeverity.Warning) {
		return 'warning';
	}
	return 'info';
}

function toCodeMirrorDiagnostic(
	diagnostic: AlphaTexDiagnostic,
	docLength: number
): Diagnostic | null {
	const startOffset = diagnostic.start?.offset;
	if (typeof startOffset !== 'number' || !Number.isFinite(startOffset)) return null;

	const rawEndOffset = diagnostic.end?.offset;
	const from = Math.max(0, Math.min(docLength, Math.floor(startOffset)));
	const fallbackTo = from < docLength ? from + 1 : from;
	const to =
		typeof rawEndOffset === 'number' && Number.isFinite(rawEndOffset)
			? Math.max(from + 1, Math.min(docLength, Math.floor(rawEndOffset)))
			: fallbackTo;
	const code =
		typeof diagnostic.code === 'number' ? `AT${diagnostic.code}` : String(diagnostic.code);

	return {
		from,
		to: Math.max(from, to),
		severity: toSeverity(diagnostic.severity),
		message: `[${code}] ${diagnostic.message}`,
		source: 'alphaTab AlphaTex',
	};
}

function deduplicateDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
	const seen = new Set<string>();
	const unique: Diagnostic[] = [];
	for (const diagnostic of diagnostics) {
		const key = `${diagnostic.from}:${diagnostic.to}:${diagnostic.severity}:${diagnostic.message}`;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(diagnostic);
	}
	return unique;
}

export function getAlphaTexDiagnostics(text: string): Diagnostic[] {
	if (!text.trim()) return [];

	const importer = new alphaTab.importer.AlphaTexImporter();
	importer.initFromString(text, new alphaTab.Settings());
	if (importer.parser) {
		importer.parser.mode = alphaTab.importer.alphaTex.AlphaTexParseMode.Full;
	}

	const alphaTexDiagnostics: AlphaTexDiagnostic[] = [];
	try {
		importer.readScore();
	} catch (error) {
		collectDiagnosticsFromError(error, alphaTexDiagnostics);
	}

	collectDiagnosticsFromBag(importer.lexerDiagnostics, alphaTexDiagnostics);
	collectDiagnosticsFromBag(importer.parserDiagnostics, alphaTexDiagnostics);
	collectDiagnosticsFromBag(importer.semanticDiagnostics, alphaTexDiagnostics);

	return deduplicateDiagnostics(
		alphaTexDiagnostics
			.map((diagnostic) => toCodeMirrorDiagnostic(diagnostic, text.length))
			.filter((diagnostic): diagnostic is Diagnostic => diagnostic !== null)
	);
}

function getLineColumnAtOffset(text: string, offset: number): { line: number; column: number } {
	const safeOffset = Math.max(0, Math.min(text.length, offset));
	let line = 1;
	let lineStart = 0;

	for (let index = 0; index < safeOffset; index++) {
		if (text.charCodeAt(index) === 10) {
			line++;
			lineStart = index + 1;
		}
	}

	return { line, column: safeOffset - lineStart + 1 };
}

export function getAlphaTexDiagnosticMessages(text: string, maxMessages = 6): string[] {
	const diagnostics = getAlphaTexDiagnostics(text).filter(
		(diagnostic) => diagnostic.severity === 'error'
	);
	const messages = diagnostics.slice(0, maxMessages).map((diagnostic) => {
		const location = getLineColumnAtOffset(text, diagnostic.from);
		return `Line ${location.line}, column ${location.column}: ${diagnostic.message}`;
	});
	const remaining = diagnostics.length - messages.length;

	if (remaining > 0) {
		messages.push(`${remaining} more AlphaTex error${remaining === 1 ? '' : 's'} not shown.`);
	}

	return messages;
}

function alphaTexDiagnosticSource(view: EditorView): Diagnostic[] {
	return getAlphaTexDiagnostics(view.state.doc.toString());
}

export function createAlphaTexDiagnostics(): Extension[] {
	return [linter(alphaTexDiagnosticSource, { delay: DIAGNOSTIC_DELAY_MS })];
}
