// var casper = require('casperjs/modules/casper').create()
//   , destination = casper.cli.get(0)
//   , ids;

// if (!destination) {
//   casper.echo('Missing destination directory').exit();
// } else {
//   if (destination.charAt(destination.length - 1) !== '/') destination += '/';
// }

// casper.start('index.html', function () {
//   ids = this.evaluate(function () {
//     return Array.prototype.slice.call(__utils__.findAll('.symbol')).map(function (el) {
//       return el.getAttribute('id');
//     });
//   });
// });

// casper.run(function () {
//   ids.forEach(function (id) {
//     casper.echo('generating: ' + id + '.png @ 100x100');
//     casper.captureSelector(destination + id + '.png', '#' + id);
//   });

//   this.exit();
// });
'use strict';

const express = require('express')
  , fs = require('fs')
  , Nightmare = require('nightmare')
  , path = require('path')
  , serve = require('serve-static')
  , vo = require('vo')

  , app = express()
  , rootPath = process.cwd()
  , outputPath = path.resolve(rootPath, process.argv[2]);

if (!fs.existsSync(outputPath)) throw new Error(`output path doesn't exist: ${outputPath}`);

app.use(serve(rootPath));

app.listen(3000, () => {
  console.log('listening on 3000');

  vo(function* run () {
    const nightmare = Nightmare({ show: true });

    const rects = yield nightmare
      .goto('http://localhost:3000/')
      .wait('.symbol')
      .evaluate(function () {
        var rects = Array.prototype.slice.call(document.querySelectorAll('.symbol'))
          .map(function (el) {
            var rect = el.getBoundingClientRect();

            return {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            }
          });

        return rects;
      });

    yield nightmare
      .goto('http://localhost:3000/')
      .wait(2000)
      .screenshot(path.resolve(outputPath, 'temp.png'), rects[0]);

    yield nightmare.end();
  })((err) => {
    if (err) return console.log(err);
    process.exit();
  });
});

