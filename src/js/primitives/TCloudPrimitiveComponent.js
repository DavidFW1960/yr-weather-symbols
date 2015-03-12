var trait = require('simple-traits');

module.exports = trait({
	/**
	 * Render svg version
	 * @returns {String}
	 */
	renderSVG: function () {
		return this.getUseAttributesAsString('#cloud-' + this.tint * 100);
	}
});