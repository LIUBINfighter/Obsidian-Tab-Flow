export type CssProps = Record<string, string | null | undefined>;

/**
 * Sets CSS properties on an element in a controlled way.
 * Passing `null` or `undefined` removes the property.
 */
export function setCssProps(element: HTMLElement | SVGElement, props: CssProps): void {
	Object.entries(props).forEach(([property, value]) => {
		if (value === undefined || value === null || value === '') {
			if (element.instanceOf(HTMLElement) || element.instanceOf(SVGElement)) {
				element.style.removeProperty(property);
			}
		} else {
			if (element.instanceOf(HTMLElement) || element.instanceOf(SVGElement)) {
				element.style.setProperty(property, value);
			}
		}
	});
}

export function toggleHidden(element: HTMLElement, hidden: boolean): void {
	element.classList.toggle('is-hidden', hidden);
}
