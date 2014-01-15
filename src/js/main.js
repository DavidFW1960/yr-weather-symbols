var dust = require('dust')
	, data = require('../symbols.json')
	, template = require('./symbolGroup')
	, WeatherSymbol = require('./WeatherSymbol')
	, symbol = new WeatherSymbol(1)
	, el = document.getElementById('symbols');

// Render template
dust.render('symbolGroup', data, function(err, html) {
	if (err) {
		console.log(err);
	} else {
		el.innerHTML = html;
	}
});


// Draw canvas symbols
Array.prototype.slice.call(document.querySelectorAll('.symbol'))
	.forEach(symbol.draw, symbol);