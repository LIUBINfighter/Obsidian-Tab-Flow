import { toFiniteClampedNumber } from '../../utils/numberUtils';
import type { TrackConfig } from '../types/workspace-config-schema';

interface StaffLike {
	showNumbered?: boolean;
	showSlash?: boolean;
	showStandardNotation?: boolean;
	showTablature?: boolean;
}

interface TrackLike {
	staves?: Array<StaffLike | null | undefined> | null;
}

interface ScoreLike {
	tracks?: Array<TrackLike | null | undefined> | null;
}

function ensureStaffVisible(staff: StaffLike): boolean {
	const hasVisibleStaff =
		staff.showTablature === true ||
		staff.showStandardNotation === true ||
		staff.showSlash === true ||
		staff.showNumbered === true;

	if (hasVisibleStaff) {
		return false;
	}

	staff.showStandardNotation = true;
	return true;
}

export function disableUnsafeNumberedNotation(score: ScoreLike | null | undefined): boolean {
	if (!score?.tracks?.length) {
		return false;
	}

	let changed = false;

	for (const track of score.tracks) {
		if (!track?.staves?.length) {
			continue;
		}

		for (const staff of track.staves) {
			if (!staff) {
				continue;
			}

			if (staff.showNumbered === true) {
				staff.showNumbered = false;
				changed = true;
			}

			if (ensureStaffVisible(staff)) {
				changed = true;
			}
		}
	}

	return changed;
}

export function sanitizeTrackConfig(
	trackIndex: number,
	config: Partial<TrackConfig>
): Partial<TrackConfig> {
	const sanitized: Partial<TrackConfig> = { trackIndex };

	if (typeof config.isMute === 'boolean') {
		sanitized.isMute = config.isMute;
	}

	if (typeof config.isSolo === 'boolean') {
		sanitized.isSolo = config.isSolo;
	}

	if (config.volume !== undefined) {
		sanitized.volume = toFiniteClampedNumber(config.volume, 8, 0, 16);
	}

	if (config.transposeAudio !== undefined) {
		sanitized.transposeAudio = Math.trunc(
			toFiniteClampedNumber(config.transposeAudio, 0, -12, 12)
		);
	}

	if (config.transposeFull !== undefined) {
		sanitized.transposeFull = Math.trunc(
			toFiniteClampedNumber(config.transposeFull, 0, -12, 12)
		);
	}

	return sanitized;
}
