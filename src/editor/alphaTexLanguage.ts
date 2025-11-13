import { StreamLanguage } from '@codemirror/stream-parser';
import { Extension } from '@codemirror/state';

/**
 * Lightweight Stream parser for AlphaTex.
 * - Recognizes: metadata tags (\tag), comments, section-dot ('.'), bar '|',
 *   notes f.s.d (e.g. 3.3.4), chords ( ... ), effect blocks { ... }, strings, numbers.
 *
 * Usage:
 *   import { alphaTex } from './alphaTexLanguage';
 *   extensions.push(...alphaTex());
 */

// CodeMirror stream parser types
interface StreamParser {
	eatSpace(): boolean;
	match(pattern: string | RegExp): boolean | RegExpMatchArray | null;
	skipToEnd(): void;
	skipTo(pattern: string): boolean;
	next(): string | null;
}

interface ParserState {
	tokenize: (stream: StreamParser, state: ParserState) => string | null;
}

function tokenBase(stream: StreamParser, state: ParserState) {
	// Whitespace
	if (stream.eatSpace()) return null;

	// Single-line comment //
	if (stream.match('//')) {
		stream.skipToEnd();
		return 'comment';
	}

	// Multi-line comment /* ... */
	if (stream.match('/*')) {
		state.tokenize = tokenComment;
		return state.tokenize(stream, state);
	}

	// Metadata tag: \tagName (maybe followed by args)
	if (stream.match(/\\[A-Za-z_][A-Za-z0-9_-]*/)) {
		return 'metadata';
	}

	// Chord literals: common guitar chords like Bm/D, Cadd9, G/B, Am7, G, F, B7, Em
	// Pattern: [A-G][#b]?[mM]?[0-9]*[sus|add|dim|aug|maj]?[0-9]*[/[A-G][#b]?]?[0-9]*
	if (
		stream.match(/[A-G][#b]?[mM]?[0-9]*(?:sus|add|dim|aug|maj)?[0-9]*(?:\/[A-G][#b]?)?[0-9]*/)
	) {
		return 'chord';
	}

	// Strings "..." or '...'
	if (stream.match(/"(?:\\.|[^"\\])*"/) || stream.match(/'(?:\\.|[^'\\])*'/)) {
		return 'string';
	}

	// Beat-duration :[0-9]+
	if (stream.match(/:[0-9]+/)) {
		return 'duration';
	}

	// Tuning literal [A-Ga-g][0-9]+
	if (stream.match(/[A-Ga-g][0-9]+/)) {
		return 'tuning';
	}

	// Boolean literals
	if (stream.match('true') || stream.match('false')) {
		return 'boolean';
	}

	// Effects keywords (beat/note from TextMate)
	const beatEffects =
		/f|fo|vs|v|vw|s|p|tt|txt|lyrics|dd|d|su|sd|tuplet|tb|tbe|bu|bd|ai|ad|ch|gr|ob|b|dy|cre|dec|tempo|volume|balance|tp|spd|sph|spu|spe|slashed|glpf|glpt|waho|wahc|barre|rasg|ot|legaoorigin|instrument|bank|fermata|beam|timer/;
	const noteEffects =
		/b|be|nh|ah|th|ph|sh|fh|tr|v|vw|sl|ss|sib|sia|sou|sod|psd|psu|h|lht|g|ac|hac|ten|pm|st|lr|x|t|lf|rf|acc|turn|iturn|umordent|lmordent|string|hide|slur/;
	if (stream.match(beatEffects)) {
		return 'effect.beat';
	}
	if (stream.match(noteEffects)) {
		return 'effect.note';
	}

	// Section separator dot (single dot on its own or dot as separator)
	if (stream.match(/^\.(?=\s|$|\n)/)) {
		// single dot section separator
		return 'dot';
	}

	// Bar symbol
	if (stream.match('|')) {
		return 'bar';
	}

	// Effect block start { ... }
	if (stream.match('{')) {
		// mark opening brace as bracket
		state.tokenize = tokenEffect;
		return 'bracket';
	}

	// Chord/group start '(' ... ')'
	if (stream.match('(')) {
		state.tokenize = tokenChord;
		return 'bracket';
	}

	// Closing delimiters
	if (stream.match(')') || stream.match('}')) {
		return 'bracket';
	}

	// Note pattern: fret.string.duration like 3.3.4 or r.8 or 0.6.2
	if (stream.match(/(?:[0-9x-]+)\.[0-9]+(?:\.[0-9]+)?/)) {
		return 'note';
	}

	// Numbers (integers, floats)
	if (stream.match(/^[0-9]+(\.[0-9]+)?/)) {
		return 'number';
	}

	// Identifiers (e.g. keywords in metadata like ts, ks, tempo)
	if (stream.match(/^[A-Za-z_][A-Za-z0-9_-]*/)) {
		return 'keyword';
	}

	// Fallback: consume one char
	stream.next();
	return null;
}

function tokenComment(stream: StreamParser, state: ParserState) {
	if (stream.skipTo('*/')) {
		stream.match('*/');
		state.tokenize = tokenBase;
	} else {
		stream.skipToEnd();
	}
	return 'comment';
}

function tokenEffect(stream: StreamParser, state: ParserState) {
	// consume until matching '}' (no nested handling)
	if (stream.skipTo('}')) {
		// do not consume the closing '}' here; leave it to tokenBase to mark as 'bracket'
		state.tokenize = tokenBase;
	} else {
		stream.skipToEnd();
	}
	return 'effect';
}

function tokenChord(stream: StreamParser, state: ParserState) {
	// consume until ')'
	if (stream.skipTo(')')) {
		// leave the closing ')' for tokenBase to mark as 'bracket'
		state.tokenize = tokenBase;
	} else {
		stream.skipToEnd();
	}
	return 'chord';
}

const alphaTexParser = StreamLanguage.define({
	startState() {
		return { tokenize: tokenBase };
	},
	token(stream: StreamParser, state: ParserState) {
		return state.tokenize(stream, state);
	},
	blankLine(state: ParserState) {
		// reset inline tokenizers on blank lines
		state.tokenize = tokenBase;
	},
} as unknown);

// Note: styling will be provided via CSS classes (cm-*) emitted by the stream parser.
// Avoid runtime dependency on deprecated highlight tags which may be absent in host.

/**
 * Helper to produce the needed extensions array.
 */
export function alphaTex(): Extension[] {
	// Only return the StreamLanguage parser; styling is handled by CSS classes.
	return [alphaTexParser];
}

export default alphaTex;
