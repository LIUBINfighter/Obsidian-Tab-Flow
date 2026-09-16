import {
	CompletionContext,
	CompletionResult,
	snippetCompletion,
	autocompletion,
} from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';
import { EditorView, Tooltip, hoverTooltip, tooltips } from '@codemirror/view';
import { documentation } from '@coderline/alphatab-language-server';

interface AlphaTexSignatureParameter {
	name: string;
	shortDescription?: string;
	longDescription?: string;
	values?: Array<{
		name: string;
		snippet?: string;
		shortDescription?: string;
	}>;
}

interface AlphaTexSignature {
	description?: string;
	parameters: AlphaTexSignatureParameter[];
}

interface AlphaTexDefinition {
	tag?: string;
	property?: string;
	snippet?: string;
	shortDescription?: string;
	longDescription?: string;
	signatures?: AlphaTexSignature[];
	examples?: string | { tex?: string };
	properties?: Map<string, AlphaTexDefinition>;
}

interface AlphaTexDocumentation {
	structuralMetaData: Map<string, AlphaTexDefinition>;
	scoreMetaData: Map<string, AlphaTexDefinition>;
	staffMetaData: Map<string, AlphaTexDefinition>;
	barMetaData: Map<string, AlphaTexDefinition>;
	durationChangeProperties: Map<string, AlphaTexDefinition>;
	beatProperties: Map<string, AlphaTexDefinition>;
	noteProperties: Map<string, AlphaTexDefinition>;
}

type DefinitionKind = 'metadata' | 'property' | 'snippet';

interface DefinitionEntry {
	label: string;
	section: string;
	type: 'function' | 'property' | 'keyword';
	kind: DefinitionKind;
	definition: AlphaTexDefinition;
	boost: number;
}

interface AlphaTexSnippet {
	label: string;
	detail: string;
	template: string;
	description: string;
}

const alphaTexDocumentation = documentation as AlphaTexDocumentation;

const metadataSections: Array<[string, Map<string, AlphaTexDefinition>, number]> = [
	['Structure', alphaTexDocumentation.structuralMetaData, 12],
	['Score metadata', alphaTexDocumentation.scoreMetaData, 8],
	['Staff metadata', alphaTexDocumentation.staffMetaData, 7],
	['Bar metadata', alphaTexDocumentation.barMetaData, 6],
];

const propertySections: Array<[string, Map<string, AlphaTexDefinition>, number]> = [
	['Beat properties', alphaTexDocumentation.beatProperties, 8],
	['Note properties', alphaTexDocumentation.noteProperties, 7],
	['Duration properties', alphaTexDocumentation.durationChangeProperties, 6],
];

const alphaTexSnippets: AlphaTexSnippet[] = [
	{
		label: 'tab',
		detail: 'Full guitar tab scaffold',
		template:
			'\\title "${Title}"\n\\artist "${Artist}"\n\\tempo 120\n\\track "Guitar"\n  \\staff{tabs}\n  \\tuning E4 B3 G3 D3 A2 E2\n  :8 ${}',
		description:
			'Create a basic six-string guitar AlphaTex document with title, artist, tempo, track, staff, and standard tuning.',
	},
	{
		label: 'trk',
		detail: 'Track and tab staff',
		template: '\\track "${Guitar}"\n  \\staff{tabs}\n  \\tuning E4 B3 G3 D3 A2 E2\n  ${0}',
		description: 'Insert a guitar track with a tablature staff and standard tuning.',
	},
	{
		label: 'sec',
		detail: 'Section marker',
		template: '\\section "${Verse}"\n${0}',
		description: 'Insert a named section marker for verse, chorus, bridge, or solo navigation.',
	},
	{
		label: 'cho',
		detail: 'Chord diagram definition',
		template: '\\chord ("${Name}" ${frets})',
		description: 'Define a chord diagram. Enter one fret per string, or x for muted strings.',
	},
	{
		label: 'riff',
		detail: 'One-bar eighth-note riff',
		template: ':8 ${note1} ${note2} ${note3} ${note4} | ${}',
		description: 'Start a simple eighth-note riff and leave the cursor after the first bar.',
	},
	{
		label: 'rep',
		detail: 'Repeat block',
		template: '\\ro\n  ${}\n| \\rc ${repeats}',
		description: 'Insert repeat-open and repeat-close markers around a bar phrase.',
	},
	{
		label: 'voice',
		detail: 'Voice block',
		template: '\\voice\n  ${0}',
		description: 'Start a new AlphaTex voice.',
	},
];

