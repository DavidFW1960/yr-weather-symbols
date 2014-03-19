var svg = require('svg')
	, Trait = require('trait')
	, TPrimitive = require('./TPrimitive')

	, FILL_COLOUR = require('yr-colours').LIGHTNING

	, TLightningPrimitive;

TLightningPrimitive = Trait({
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
	},

	/**
	 * Render canvas version
	 * @param {CanvasContext} ctx
	 */
	renderCanvas: function (ctx) {
		// Fill
		ctx.save();
		this.transformCanvas(ctx);

		ctx.fillStyle = FILL_COLOUR;
		ctx.beginPath();
		ctx.moveTo(10.413,0);
		ctx.lineTo(4.163,12.484);
		ctx.lineTo(12.488,12.484);
		ctx.lineTo(0,25);
		ctx.lineTo(25.001,8.32);
		ctx.lineTo(16.663,8.32);
		ctx.lineTo(24.995,0);
		ctx.lineTo(10.413,0);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
});

module.exports = function () {
	return Trait.compose(
		TPrimitive.resolve({}),
		TLightningPrimitive
	).create();
};