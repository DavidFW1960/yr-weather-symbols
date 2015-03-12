var trait = require('simple-traits')
	, svg = require('svg');

module.exports = trait({
	/**
	 * Render svg version
	 * @param {SVGElement} element
	 */
	renderSVG: function (element) {
		svg.appendChild(
			element,
			'use',
			this.getUseAttributes('#lightning')
		);
	}
});