let metadataEntries: DefinitionEntry[] | null = null;
let propertyEntries: DefinitionEntry[] | null = null;
let snippetEntries: DefinitionEntry[] | null = null;
let lookupEntries: Map<string, DefinitionEntry> | null = null;

function normalizeSnippet(template: string, fallback: string): string {
	const source = template.trim().length > 0 ? template : fallback;
	return source
		.replace(/\$\{\d+:([^}]+)\}/g, (_match, value: string) => `\${${value}}`)
		.replace(/\$(\d+)/g, (_match, index: string) => (index === '0' ? '${}' : '${}'));
}

function getDefinitionLabel(definition: AlphaTexDefinition): string {
	return definition.tag ?? definition.property ?? '';
}

function buildMetadataEntries(): DefinitionEntry[] {
	if (metadataEntries) return metadataEntries;
	metadataEntries = metadataSections.flatMap(([section, map, boost]) =>
		Array.from(map.values()).map((definition) => ({
			label: getDefinitionLabel(definition),
			section,
			type: 'function' as const,
			kind: 'metadata' as const,
			definition,
			boost,
		}))
	);
	return metadataEntries;
}

function buildPropertyEntries(): DefinitionEntry[] {
	if (propertyEntries) return propertyEntries;
	propertyEntries = propertySections.flatMap(([section, map, boost]) =>
		Array.from(map.values()).map((definition) => ({
			label: getDefinitionLabel(definition),
			section,
			type: 'property' as const,
			kind: 'property' as const,
			definition,
			boost,
		}))
	);
	return propertyEntries;
}

function buildSnippetEntries(): DefinitionEntry[] {
	if (snippetEntries) return snippetEntries;
	snippetEntries = alphaTexSnippets.map((item) => ({
		label: item.label,
		section: 'Snippets',
		type: 'keyword' as const,
		kind: 'snippet' as const,
		definition: {
			property: item.label,
			snippet: item.template,
			shortDescription: item.detail,
			longDescription: item.description,
		},
		boost: 15,
	}));
	return snippetEntries;
}

function buildLookupEntries(): Map<string, DefinitionEntry> {
	if (lookupEntries) return lookupEntries;
	lookupEntries = new Map<string, DefinitionEntry>();
	for (const entry of [
		...buildMetadataEntries(),
		...buildPropertyEntries(),
		...buildSnippetEntries(),
	]) {
		lookupEntries.set(entry.label.toLowerCase(), entry);
	}
	return lookupEntries;
}

function completionInfo(entry: DefinitionEntry, hover = false): HTMLElement {
	const container = document.createElement('div');
	container.className = hover
		? 'alphatex-intelligence-info alphatex-intelligence-hover'
		: 'alphatex-intelligence-info';

	const title = appendDiv(container, 'alphatex-intelligence-title');
	title.textContent = entry.label;

	const description = entry.definition.longDescription ?? entry.definition.shortDescription;
	if (description) {
		const body = appendDiv(container, 'alphatex-intelligence-description');
		body.textContent = description;
	}

	const signatures = entry.definition.signatures ?? [];
	if (signatures.length > 0) {
		const syntax = appendPre(container, 'alphatex-intelligence-syntax');
		syntax.textContent = signatures
			.map((signature) => formatSignature(entry.label, signature))
			.join('\n');
	}

	const exampleText = getExampleText(entry.definition.examples);
	if (exampleText) {
		const example = appendPre(container, 'alphatex-intelligence-example');
		example.textContent = exampleText;
	}

	return container;
}

function appendDiv(parent: HTMLElement, className: string): HTMLDivElement {
	const child = document.createElement('div');
	child.className = className;
	parent.appendChild(child);
	return child;
}

function appendPre(parent: HTMLElement, className: string): HTMLPreElement {
	const child = document.createElement('pre');
	child.className = className;
	parent.appendChild(child);
	return child;
}

function formatSignature(label: string, signature: AlphaTexSignature): string {
	if (signature.parameters.length === 0) return label;
	return `${label} ${signature.parameters.map((parameter) => `<${parameter.name}>`).join(' ')}`;
}

