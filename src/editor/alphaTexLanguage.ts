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
// CodeMirror's StringStream type is not directly accessible, so we define our own interface
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

function tokenBase(stream: unknown, state: ParserState) {
	const s = stream as StreamParser;
	// Whitespace
	if (s.eatSpace()) return null;

	// Single-line comment //
	if (s.match('//')) {
		s.skipToEnd();
		return 'comment';
	}

	// Multi-line comment /* ... */
	if (s.match('/*')) {
		state.tokenize = tokenComment;
		return state.tokenize(s, state);
	}

	// Metadata tag: \tagName (maybe followed by args)
	if (s.match(/\\[A-Za-z_][A-Za-z0-9_-]*/)) {
		return 'metadata';
	}

	// Chord literals: common guitar chords like Bm/D, Cadd9, G/B, Am7, G, F, B7, Em
	// Pattern: [A-G][#b]?[mM]?[0-9]*[sus|add|dim|aug|maj]?[0-9]*[/[A-G][#b]?]?[0-9]*
	if (
		s.match(/[A-G][#b]?[mM]?[0-9]*(?:sus|add|dim|aug|maj)?[0-9]*(?:\/[A-G][#b]?)?[0-9]*/)
	) {
		return 'chord';
	}

	// Strings "..." or '...'
	if (s.match(/"(?:\\.|[^"\\])*"/) || s.match(/'(?:\\.|[^'\\])*'/)) {
		return 'string';
	}

	// Beat-duration :[0-9]+
	if (s.match(/:[0-9]+/)) {
		return 'duration';
	}

	// Tuning literal [A-Ga-g][0-9]+
	if (s.match(/[A-Ga-g][0-9]+/)) {
		return 'tuning';
	}

	// Boolean literals
	if (s.match('true') || s.match('false')) {
		return 'boolean';
	}

	// Effects keywords (beat/note from TextMate)
	const beatEffects =
		/f|fo|vs|v|vw|s|p|tt|txt|lyrics|dd|d|su|sd|tuplet|tb|tbe|bu|bd|ai|ad|ch|gr|ob|b|dy|cre|dec|tempo|volume|balance|tp|spd|sph|spu|spe|slashed|glpf|glpt|waho|wahc|barre|rasg|ot|legaoorigin|instrument|bank|fermata|beam|timer/;
	const noteEffects =
		/b|be|nh|ah|th|ph|sh|fh|tr|v|vw|sl|ss|sib|sia|sou|sod|psd|psu|h|lht|g|ac|hac|ten|pm|st|lr|x|t|lf|rf|acc|turn|iturn|umordent|lmordent|string|hide|slur/;
	if (s.match(beatEffects)) {
		return 'effect.beat';
	}
	if (s.match(noteEffects)) {
		return 'effect.note';
	}

	// Section separator dot (single dot on its own or dot as separator)
	if (s.match(/^\.(?=\s|$|\n)/)) {
		// single dot section separator
		return 'dot';
	}

	// Bar symbol
	if (s.match('|')) {
		return 'bar';
	}

	// Effect block start { ... }
	if (s.match('{')) {
		// mark opening brace as bracket
		state.tokenize = tokenEffect;
		return 'bracket';
	}

	// Chord/group start '(' ... ')'
	if (s.match('(')) {
		state.tokenize = tokenChord;
		return 'bracket';
	}

	// Closing delimiters
	if (s.match(')') || s.match('}')) {
		return 'bracket';
	}

	// Note pattern: fret.string.duration like 3.3.4 or r.8 or 0.6.2
	if (s.match(/(?:[0-9x-]+)\.[0-9]+(?:\.[0-9]+)?/)) {
		return 'note';
	}

	// Numbers (integers, floats)
	if (s.match(/^[0-9]+(\.[0-9]+)?/)) {
		return 'number';
	}

	// Identifiers (e.g. keywords in metadata like ts, ks, tempo)
	if (s.match(/^[A-Za-z_][A-Za-z0-9_-]*/)) {
		return 'keyword';
	}

	// Fallback: consume one char
	s.next();
	return null;
}

function tokenComment(stream: unknown, state: ParserState) {
	const s = stream as StreamParser;
	if (s.skipTo('*/')) {
		s.match('*/');
		state.tokenize = tokenBase;
	} else {
		s.skipToEnd();
	}
	return 'comment';
}

function tokenEffect(stream: unknown, state: ParserState) {
	const s = stream as StreamParser;
	// consume until matching '}' (no nested handling)
	if (s.skipTo('}')) {
		// do not consume the closing '}' here; leave it to tokenBase to mark as 'bracket'
		state.tokenize = tokenBase;
	} else {
		s.skipToEnd();
	}
	return 'effect';
}

function tokenChord(stream: unknown, state: ParserState) {
	const s = stream as StreamParser;
	// consume until ')'
	if (s.skipTo(')')) {
		// leave the closing ')' for tokenBase to mark as 'bracket'
		state.tokenize = tokenBase;
	} else {
		s.skipToEnd();
	}
	return 'chord';
}

const alphaTexParser = StreamLanguage.define({
	startState() {
		return { tokenize: tokenBase };
	},
	token(stream: unknown, state: ParserState) {
		return state.tokenize(stream as StreamParser, state);
	},
	blankLine(state: ParserState) {
		// reset inline tokenizers on blank lines
		state.tokenize = tokenBase;
	},
});

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
