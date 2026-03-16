import * as alphaTab from '@coderline/alphatab';

interface StaffVisibility {
	showStandardNotation: boolean;
	showTablature: boolean;
}

function getStaffVisibility(profile: alphaTab.StaveProfile): StaffVisibility | null {
	switch (profile) {
		case alphaTab.StaveProfile.ScoreTab:
			return { showStandardNotation: true, showTablature: true };
		case alphaTab.StaveProfile.Score:
			return { showStandardNotation: true, showTablature: false };
		case alphaTab.StaveProfile.Tab:
		case alphaTab.StaveProfile.TabMixed:
			return { showStandardNotation: false, showTablature: true };
		case alphaTab.StaveProfile.Default:
		default:
			return null;
	}
}

export function toStaveProfile(
	value: unknown,
	fallback: alphaTab.StaveProfile = alphaTab.StaveProfile.Default
): alphaTab.StaveProfile {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return fallback;
	}

	switch (value) {
		case alphaTab.StaveProfile.Default:
		case alphaTab.StaveProfile.ScoreTab:
		case alphaTab.StaveProfile.Score:
		case alphaTab.StaveProfile.Tab:
		case alphaTab.StaveProfile.TabMixed:
			return value;
		default:
			return fallback;
	}
}

export function applyStaveProfileToScore(
	score: alphaTab.model.Score,
	profile: alphaTab.StaveProfile
): boolean {
	const visibility = getStaffVisibility(profile);
	if (!visibility) {
		return false;
	}

	let changed = false;

	for (const track of score.tracks) {
		for (const staff of track.staves) {
			if (staff.showStandardNotation !== visibility.showStandardNotation) {
				staff.showStandardNotation = visibility.showStandardNotation;
				changed = true;
			}

			if (staff.showTablature !== visibility.showTablature) {
				staff.showTablature = visibility.showTablature;
				changed = true;
			}
		}
	}

	return changed;
}