function getExampleText(examples: AlphaTexDefinition['examples']): string | null {
	if (!examples) return null;
	if (typeof examples === 'string') return examples.trim();
	return examples.tex?.trim() || null;
}

function toCompletion(entry: DefinitionEntry) {
	const fallback = entry.kind === 'metadata' ? entry.label : entry.label;
	return snippetCompletion(normalizeSnippet(entry.definition.snippet ?? fallback, fallback), {
		label: entry.label,
		type: entry.type,
		detail: entry.definition.shortDescription,
		section: entry.section,
		boost: entry.boost,
		info: () => completionInfo(entry),
	});
}

function linePrefix(context: CompletionContext): string {
	const line = context.state.doc.lineAt(context.pos);
	return line.text.slice(0, context.pos - line.from);
}

function isInsidePropertyBlock(prefix: string): boolean {
	return prefix.lastIndexOf('{') > prefix.lastIndexOf('}');
}

function metadataMatch(prefix: string, pos: number) {
	const match = /\\[A-Za-z_][A-Za-z0-9_-]*$|\\$/.exec(prefix);
	return match ? { from: pos - match[0].length, text: match[0] } : null;
}

function wordMatch(prefix: string, pos: number) {
	const match = /[A-Za-z_][A-Za-z0-9_-]*$/.exec(prefix);
	return match ? { from: pos - match[0].length, text: match[0] } : null;
}

export function alphaTexCompletionSource(context: CompletionContext): CompletionResult | null {
	const prefix = linePrefix(context);
	const metadata = metadataMatch(prefix, context.pos);
	if (metadata) {
		return {
			from: metadata.from,
			options: buildMetadataEntries().map(toCompletion),
			validFor: /^\\?[A-Za-z_][A-Za-z0-9_-]*$|^\\$/,
		};
	}

	const word = wordMatch(prefix, context.pos);
	const inPropertyBlock = isInsidePropertyBlock(prefix);
	if (inPropertyBlock && (word || context.explicit)) {
		return {
			from: word?.from ?? context.pos,
			options: buildPropertyEntries().map(toCompletion),
			validFor: /^[A-Za-z_][A-Za-z0-9_-]*$/,
		};
	}

	if (word && word.text.length > 0) {
		return {
			from: word.from,
			options: buildSnippetEntries().map(toCompletion),
			validFor: /^[A-Za-z_][A-Za-z0-9_-]*$/,
		};
	}

	if (context.explicit) {
		return {
			from: context.pos,
			options: [...buildSnippetEntries(), ...buildMetadataEntries()].map(toCompletion),
		};
	}

	return null;
}

function tokenAt(view: EditorView, pos: number) {
	const line = view.state.doc.lineAt(pos);
	const offset = pos - line.from;
	let start = offset;
	let end = offset;
	while (start > 0 && /[\\A-Za-z0-9_-]/.test(line.text.charAt(start - 1))) start--;
	while (end < line.text.length && /[\\A-Za-z0-9_-]/.test(line.text.charAt(end))) end++;
	const text = line.text.slice(start, end);
	return text ? { from: line.from + start, to: line.from + end, text } : null;
}

function lookupDefinition(token: string): DefinitionEntry | null {
	const entries = buildLookupEntries();
	return entries.get(token.toLowerCase()) ?? null;
}

function createHoverTooltip(entry: DefinitionEntry, from: number, to: number): Tooltip {
	return {
		pos: from,
		end: to,
		above: true,
		arrow: true,
		clip: false,
		create() {
			return { dom: completionInfo(entry, true) };
		},
	};
}

export function alphaTexHoverTooltip(): Extension {
	return hoverTooltip((view, pos) => {
		const token = tokenAt(view, pos);
		if (!token) return null;
		const entry = lookupDefinition(token.text);
		return entry ? createHoverTooltip(entry, token.from, token.to) : null;
	});
}

export function createAlphaTexIntelligence(): Extension[] {
	const tooltipParent = typeof document === 'undefined' ? undefined : document.body;

	return [
		tooltips({
			parent: tooltipParent,
			position: 'absolute',
		}),
		autocompletion({
			override: [alphaTexCompletionSource],
			activateOnTyping: true,
			activateOnTypingDelay: 60,
			tooltipClass: () => 'alphatex-intelligence-tooltip',
		}),
		alphaTexHoverTooltip(),
	];
}
