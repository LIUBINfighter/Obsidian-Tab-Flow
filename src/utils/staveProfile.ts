import * as alphaTab from '@coderline/alphatab';

interface StaffVisibility {
	standard: boolean;
	tablature: boolean;
}

/**
 * The notation visibility each staff had before a stave profile was applied
 * (i.e. the plugin's default display), captured on first touch so the
 * Default profile can restore it.
 */
const defaultVisibility = new WeakMap<alphaTab.model.Staff, StaffVisibility>();

/**
 * Apply a stave profile by adjusting the notation visibility of every staff.
 *
 * `settings.display.staveProfile` is deprecated in alphaTab; the supported way
 * is to set the visibility on the staves themselves.
 */
export function applyStaveProfile(
	api: alphaTab.AlphaTabApi,
	profile: alphaTab.StaveProfile,
	render = true
): void {
	const score = api.score;
	if (score) {
		for (const track of score.tracks) {
			for (const staff of track.staves) {
				applyStaveProfileToStaff(staff, profile);
			}
		}
	}
	if (render) {
		api.render();
	}
}

function applyStaveProfileToStaff(
	staff: alphaTab.model.Staff,
	profile: alphaTab.StaveProfile
): void {
	let defaultState = defaultVisibility.get(staff);
	if (!defaultState) {
		defaultState = {
			standard: staff.showStandardNotation,
			tablature: staff.showTablature,
		};
		defaultVisibility.set(staff, defaultState);
	}

	switch (profile) {
		case alphaTab.StaveProfile.Score:
			staff.showStandardNotation = true;
			staff.showTablature = false;
			staff.showSlash = false;
			staff.showNumbered = false;
			break;
		case alphaTab.StaveProfile.Tab:
		case alphaTab.StaveProfile.TabMixed:
			staff.showStandardNotation = false;
			staff.showTablature = true;
			staff.showSlash = false;
			staff.showNumbered = false;
			break;
		case alphaTab.StaveProfile.ScoreTab:
			staff.showStandardNotation = true;
			staff.showTablature = staff.isStringed;
			break;
		default:
			// Default: back to the visibility the plugin had applied.
			staff.showStandardNotation = defaultState.standard;
			staff.showTablature = defaultState.tablature;
			break;
	}
}
