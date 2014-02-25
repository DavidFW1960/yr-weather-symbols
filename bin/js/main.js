(function(root) {
	// Load or return cached version of requested module with id 'path' or 'path/index'
	// @param {String} path
	// @return {Object}
	function require (path) {
		// Convert relative path to absolute for cases where 'require' has not been resolved
		// called from outside of a module, for example
		if (!this.module && path.charAt(0) == '.') {
			path = path.slice((path.indexOf('..') === 0) ? 3 : 2);
		}
		// Check with/without root package (need to handle node_modules differently)
		var paths = [path, path.slice(path.indexOf('/') + 1)]
			, m;
		// Find in cache
		for (var i = 0, n = paths.length; i < n; i++) {
			path = paths[i];
			m = require.modules[path] || require.modules[path + '/index'];
			if (m) break;
		}
		if (!m) {
			throw "Couldn't find module for: " + path;
		}
		// Instantiate the module if it's export object is not yet defined
		if (!m.exports) {
			// Convert 'lazy' evaluated string to Function
			if ('string' == typeof m) {
				m = require.modules[path] = new Function('module', 'exports', 'require', m);
			}
			m.exports = {};
			m.filename = path;
			m.call(this, m, m.exports, require.relative(path));
		}
		// Return the exports object
		return m.exports;
	}

	// Cache of module objects
	require.modules = {};

	// Resolve 'to' an absolute path
	// @param {String} curr
	// @param {String} path
	// @return {String}
	require.resolve = function(from, to) {
		var fromSegs = from.split('/')
			, seg;

		// Non relative path
		if (to.charAt(0) != '.') return to;

		// Don't strip root paths (handled specially in require())
		if (fromSegs.length > 1) fromSegs.pop();
		to = to.split('/');
		// Use 'from' path segments to resolve relative 'to' path
		for (var i = 0; i < to.length; ++i) {
			seg = to[i];
			if (seg == '..') {
				fromSegs.pop();
			} else if (seg != '.') {
				fromSegs.push(seg);
			}
		}
		return fromSegs.join('/');
	};

	// Partial completion of the module's inner 'require' function
	// @param {String} path
	// @return {Object}
	require.relative = function(path) {
		return function(p) {
			return require(require.resolve(path, p));
		};
	};

	// Register a module with id of 'path' and callback of 'fn'
	// @param {String} path
	// @param {Function} fn [signature should be of type (module, exports, require)]
	require.register = function(path, fn) {
		require.modules[path] = fn;
	};

	// Expose
	root.require = require;
})(window != null ? window : global);

require.register('dust', function(module, exports, require) {
  /*! Dust - Asynchronous Templating - v2.3.3
  * http://linkedin.github.io/dustjs/
  * Copyright (c) 2014 Aleksander Williams; Released under the MIT License */
  (function(root) {
    var dust = {},
        NONE = 'NONE',
        ERROR = 'ERROR',
        WARN = 'WARN',
        INFO = 'INFO',
        DEBUG = 'DEBUG',
        loggingLevels = [DEBUG, INFO, WARN, ERROR, NONE],
        EMPTY_FUNC = function() {},
        logger = EMPTY_FUNC,
        loggerContext = this;
  
    dust.debugLevel = NONE;
    dust.silenceErrors = false;
  
    // Try to find the console logger in global scope
    if (root && root.console && root.console.log) {
      logger = root.console.log;
      loggerContext = root.console;
    }
  
    /**
     * If dust.isDebug is true, Log dust debug statements, info statements, warning statements, and errors.
     * This default implementation will print to the console if it exists.
     * @param {String|Error} message the message to print/throw
     * @param {String} type the severity of the message(ERROR, WARN, INFO, or DEBUG)
     * @public
     */
    dust.log = function(message, type) {
      if(dust.isDebug && dust.debugLevel === NONE) {
        logger.call(loggerContext, '[!!!DEPRECATION WARNING!!!]: dust.isDebug is deprecated.  Set dust.debugLevel instead to the level of logging you want ["debug","info","warn","error","none"]');
        dust.debugLevel = INFO;
      }
  
      type = type || INFO;
      if (loggingLevels.indexOf(type) >= loggingLevels.indexOf(dust.debugLevel)) {
        if(!dust.logQueue) {
          dust.logQueue = [];
        }
        dust.logQueue.push({message: message, type: type});
        logger.call(loggerContext, '[DUST ' + type + ']: ' + message);
      }
  
      if (!dust.silenceErrors && type === ERROR) {
        if (typeof message === 'string') {
          throw new Error(message);
        } else {
          throw message;
        }
      }
    };
  
    /**
     * If debugging is turned on(dust.isDebug=true) log the error message and throw it.
     * Otherwise try to keep rendering.  This is useful to fail hard in dev mode, but keep rendering in production.
     * @param {Error} error the error message to throw
     * @param {Object} chunk the chunk the error was thrown from
     * @public
     */
    dust.onError = function(error, chunk) {
      logger.call(loggerContext, '[!!!DEPRECATION WARNING!!!]: dust.onError will no longer return a chunk object.');
      dust.log(error.message || error, ERROR);
      if(!dust.silenceErrors) {
        throw error;
      } else {
        return chunk;
      }
    };
  
    dust.helpers = {};
  
    dust.cache = {};
  
    dust.register = function(name, tmpl) {
      if (!name) {
        return;
      }
      dust.cache[name] = tmpl;
    };
  
    dust.render = function(name, context, callback) {
      var chunk = new Stub(callback).head;
      try {
        dust.load(name, chunk, Context.wrap(context, name)).end();
      } catch (err) {
        dust.log(err, ERROR);
      }
    };
  
    dust.stream = function(name, context) {
      var stream = new Stream();
      dust.nextTick(function() {
        try {
          dust.load(name, stream.head, Context.wrap(context, name)).end();
        } catch (err) {
          dust.log(err, ERROR);
        }
      });
      return stream;
    };
  
    dust.renderSource = function(source, context, callback) {
      return dust.compileFn(source)(context, callback);
    };
  
    dust.compileFn = function(source, name) {
      // name is optional. When name is not provided the template can only be rendered using the callable returned by this function.
      // If a name is provided the compiled template can also be rendered by name.
      name = name || null;
      var tmpl = dust.loadSource(dust.compile(source, name));
      return function(context, callback) {
        var master = callback ? new Stub(callback) : new Stream();
        dust.nextTick(function() {
          if(typeof tmpl === 'function') {
            tmpl(master.head, Context.wrap(context, name)).end();
          }
          else {
            dust.log(new Error('Template [' + name + '] cannot be resolved to a Dust function'), ERROR);
          }
        });
        return master;
      };
    };
  
    dust.load = function(name, chunk, context) {
      var tmpl = dust.cache[name];
      if (tmpl) {
        return tmpl(chunk, context);
      } else {
        if (dust.onLoad) {
          return chunk.map(function(chunk) {
            dust.onLoad(name, function(err, src) {
              if (err) {
                return chunk.setError(err);
              }
              if (!dust.cache[name]) {
                dust.loadSource(dust.compile(src, name));
              }
              dust.cache[name](chunk, context).end();
            });
          });
        }
        return chunk.setError(new Error('Template Not Found: ' + name));
      }
    };
  
    dust.loadSource = function(source, path) {
      return eval(source);
    };
  
    if (Array.isArray) {
      dust.isArray = Array.isArray;
    } else {
      dust.isArray = function(arr) {
        return Object.prototype.toString.call(arr) === '[object Array]';
      };
    }
  
    dust.nextTick = (function() {
      return function(callback) {
        setTimeout(callback,0);
      };
    } )();
  
    dust.isEmpty = function(value) {
      if (dust.isArray(value) && !value.length) {
        return true;
      }
      if (value === 0) {
        return false;
      }
      return (!value);
    };
  
    // apply the filter chain and return the output string
    dust.filter = function(string, auto, filters) {
      if (filters) {
        for (var i=0, len=filters.length; i<len; i++) {
          var name = filters[i];
          if (name === 's') {
            auto = null;
            dust.log('Using unescape filter on [' + string + ']', DEBUG);
          }
          else if (typeof dust.filters[name] === 'function') {
            string = dust.filters[name](string);
          }
          else {
            dust.log('Invalid filter [' + name + ']', WARN);
          }
        }
      }
      // by default always apply the h filter, unless asked to unescape with |s
      if (auto) {
        string = dust.filters[auto](string);
      }
      return string;
    };
  
    dust.filters = {
      h: function(value) { return dust.escapeHtml(value); },
      j: function(value) { return dust.escapeJs(value); },
      u: encodeURI,
      uc: encodeURIComponent,
      js: function(value) {
        if (!JSON) {
          dust.log('JSON is undefined.  JSON stringify has not been used on [' + value + ']', WARN);
          return value;
        } else {
          return JSON.stringify(value);
        }
      },
      jp: function(value) {
        if (!JSON) {dust.log('JSON is undefined.  JSON parse has not been used on [' + value + ']', WARN);
          return value;
        } else {
          return JSON.parse(value);
        }
      }
    };
  
    function Context(stack, global, blocks, templateName) {
      this.stack  = stack;
      this.global = global;
      this.blocks = blocks;
      this.templateName = templateName;
    }
  
    dust.makeBase = function(global) {
      return new Context(new Stack(), global);
    };
  
    Context.wrap = function(context, name) {
      if (context instanceof Context) {
        return context;
      }
      return new Context(new Stack(context), {}, null, name);
    };
  
    /**
     * Public API for getting a value from the context.
     * @method get
     * @param {string|array} path The path to the value. Supported formats are:
     * 'key'
     * 'path.to.key'
     * '.path.to.key'
     * ['path', 'to', 'key']
     * ['key']
     * @param {boolean} [cur=false] Boolean which determines if the search should be limited to the
     * current context (true), or if get should search in parent contexts as well (false).
     * @public
     * @returns {string|object}
     */
    Context.prototype.get = function(path, cur) {
      if (typeof path === 'string') {
        if (path[0] === '.') {
          cur = true;
          path = path.substr(1);
        }
        path = path.split('.');
      }
      return this._get(cur, path);
    };
  
    /**
     * Get a value from the context
     * @method _get
     * @param {boolean} cur Get only from the current context
     * @param {array} down An array of each step in the path
     * @private
     * @return {string | object}
     */
    Context.prototype._get = function(cur, down) {
      var ctx = this.stack,
          i = 1,
          value, first, len, ctxThis;
      dust.log('Searching for reference [{' + down.join('.') + '}] in template [' + this.getTemplateName() + ']', DEBUG);
      first = down[0];
      len = down.length;
  
      if (cur && len === 0) {
        ctxThis = ctx;
        ctx = ctx.head;
      } else {
        if (!cur) {
          // Search up the stack for the first value
          while (ctx) {
            if (ctx.isObject) {
              ctxThis = ctx.head;
              value = ctx.head[first];
              if (value !== undefined) {
                break;
              }
            }
            ctx = ctx.tail;
          }
  
          if (value !== undefined) {
            ctx = value;
          } else {
            ctx = this.global ? this.global[first] : undefined;
          }
        } else {
          // if scope is limited by a leading dot, don't search up the tree
          ctx = ctx.head[first];
        }
  
        while (ctx && i < len) {
          ctxThis = ctx;
          ctx = ctx[down[i]];
          i++;
        }
      }
  
      // Return the ctx or a function wrapping the application of the context.
      if (typeof ctx === 'function') {
        var fn = function() {
          try {
            return ctx.apply(ctxThis, arguments);
          } catch (err) {
            return dust.log(err, ERROR);
          }
        };
        fn.isFunction = true;
        return fn;
      } else {
        if (ctx === undefined) {
          dust.log('Cannot find the value for reference [{' + down.join('.') + '}] in template [' + this.getTemplateName() + ']');
        }
        return ctx;
      }
    };
  
    Context.prototype.getPath = function(cur, down) {
      return this._get(cur, down);
    };
  
    Context.prototype.push = function(head, idx, len) {
      return new Context(new Stack(head, this.stack, idx, len), this.global, this.blocks, this.getTemplateName());
    };
  
    Context.prototype.rebase = function(head) {
      return new Context(new Stack(head), this.global, this.blocks, this.getTemplateName());
    };
  
    Context.prototype.current = function() {
      return this.stack.head;
    };
  
    Context.prototype.getBlock = function(key, chk, ctx) {
      if (typeof key === 'function') {
        var tempChk = new Chunk();
        key = key(tempChk, this).data.join('');
      }
  
      var blocks = this.blocks;
  
      if (!blocks) {
        dust.log('No blocks for context[{' + key + '}] in template [' + this.getTemplateName() + ']', DEBUG);
        return;
      }
      var len = blocks.length, fn;
      while (len--) {
        fn = blocks[len][key];
        if (fn) {
          return fn;
        }
      }
    };
  
    Context.prototype.shiftBlocks = function(locals) {
      var blocks = this.blocks,
          newBlocks;
  
      if (locals) {
        if (!blocks) {
          newBlocks = [locals];
        } else {
          newBlocks = blocks.concat([locals]);
        }
        return new Context(this.stack, this.global, newBlocks, this.getTemplateName());
      }
      return this;
    };
  
    Context.prototype.getTemplateName = function() {
      return this.templateName;
    };
  
    function Stack(head, tail, idx, len) {
      this.tail = tail;
      this.isObject = head && typeof head === 'object';
      this.head = head;
      this.index = idx;
      this.of = len;
    }
  
    function Stub(callback) {
      this.head = new Chunk(this);
      this.callback = callback;
      this.out = '';
    }
  
    Stub.prototype.flush = function() {
      var chunk = this.head;
  
      while (chunk) {
        if (chunk.flushable) {
          this.out += chunk.data.join(''); //ie7 perf
        } else if (chunk.error) {
          this.callback(chunk.error);
          dust.log('Chunk error [' + chunk.error + '] thrown. Ceasing to render this template.', WARN);
          this.flush = EMPTY_FUNC;
          return;
        } else {
          return;
        }
        chunk = chunk.next;
        this.head = chunk;
      }
      this.callback(null, this.out);
    };
  
    function Stream() {
      this.head = new Chunk(this);
    }
  
    Stream.prototype.flush = function() {
      var chunk = this.head;
  
      while(chunk) {
        if (chunk.flushable) {
          this.emit('data', chunk.data.join('')); //ie7 perf
        } else if (chunk.error) {
          this.emit('error', chunk.error);
          dust.log('Chunk error [' + chunk.error + '] thrown. Ceasing to render this template.', WARN);
          this.flush = EMPTY_FUNC;
          return;
        } else {
          return;
        }
        chunk = chunk.next;
        this.head = chunk;
      }
      this.emit('end');
    };
  
    Stream.prototype.emit = function(type, data) {
      if (!this.events) {
        dust.log('No events to emit', INFO);
        return false;
      }
      var handler = this.events[type];
      if (!handler) {
        dust.log('Event type [' + type + '] does not exist', WARN);
        return false;
      }
      if (typeof handler === 'function') {
        handler(data);
      } else if (dust.isArray(handler)) {
        var listeners = handler.slice(0);
        for (var i = 0, l = listeners.length; i < l; i++) {
          listeners[i](data);
        }
      } else {
        dust.log('Event Handler [' + handler + '] is not of a type that is handled by emit', WARN);
      }
    };
  
    Stream.prototype.on = function(type, callback) {
      if (!this.events) {
        this.events = {};
      }
      if (!this.events[type]) {
        dust.log('Event type [' + type + '] does not exist. Using just the specified callback.', WARN);
        if(callback) {
          this.events[type] = callback;
        } else {
          dust.log('Callback for type [' + type + '] does not exist. Listener not registered.', WARN);
        }
      } else if(typeof this.events[type] === 'function') {
        this.events[type] = [this.events[type], callback];
      } else {
        this.events[type].push(callback);
      }
      return this;
    };
  
    Stream.prototype.pipe = function(stream) {
      this.on('data', function(data) {
        try {
          stream.write(data, 'utf8');
        } catch (err) {
          dust.log(err, ERROR);
        }
      }).on('end', function() {
        try {
          return stream.end();
        } catch (err) {
          dust.log(err, ERROR);
        }
      }).on('error', function(err) {
        stream.error(err);
      });
      return this;
    };
  
    function Chunk(root, next, taps) {
      this.root = root;
      this.next = next;
      this.data = []; //ie7 perf
      this.flushable = false;
      this.taps = taps;
    }
  
    Chunk.prototype.write = function(data) {
      var taps  = this.taps;
  
      if (taps) {
        data = taps.go(data);
      }
      this.data.push(data);
      return this;
    };
  
    Chunk.prototype.end = function(data) {
      if (data) {
        this.write(data);
      }
      this.flushable = true;
      this.root.flush();
      return this;
    };
  
    Chunk.prototype.map = function(callback) {
      var cursor = new Chunk(this.root, this.next, this.taps),
          branch = new Chunk(this.root, cursor, this.taps);
  
      this.next = branch;
      this.flushable = true;
      callback(branch);
      return cursor;
    };
  
    Chunk.prototype.tap = function(tap) {
      var taps = this.taps;
  
      if (taps) {
        this.taps = taps.push(tap);
      } else {
        this.taps = new Tap(tap);
      }
      return this;
    };
  
    Chunk.prototype.untap = function() {
      this.taps = this.taps.tail;
      return this;
    };
  
    Chunk.prototype.render = function(body, context) {
      return body(this, context);
    };
  
    Chunk.prototype.reference = function(elem, context, auto, filters) {
      if (typeof elem === 'function') {
        elem.isFunction = true;
        // Changed the function calling to use apply with the current context to make sure
        // that "this" is wat we expect it to be inside the function
        elem = elem.apply(context.current(), [this, context, null, {auto: auto, filters: filters}]);
        if (elem instanceof Chunk) {
          return elem;
        }
      }
      if (!dust.isEmpty(elem)) {
        return this.write(dust.filter(elem, auto, filters));
      } else {
        return this;
      }
    };
  
    Chunk.prototype.section = function(elem, context, bodies, params) {
      // anonymous functions
      if (typeof elem === 'function') {
        elem = elem.apply(context.current(), [this, context, bodies, params]);
        // functions that return chunks are assumed to have handled the body and/or have modified the chunk
        // use that return value as the current chunk and go to the next method in the chain
        if (elem instanceof Chunk) {
          return elem;
        }
      }
      var body = bodies.block,
          skip = bodies['else'];
  
      // a.k.a Inline parameters in the Dust documentations
      if (params) {
        context = context.push(params);
      }
  
      /*
      Dust's default behavior is to enumerate over the array elem, passing each object in the array to the block.
      When elem resolves to a value or object instead of an array, Dust sets the current context to the value
      and renders the block one time.
      */
      //non empty array is truthy, empty array is falsy
      if (dust.isArray(elem)) {
        if (body) {
          var len = elem.length, chunk = this;
          if (len > 0) {
            // any custom helper can blow up the stack
            // and store a flattened context, guard defensively
            if(context.stack.head) {
              context.stack.head['$len'] = len;
            }
            for (var i=0; i<len; i++) {
              if(context.stack.head) {
                context.stack.head['$idx'] = i;
              }
              chunk = body(chunk, context.push(elem[i], i, len));
            }
            if(context.stack.head) {
              context.stack.head['$idx'] = undefined;
              context.stack.head['$len'] = undefined;
            }
            return chunk;
          }
          else if (skip) {
            return skip(this, context);
          }
        }
      } else if (elem  === true) {
       // true is truthy but does not change context
        if (body) {
          return body(this, context);
        }
      } else if (elem || elem === 0) {
         // everything that evaluates to true are truthy ( e.g. Non-empty strings and Empty objects are truthy. )
         // zero is truthy
         // for anonymous functions that did not returns a chunk, truthiness is evaluated based on the return value
        if (body) {
          return body(this, context.push(elem));
        }
       // nonexistent, scalar false value, scalar empty string, null,
       // undefined are all falsy
      } else if (skip) {
        return skip(this, context);
      }
      dust.log('Not rendering section (#) block in template [' + context.getTemplateName() + '], because above key was not found', DEBUG);
      return this;
    };
  
    Chunk.prototype.exists = function(elem, context, bodies) {
      var body = bodies.block,
          skip = bodies['else'];
  
      if (!dust.isEmpty(elem)) {
        if (body) {
          return body(this, context);
        }
      } else if (skip) {
        return skip(this, context);
      }
      dust.log('Not rendering exists (?) block in template [' + context.getTemplateName() + '], because above key was not found', DEBUG);
      return this;
    };
  
    Chunk.prototype.notexists = function(elem, context, bodies) {
      var body = bodies.block,
          skip = bodies['else'];
  
      if (dust.isEmpty(elem)) {
        if (body) {
          return body(this, context);
        }
      } else if (skip) {
        return skip(this, context);
      }
      dust.log('Not rendering not exists (^) block check in template [' + context.getTemplateName() + '], because above key was found', DEBUG);
      return this;
    };
  
    Chunk.prototype.block = function(elem, context, bodies) {
      var body = bodies.block;
  
      if (elem) {
        body = elem;
      }
  
      if (body) {
        return body(this, context);
      }
      return this;
    };
  
    Chunk.prototype.partial = function(elem, context, params) {
      var partialContext;
      //put the params context second to match what section does. {.} matches the current context without parameters
      // start with an empty context
      partialContext = dust.makeBase(context.global);
      partialContext.blocks = context.blocks;
      if (context.stack && context.stack.tail){
        // grab the stack(tail) off of the previous context if we have it
        partialContext.stack = context.stack.tail;
      }
      if (params){
        //put params on
        partialContext = partialContext.push(params);
      }
  
      if(typeof elem === 'string') {
        partialContext.templateName = elem;
      }
  
      //reattach the head
      partialContext = partialContext.push(context.stack.head);
  
      var partialChunk;
      if (typeof elem === 'function') {
        partialChunk = this.capture(elem, partialContext, function(name, chunk) {
          partialContext.templateName = partialContext.templateName || name;
          dust.load(name, chunk, partialContext).end();
        });
      } else {
        partialChunk = dust.load(elem, this, partialContext);
      }
      return partialChunk;
    };
  
    Chunk.prototype.helper = function(name, context, bodies, params) {
      var chunk = this;
      // handle invalid helpers, similar to invalid filters
      try {
        if(dust.helpers[name]) {
          return dust.helpers[name](chunk, context, bodies, params);
        } else {
          dust.log('Invalid helper [' + name + ']', WARN);
          return chunk;
        }
      } catch (err) {
        dust.log(err, ERROR);
        return chunk;
      }
    };
  
    Chunk.prototype.capture = function(body, context, callback) {
      return this.map(function(chunk) {
        var stub = new Stub(function(err, out) {
          if (err) {
            chunk.setError(err);
          } else {
            callback(out, chunk);
          }
        });
        body(stub.head, context).end();
      });
    };
  
    Chunk.prototype.setError = function(err) {
      this.error = err;
      this.root.flush();
      return this;
    };
  
    function Tap(head, tail) {
      this.head = head;
      this.tail = tail;
    }
  
    Tap.prototype.push = function(tap) {
      return new Tap(tap, this);
    };
  
    Tap.prototype.go = function(value) {
      var tap = this;
  
      while(tap) {
        value = tap.head(value);
        tap = tap.tail;
      }
      return value;
    };
  
    var HCHARS = new RegExp(/[&<>\"\']/),
        AMP    = /&/g,
        LT     = /</g,
        GT     = />/g,
        QUOT   = /\"/g,
        SQUOT  = /\'/g;
  
    dust.escapeHtml = function(s) {
      if (typeof s === 'string') {
        if (!HCHARS.test(s)) {
          return s;
        }
        return s.replace(AMP,'&amp;').replace(LT,'&lt;').replace(GT,'&gt;').replace(QUOT,'&quot;').replace(SQUOT, '&#39;');
      }
      return s;
    };
  
    var BS = /\\/g,
        FS = /\//g,
        CR = /\r/g,
        LS = /\u2028/g,
        PS = /\u2029/g,
        NL = /\n/g,
        LF = /\f/g,
        SQ = /'/g,
        DQ = /"/g,
        TB = /\t/g;
  
    dust.escapeJs = function(s) {
      if (typeof s === 'string') {
        return s
          .replace(BS, '\\\\')
          .replace(FS, '\\/')
          .replace(DQ, '\\"')
          .replace(SQ, '\\\'')
          .replace(CR, '\\r')
          .replace(LS, '\\u2028')
          .replace(PS, '\\u2029')
          .replace(NL, '\\n')
          .replace(LF, '\\f')
          .replace(TB, '\\t');
      }
      return s;
    };
  
  
    if (typeof exports === 'object') {
      module.exports = dust;
    } else {
      root.dust = dust;
    }
  
  })(this);
  
  
});
require.register('symbolGroup', function(module, exports, require) {
  var dust = window.dust || require('dust');
  module.exports = (function(){dust.register("symbolGroup",body_0);function body_0(chk,ctx){return chk.section(ctx._get(false, ["symbols"]),ctx,{"block":body_1},null);}function body_1(chk,ctx){return chk.write("<h2>").reference(ctx._get(false, ["title"]),ctx,"h").write("</h2>").section(ctx._get(false, ["variations"]),ctx,{"block":body_2},null);}function body_2(chk,ctx){return chk.write("<section class=\"symbol-group\"><h3>#").reference(ctx._get(false, ["id"]),ctx,"h").write("</h3><figure class=\"s128 svg\"><div class=\"symbol\" data-id=\"").reference(ctx._get(false, ["id"]),ctx,"h").write("\"></div><figcaption>svg@128px</figcaption></figure><figure class=\"s128 canvas\"><div class=\"symbol\" data-id=\"").reference(ctx._get(false, ["id"]),ctx,"h").write("\"></div><figcaption>canvas@128px</figcaption></figure><figure class=\"s128 img\"><div class=\"symbol\" data-id=\"").reference(ctx._get(false, ["id"]),ctx,"h").write("\"></div><figcaption>img@128px</figcaption></figure></section>");}return body_0;})();
});
require.register('svg', function(module, exports, require) {
  exports.NS = 'http://www.w3.org/2000/svg';
  exports.LINK = 'http://www.w3.org/1999/xlink';
  
  exports.appendChild = function (parent, type, attrs) {
  	var el = document.createElementNS(exports.NS, type);
  
  	if (attrs) {
  		for (var attr in attrs) {
  			if (attr.indexOf('xlink:') == 0) {
  				el.setAttributeNS(exports.LINK, attr.substring(6), attrs[attr]);
  			} else {
  				el.setAttribute(attr, attrs[attr]);
  			}
  		}
  	}
  
  	parent.appendChild(el);
  };
});
require.register('lodash._objecttypes', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  
  /** Used to determine if values are of the language type Object */
  var objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
  };
  
  module.exports = objectTypes;
  
});
require.register('lodash.isobject', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var objectTypes = require('lodash._objecttypes');
  
  /**
   * Checks if `value` is the language type of Object.
   * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is an object, else `false`.
   * @example
   *
   * _.isObject({});
   * // => true
   *
   * _.isObject([1, 2, 3]);
   * // => true
   *
   * _.isObject(1);
   * // => false
   */
  function isObject(value) {
    // check if the value is the ECMAScript language type of Object
    // http://es5.github.io/#x8
    // and avoid a V8 bug
    // http://code.google.com/p/v8/issues/detail?id=2291
    return !!(value && objectTypes[typeof value]);
  }
  
  module.exports = isObject;
  
});
require.register('lodash.isnumber', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  
  /** `Object#toString` result shortcuts */
  var numberClass = '[object Number]';
  
  /** Used for native method references */
  var objectProto = Object.prototype;
  
  /** Used to resolve the internal [[Class]] of values */
  var toString = objectProto.toString;
  
  /**
   * Checks if `value` is a number.
   *
   * Note: `NaN` is considered a number. See http://es5.github.io/#x8.5.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is a number, else `false`.
   * @example
   *
   * _.isNumber(8.4 * 5);
   * // => true
   */
  function isNumber(value) {
    return typeof value == 'number' ||
      value && typeof value == 'object' && toString.call(value) == numberClass || false;
  }
  
  module.exports = isNumber;
  
});
require.register('lodash.isnan', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var isNumber = require('lodash.isnumber');
  
  /**
   * Checks if `value` is `NaN`.
   *
   * Note: This is not the same as native `isNaN` which will return `true` for
   * `undefined` and other non-numeric values. See http://es5.github.io/#x15.1.2.4.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is `NaN`, else `false`.
   * @example
   *
   * _.isNaN(NaN);
   * // => true
   *
   * _.isNaN(new Number(NaN));
   * // => true
   *
   * isNaN(undefined);
   * // => true
   *
   * _.isNaN(undefined);
   * // => false
   */
  function isNaN(value) {
    // `NaN` as a primitive is the only value that is not equal to itself
    // (perform the [[Class]] check first to avoid errors with some host objects in IE)
    return isNumber(value) && value != +value;
  }
  
  module.exports = isNaN;
  
});
require.register('lodash._isnative', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  
  /** Used for native method references */
  var objectProto = Object.prototype;
  
  /** Used to resolve the internal [[Class]] of values */
  var toString = objectProto.toString;
  
  /** Used to detect if a method is native */
  var reNative = RegExp('^' +
    String(toString)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/toString| for [^\]]+/g, '.*?') + '$'
  );
  
  /**
   * Checks if `value` is a native function.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is a native function, else `false`.
   */
  function isNative(value) {
    return typeof value == 'function' && reNative.test(value);
  }
  
  module.exports = isNative;
  
});
require.register('lodash.isarray', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var isNative = require('lodash._isnative');
  
  /** `Object#toString` result shortcuts */
  var arrayClass = '[object Array]';
  
  /** Used for native method references */
  var objectProto = Object.prototype;
  
  /** Used to resolve the internal [[Class]] of values */
  var toString = objectProto.toString;
  
  /* Native method shortcuts for methods with the same name as other `lodash` methods */
  var nativeIsArray = isNative(nativeIsArray = Array.isArray) && nativeIsArray;
  
  /**
   * Checks if `value` is an array.
   *
   * @static
   * @memberOf _
   * @type Function
   * @category Objects
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is an array, else `false`.
   * @example
   *
   * (function() { return _.isArray(arguments); })();
   * // => false
   *
   * _.isArray([1, 2, 3]);
   * // => true
   */
  var isArray = nativeIsArray || function(value) {
    return value && typeof value == 'object' && typeof value.length == 'number' &&
      toString.call(value) == arrayClass || false;
  };
  
  module.exports = isArray;
  
});
require.register('lodash.isstring', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  
  /** `Object#toString` result shortcuts */
  var stringClass = '[object String]';
  
  /** Used for native method references */
  var objectProto = Object.prototype;
  
  /** Used to resolve the internal [[Class]] of values */
  var toString = objectProto.toString;
  
  /**
   * Checks if `value` is a string.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is a string, else `false`.
   * @example
   *
   * _.isString('fred');
   * // => true
   */
  function isString(value) {
    return typeof value == 'string' ||
      value && typeof value == 'object' && toString.call(value) == stringClass || false;
  }
  
  module.exports = isString;
  
});
require.register('lodash.noop', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  
  /**
   * A no-operation function.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @example
   *
   * var object = { 'name': 'fred' };
   * _.noop(object) === undefined;
   * // => true
   */
  function noop() {
    // no operation performed
  }
  
  module.exports = noop;
  
});
require.register('lodash._basecreate', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var isNative = require('lodash._isnative'),
      isObject = require('lodash.isobject'),
      noop = require('lodash.noop');
  
  /* Native method shortcuts for methods with the same name as other `lodash` methods */
  var nativeCreate = isNative(nativeCreate = Object.create) && nativeCreate;
  
  /**
   * The base implementation of `_.create` without support for assigning
   * properties to the created object.
   *
   * @private
   * @param {Object} prototype The object to inherit from.
   * @returns {Object} Returns the new object.
   */
  function baseCreate(prototype, properties) {
    return isObject(prototype) ? nativeCreate(prototype) : {};
  }
  // fallback for browsers without `Object.create`
  if (!nativeCreate) {
    baseCreate = (function() {
      function Object() {}
      return function(prototype) {
        if (isObject(prototype)) {
          Object.prototype = prototype;
          var result = new Object;
          Object.prototype = null;
        }
        return result || global.Object();
      };
    }());
  }
  
  module.exports = baseCreate;
  
});
require.register('lodash._setbinddata', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var isNative = require('lodash._isnative'),
      noop = require('lodash.noop');
  
  /** Used as the property descriptor for `__bindData__` */
  var descriptor = {
    'configurable': false,
    'enumerable': false,
    'value': null,
    'writable': false
  };
  
  /** Used to set meta data on functions */
  var defineProperty = (function() {
    // IE 8 only accepts DOM elements
    try {
      var o = {},
          func = isNative(func = Object.defineProperty) && func,
          result = func(o, o, o) && func;
    } catch(e) { }
    return result;
  }());
  
  /**
   * Sets `this` binding data on a given function.
   *
   * @private
   * @param {Function} func The function to set data on.
   * @param {Array} value The data array to set.
   */
  var setBindData = !defineProperty ? noop : function(func, value) {
    descriptor.value = value;
    defineProperty(func, '__bindData__', descriptor);
  };
  
  module.exports = setBindData;
  
});
require.register('lodash._slice', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  
  /**
   * Slices the `collection` from the `start` index up to, but not including,
   * the `end` index.
   *
   * Note: This function is used instead of `Array#slice` to support node lists
   * in IE < 9 and to ensure dense arrays are returned.
   *
   * @private
   * @param {Array|Object|string} collection The collection to slice.
   * @param {number} start The start index.
   * @param {number} end The end index.
   * @returns {Array} Returns the new array.
   */
  function slice(array, start, end) {
    start || (start = 0);
    if (typeof end == 'undefined') {
      end = array ? array.length : 0;
    }
    var index = -1,
        length = end - start || 0,
        result = Array(length < 0 ? 0 : length);
  
    while (++index < length) {
      result[index] = array[start + index];
    }
    return result;
  }
  
  module.exports = slice;
  
});
require.register('lodash._basebind', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var baseCreate = require('lodash._basecreate'),
      isObject = require('lodash.isobject'),
      setBindData = require('lodash._setbinddata'),
      slice = require('lodash._slice');
  
  /**
   * Used for `Array` method references.
   *
   * Normally `Array.prototype` would suffice, however, using an array literal
   * avoids issues in Narwhal.
   */
  var arrayRef = [];
  
  /** Native method shortcuts */
  var push = arrayRef.push;
  
  /**
   * The base implementation of `_.bind` that creates the bound function and
   * sets its meta data.
   *
   * @private
   * @param {Array} bindData The bind data array.
   * @returns {Function} Returns the new bound function.
   */
  function baseBind(bindData) {
    var func = bindData[0],
        partialArgs = bindData[2],
        thisArg = bindData[4];
  
    function bound() {
      // `Function#bind` spec
      // http://es5.github.io/#x15.3.4.5
      if (partialArgs) {
        // avoid `arguments` object deoptimizations by using `slice` instead
        // of `Array.prototype.slice.call` and not assigning `arguments` to a
        // variable as a ternary expression
        var args = slice(partialArgs);
        push.apply(args, arguments);
      }
      // mimic the constructor's `return` behavior
      // http://es5.github.io/#x13.2.2
      if (this instanceof bound) {
        // ensure `new bound` is an instance of `func`
        var thisBinding = baseCreate(func.prototype),
            result = func.apply(thisBinding, args || arguments);
        return isObject(result) ? result : thisBinding;
      }
      return func.apply(thisArg, args || arguments);
    }
    setBindData(bound, bindData);
    return bound;
  }
  
  module.exports = baseBind;
  
});
require.register('lodash._basecreatewrapper', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var baseCreate = require('lodash._basecreate'),
      isObject = require('lodash.isobject'),
      setBindData = require('lodash._setbinddata'),
      slice = require('lodash._slice');
  
  /**
   * Used for `Array` method references.
   *
   * Normally `Array.prototype` would suffice, however, using an array literal
   * avoids issues in Narwhal.
   */
  var arrayRef = [];
  
  /** Native method shortcuts */
  var push = arrayRef.push;
  
  /**
   * The base implementation of `createWrapper` that creates the wrapper and
   * sets its meta data.
   *
   * @private
   * @param {Array} bindData The bind data array.
   * @returns {Function} Returns the new function.
   */
  function baseCreateWrapper(bindData) {
    var func = bindData[0],
        bitmask = bindData[1],
        partialArgs = bindData[2],
        partialRightArgs = bindData[3],
        thisArg = bindData[4],
        arity = bindData[5];
  
    var isBind = bitmask & 1,
        isBindKey = bitmask & 2,
        isCurry = bitmask & 4,
        isCurryBound = bitmask & 8,
        key = func;
  
    function bound() {
      var thisBinding = isBind ? thisArg : this;
      if (partialArgs) {
        var args = slice(partialArgs);
        push.apply(args, arguments);
      }
      if (partialRightArgs || isCurry) {
        args || (args = slice(arguments));
        if (partialRightArgs) {
          push.apply(args, partialRightArgs);
        }
        if (isCurry && args.length < arity) {
          bitmask |= 16 & ~32;
          return baseCreateWrapper([func, (isCurryBound ? bitmask : bitmask & ~3), args, null, thisArg, arity]);
        }
      }
      args || (args = arguments);
      if (isBindKey) {
        func = thisBinding[key];
      }
      if (this instanceof bound) {
        thisBinding = baseCreate(func.prototype);
        var result = func.apply(thisBinding, args);
        return isObject(result) ? result : thisBinding;
      }
      return func.apply(thisBinding, args);
    }
    setBindData(bound, bindData);
    return bound;
  }
  
  module.exports = baseCreateWrapper;
  
});
require.register('lodash.isfunction', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  
  /**
   * Checks if `value` is a function.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is a function, else `false`.
   * @example
   *
   * _.isFunction(_);
   * // => true
   */
  function isFunction(value) {
    return typeof value == 'function';
  }
  
  module.exports = isFunction;
  
});
require.register('lodash._createwrapper', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var baseBind = require('lodash._basebind'),
      baseCreateWrapper = require('lodash._basecreatewrapper'),
      isFunction = require('lodash.isfunction'),
      slice = require('lodash._slice');
  
  /**
   * Used for `Array` method references.
   *
   * Normally `Array.prototype` would suffice, however, using an array literal
   * avoids issues in Narwhal.
   */
  var arrayRef = [];
  
  /** Native method shortcuts */
  var push = arrayRef.push,
      unshift = arrayRef.unshift;
  
  /**
   * Creates a function that, when called, either curries or invokes `func`
   * with an optional `this` binding and partially applied arguments.
   *
   * @private
   * @param {Function|string} func The function or method name to reference.
   * @param {number} bitmask The bitmask of method flags to compose.
   *  The bitmask may be composed of the following flags:
   *  1 - `_.bind`
   *  2 - `_.bindKey`
   *  4 - `_.curry`
   *  8 - `_.curry` (bound)
   *  16 - `_.partial`
   *  32 - `_.partialRight`
   * @param {Array} [partialArgs] An array of arguments to prepend to those
   *  provided to the new function.
   * @param {Array} [partialRightArgs] An array of arguments to append to those
   *  provided to the new function.
   * @param {*} [thisArg] The `this` binding of `func`.
   * @param {number} [arity] The arity of `func`.
   * @returns {Function} Returns the new function.
   */
  function createWrapper(func, bitmask, partialArgs, partialRightArgs, thisArg, arity) {
    var isBind = bitmask & 1,
        isBindKey = bitmask & 2,
        isCurry = bitmask & 4,
        isCurryBound = bitmask & 8,
        isPartial = bitmask & 16,
        isPartialRight = bitmask & 32;
  
    if (!isBindKey && !isFunction(func)) {
      throw new TypeError;
    }
    if (isPartial && !partialArgs.length) {
      bitmask &= ~16;
      isPartial = partialArgs = false;
    }
    if (isPartialRight && !partialRightArgs.length) {
      bitmask &= ~32;
      isPartialRight = partialRightArgs = false;
    }
    var bindData = func && func.__bindData__;
    if (bindData && bindData !== true) {
      // clone `bindData`
      bindData = slice(bindData);
      if (bindData[2]) {
        bindData[2] = slice(bindData[2]);
      }
      if (bindData[3]) {
        bindData[3] = slice(bindData[3]);
      }
      // set `thisBinding` is not previously bound
      if (isBind && !(bindData[1] & 1)) {
        bindData[4] = thisArg;
      }
      // set if previously bound but not currently (subsequent curried functions)
      if (!isBind && bindData[1] & 1) {
        bitmask |= 8;
      }
      // set curried arity if not yet set
      if (isCurry && !(bindData[1] & 4)) {
        bindData[5] = arity;
      }
      // append partial left arguments
      if (isPartial) {
        push.apply(bindData[2] || (bindData[2] = []), partialArgs);
      }
      // append partial right arguments
      if (isPartialRight) {
        unshift.apply(bindData[3] || (bindData[3] = []), partialRightArgs);
      }
      // merge flags
      bindData[1] |= bitmask;
      return createWrapper.apply(null, bindData);
    }
    // fast path for `_.bind`
    var creater = (bitmask == 1 || bitmask === 17) ? baseBind : baseCreateWrapper;
    return creater([func, bitmask, partialArgs, partialRightArgs, thisArg, arity]);
  }
  
  module.exports = createWrapper;
  
});
require.register('lodash.bind', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var createWrapper = require('lodash._createwrapper'),
      slice = require('lodash._slice');
  
  /**
   * Creates a function that, when called, invokes `func` with the `this`
   * binding of `thisArg` and prepends any additional `bind` arguments to those
   * provided to the bound function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to bind.
   * @param {*} [thisArg] The `this` binding of `func`.
   * @param {...*} [arg] Arguments to be partially applied.
   * @returns {Function} Returns the new bound function.
   * @example
   *
   * var func = function(greeting) {
   *   return greeting + ' ' + this.name;
   * };
   *
   * func = _.bind(func, { 'name': 'fred' }, 'hi');
   * func();
   * // => 'hi fred'
   */
  function bind(func, thisArg) {
    return arguments.length > 2
      ? createWrapper(func, 17, slice(arguments, 2), null, thisArg)
      : createWrapper(func, 1, null, null, thisArg);
  }
  
  module.exports = bind;
  
});
require.register('lodash.identity', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  
  /**
   * This method returns the first argument provided to it.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {*} value Any value.
   * @returns {*} Returns `value`.
   * @example
   *
   * var object = { 'name': 'fred' };
   * _.identity(object) === object;
   * // => true
   */
  function identity(value) {
    return value;
  }
  
  module.exports = identity;
  
});
require.register('lodash.support', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var isNative = require('lodash._isnative');
  
  /** Used to detect functions containing a `this` reference */
  var reThis = /\bthis\b/;
  
  /**
   * An object used to flag environments features.
   *
   * @static
   * @memberOf _
   * @type Object
   */
  var support = {};
  
  /**
   * Detect if functions can be decompiled by `Function#toString`
   * (all but PS3 and older Opera mobile browsers & avoided in Windows 8 apps).
   *
   * @memberOf _.support
   * @type boolean
   */
  support.funcDecomp = !isNative(global.WinRTError) && reThis.test(function() { return this; });
  
  /**
   * Detect if `Function#name` is supported (all but IE).
   *
   * @memberOf _.support
   * @type boolean
   */
  support.funcNames = typeof Function.name == 'string';
  
  module.exports = support;
  
});
require.register('lodash._basecreatecallback', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var bind = require('lodash.bind'),
      identity = require('lodash.identity'),
      setBindData = require('lodash._setbinddata'),
      support = require('lodash.support');
  
  /** Used to detected named functions */
  var reFuncName = /^\s*function[ \n\r\t]+\w/;
  
  /** Used to detect functions containing a `this` reference */
  var reThis = /\bthis\b/;
  
  /** Native method shortcuts */
  var fnToString = Function.prototype.toString;
  
  /**
   * The base implementation of `_.createCallback` without support for creating
   * "_.pluck" or "_.where" style callbacks.
   *
   * @private
   * @param {*} [func=identity] The value to convert to a callback.
   * @param {*} [thisArg] The `this` binding of the created callback.
   * @param {number} [argCount] The number of arguments the callback accepts.
   * @returns {Function} Returns a callback function.
   */
  function baseCreateCallback(func, thisArg, argCount) {
    if (typeof func != 'function') {
      return identity;
    }
    // exit early for no `thisArg` or already bound by `Function#bind`
    if (typeof thisArg == 'undefined' || !('prototype' in func)) {
      return func;
    }
    var bindData = func.__bindData__;
    if (typeof bindData == 'undefined') {
      if (support.funcNames) {
        bindData = !func.name;
      }
      bindData = bindData || !support.funcDecomp;
      if (!bindData) {
        var source = fnToString.call(func);
        if (!support.funcNames) {
          bindData = !reFuncName.test(source);
        }
        if (!bindData) {
          // checks if `func` references the `this` keyword and stores the result
          bindData = reThis.test(source);
          setBindData(func, bindData);
        }
      }
    }
    // exit early if there are no `this` references or `func` is bound
    if (bindData === false || (bindData !== true && bindData[1] & 1)) {
      return func;
    }
    switch (argCount) {
      case 1: return function(value) {
        return func.call(thisArg, value);
      };
      case 2: return function(a, b) {
        return func.call(thisArg, a, b);
      };
      case 3: return function(value, index, collection) {
        return func.call(thisArg, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(thisArg, accumulator, value, index, collection);
      };
    }
    return bind(func, thisArg);
  }
  
  module.exports = baseCreateCallback;
  
});
require.register('lodash.forin', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var baseCreateCallback = require('lodash._basecreatecallback'),
      objectTypes = require('lodash._objecttypes');
  
  /**
   * Iterates over own and inherited enumerable properties of an object,
   * executing the callback for each property. The callback is bound to `thisArg`
   * and invoked with three arguments; (value, key, object). Callbacks may exit
   * iteration early by explicitly returning `false`.
   *
   * @static
   * @memberOf _
   * @type Function
   * @category Objects
   * @param {Object} object The object to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {*} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns `object`.
   * @example
   *
   * function Shape() {
   *   this.x = 0;
   *   this.y = 0;
   * }
   *
   * Shape.prototype.move = function(x, y) {
   *   this.x += x;
   *   this.y += y;
   * };
   *
   * _.forIn(new Shape, function(value, key) {
   *   console.log(key);
   * });
   * // => logs 'x', 'y', and 'move' (property order is not guaranteed across environments)
   */
  var forIn = function(collection, callback, thisArg) {
    var index, iterable = collection, result = iterable;
    if (!iterable) return result;
    if (!objectTypes[typeof iterable]) return result;
    callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
      for (index in iterable) {
        if (callback(iterable[index], index, collection) === false) return result;
      }
    return result
  };
  
  module.exports = forIn;
  
});
require.register('lodash._arraypool', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  
  /** Used to pool arrays and objects used internally */
  var arrayPool = [];
  
  module.exports = arrayPool;
  
});
require.register('lodash._getarray', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var arrayPool = require('lodash._arraypool');
  
  /**
   * Gets an array from the array pool or creates a new one if the pool is empty.
   *
   * @private
   * @returns {Array} The array from the pool.
   */
  function getArray() {
    return arrayPool.pop() || [];
  }
  
  module.exports = getArray;
  
});
require.register('lodash._maxpoolsize', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  
  /** Used as the max size of the `arrayPool` and `objectPool` */
  var maxPoolSize = 40;
  
  module.exports = maxPoolSize;
  
});
require.register('lodash._releasearray', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var arrayPool = require('lodash._arraypool'),
      maxPoolSize = require('lodash._maxpoolsize');
  
  /**
   * Releases the given array back to the array pool.
   *
   * @private
   * @param {Array} [array] The array to release.
   */
  function releaseArray(array) {
    array.length = 0;
    if (arrayPool.length < maxPoolSize) {
      arrayPool.push(array);
    }
  }
  
  module.exports = releaseArray;
  
});
require.register('lodash._baseisequal', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var forIn = require('lodash.forin'),
      getArray = require('lodash._getarray'),
      isFunction = require('lodash.isfunction'),
      objectTypes = require('lodash._objecttypes'),
      releaseArray = require('lodash._releasearray');
  
  /** `Object#toString` result shortcuts */
  var argsClass = '[object Arguments]',
      arrayClass = '[object Array]',
      boolClass = '[object Boolean]',
      dateClass = '[object Date]',
      numberClass = '[object Number]',
      objectClass = '[object Object]',
      regexpClass = '[object RegExp]',
      stringClass = '[object String]';
  
  /** Used for native method references */
  var objectProto = Object.prototype;
  
  /** Used to resolve the internal [[Class]] of values */
  var toString = objectProto.toString;
  
  /** Native method shortcuts */
  var hasOwnProperty = objectProto.hasOwnProperty;
  
  /**
   * The base implementation of `_.isEqual`, without support for `thisArg` binding,
   * that allows partial "_.where" style comparisons.
   *
   * @private
   * @param {*} a The value to compare.
   * @param {*} b The other value to compare.
   * @param {Function} [callback] The function to customize comparing values.
   * @param {Function} [isWhere=false] A flag to indicate performing partial comparisons.
   * @param {Array} [stackA=[]] Tracks traversed `a` objects.
   * @param {Array} [stackB=[]] Tracks traversed `b` objects.
   * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
   */
  function baseIsEqual(a, b, callback, isWhere, stackA, stackB) {
    // used to indicate that when comparing objects, `a` has at least the properties of `b`
    if (callback) {
      var result = callback(a, b);
      if (typeof result != 'undefined') {
        return !!result;
      }
    }
    // exit early for identical values
    if (a === b) {
      // treat `+0` vs. `-0` as not equal
      return a !== 0 || (1 / a == 1 / b);
    }
    var type = typeof a,
        otherType = typeof b;
  
    // exit early for unlike primitive values
    if (a === a &&
        !(a && objectTypes[type]) &&
        !(b && objectTypes[otherType])) {
      return false;
    }
    // exit early for `null` and `undefined` avoiding ES3's Function#call behavior
    // http://es5.github.io/#x15.3.4.4
    if (a == null || b == null) {
      return a === b;
    }
    // compare [[Class]] names
    var className = toString.call(a),
        otherClass = toString.call(b);
  
    if (className == argsClass) {
      className = objectClass;
    }
    if (otherClass == argsClass) {
      otherClass = objectClass;
    }
    if (className != otherClass) {
      return false;
    }
    switch (className) {
      case boolClass:
      case dateClass:
        // coerce dates and booleans to numbers, dates to milliseconds and booleans
        // to `1` or `0` treating invalid dates coerced to `NaN` as not equal
        return +a == +b;
  
      case numberClass:
        // treat `NaN` vs. `NaN` as equal
        return (a != +a)
          ? b != +b
          // but treat `+0` vs. `-0` as not equal
          : (a == 0 ? (1 / a == 1 / b) : a == +b);
  
      case regexpClass:
      case stringClass:
        // coerce regexes to strings (http://es5.github.io/#x15.10.6.4)
        // treat string primitives and their corresponding object instances as equal
        return a == String(b);
    }
    var isArr = className == arrayClass;
    if (!isArr) {
      // unwrap any `lodash` wrapped values
      var aWrapped = hasOwnProperty.call(a, '__wrapped__'),
          bWrapped = hasOwnProperty.call(b, '__wrapped__');
  
      if (aWrapped || bWrapped) {
        return baseIsEqual(aWrapped ? a.__wrapped__ : a, bWrapped ? b.__wrapped__ : b, callback, isWhere, stackA, stackB);
      }
      // exit for functions and DOM nodes
      if (className != objectClass) {
        return false;
      }
      // in older versions of Opera, `arguments` objects have `Array` constructors
      var ctorA = a.constructor,
          ctorB = b.constructor;
  
      // non `Object` object instances with different constructors are not equal
      if (ctorA != ctorB &&
            !(isFunction(ctorA) && ctorA instanceof ctorA && isFunction(ctorB) && ctorB instanceof ctorB) &&
            ('constructor' in a && 'constructor' in b)
          ) {
        return false;
      }
    }
    // assume cyclic structures are equal
    // the algorithm for detecting cyclic structures is adapted from ES 5.1
    // section 15.12.3, abstract operation `JO` (http://es5.github.io/#x15.12.3)
    var initedStack = !stackA;
    stackA || (stackA = getArray());
    stackB || (stackB = getArray());
  
    var length = stackA.length;
    while (length--) {
      if (stackA[length] == a) {
        return stackB[length] == b;
      }
    }
    var size = 0;
    result = true;
  
    // add `a` and `b` to the stack of traversed objects
    stackA.push(a);
    stackB.push(b);
  
    // recursively compare objects and arrays (susceptible to call stack limits)
    if (isArr) {
      // compare lengths to determine if a deep comparison is necessary
      length = a.length;
      size = b.length;
      result = size == length;
  
      if (result || isWhere) {
        // deep compare the contents, ignoring non-numeric properties
        while (size--) {
          var index = length,
              value = b[size];
  
          if (isWhere) {
            while (index--) {
              if ((result = baseIsEqual(a[index], value, callback, isWhere, stackA, stackB))) {
                break;
              }
            }
          } else if (!(result = baseIsEqual(a[size], value, callback, isWhere, stackA, stackB))) {
            break;
          }
        }
      }
    }
    else {
      // deep compare objects using `forIn`, instead of `forOwn`, to avoid `Object.keys`
      // which, in this case, is more costly
      forIn(b, function(value, key, b) {
        if (hasOwnProperty.call(b, key)) {
          // count the number of properties.
          size++;
          // deep compare each property value.
          return (result = hasOwnProperty.call(a, key) && baseIsEqual(a[key], value, callback, isWhere, stackA, stackB));
        }
      });
  
      if (result && !isWhere) {
        // ensure both objects have the same number of properties
        forIn(a, function(value, key, a) {
          if (hasOwnProperty.call(a, key)) {
            // `size` will be `-1` if `a` has more properties than `b`
            return (result = --size > -1);
          }
        });
      }
    }
    stackA.pop();
    stackB.pop();
  
    if (initedStack) {
      releaseArray(stackA);
      releaseArray(stackB);
    }
    return result;
  }
  
  module.exports = baseIsEqual;
  
});
require.register('lodash._shimkeys', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var objectTypes = require('lodash._objecttypes');
  
  /** Used for native method references */
  var objectProto = Object.prototype;
  
  /** Native method shortcuts */
  var hasOwnProperty = objectProto.hasOwnProperty;
  
  /**
   * A fallback implementation of `Object.keys` which produces an array of the
   * given object's own enumerable property names.
   *
   * @private
   * @type Function
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns an array of property names.
   */
  var shimKeys = function(object) {
    var index, iterable = object, result = [];
    if (!iterable) return result;
    if (!(objectTypes[typeof object])) return result;
      for (index in iterable) {
        if (hasOwnProperty.call(iterable, index)) {
          result.push(index);
        }
      }
    return result
  };
  
  module.exports = shimKeys;
  
});
require.register('lodash.keys', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var isNative = require('lodash._isnative'),
      isObject = require('lodash.isobject'),
      shimKeys = require('lodash._shimkeys');
  
  /* Native method shortcuts for methods with the same name as other `lodash` methods */
  var nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys;
  
  /**
   * Creates an array composed of the own enumerable property names of an object.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns an array of property names.
   * @example
   *
   * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
   * // => ['one', 'two', 'three'] (property order is not guaranteed across environments)
   */
  var keys = !nativeKeys ? shimKeys : function(object) {
    if (!isObject(object)) {
      return [];
    }
    return nativeKeys(object);
  };
  
  module.exports = keys;
  
});
require.register('lodash.property', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  
  /**
   * Creates a "_.pluck" style function, which returns the `key` value of a
   * given object.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {string} key The name of the property to retrieve.
   * @returns {Function} Returns the new function.
   * @example
   *
   * var characters = [
   *   { 'name': 'fred',   'age': 40 },
   *   { 'name': 'barney', 'age': 36 }
   * ];
   *
   * var getName = _.property('name');
   *
   * _.map(characters, getName);
   * // => ['barney', 'fred']
   *
   * _.sortBy(characters, getName);
   * // => [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred',   'age': 40 }]
   */
  function property(key) {
    return function(object) {
      return object[key];
    };
  }
  
  module.exports = property;
  
});
require.register('lodash.createcallback', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var baseCreateCallback = require('lodash._basecreatecallback'),
      baseIsEqual = require('lodash._baseisequal'),
      isObject = require('lodash.isobject'),
      keys = require('lodash.keys'),
      property = require('lodash.property');
  
  /**
   * Produces a callback bound to an optional `thisArg`. If `func` is a property
   * name the created callback will return the property value for a given element.
   * If `func` is an object the created callback will return `true` for elements
   * that contain the equivalent object properties, otherwise it will return `false`.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {*} [func=identity] The value to convert to a callback.
   * @param {*} [thisArg] The `this` binding of the created callback.
   * @param {number} [argCount] The number of arguments the callback accepts.
   * @returns {Function} Returns a callback function.
   * @example
   *
   * var characters = [
   *   { 'name': 'barney', 'age': 36 },
   *   { 'name': 'fred',   'age': 40 }
   * ];
   *
   * // wrap to create custom callback shorthands
   * _.createCallback = _.wrap(_.createCallback, function(func, callback, thisArg) {
   *   var match = /^(.+?)__([gl]t)(.+)$/.exec(callback);
   *   return !match ? func(callback, thisArg) : function(object) {
   *     return match[2] == 'gt' ? object[match[1]] > match[3] : object[match[1]] < match[3];
   *   };
   * });
   *
   * _.filter(characters, 'age__gt38');
   * // => [{ 'name': 'fred', 'age': 40 }]
   */
  function createCallback(func, thisArg, argCount) {
    var type = typeof func;
    if (func == null || type == 'function') {
      return baseCreateCallback(func, thisArg, argCount);
    }
    // handle "_.pluck" style callback shorthands
    if (type != 'object') {
      return property(func);
    }
    var props = keys(func),
        key = props[0],
        a = func[key];
  
    // handle "_.where" style callback shorthands
    if (props.length == 1 && a === a && !isObject(a)) {
      // fast path the common case of providing an object with a single
      // property containing a primitive value
      return function(object) {
        var b = object[key];
        return a === b && (a !== 0 || (1 / a == 1 / b));
      };
    }
    return function(object) {
      var length = props.length,
          result = false;
  
      while (length--) {
        if (!(result = baseIsEqual(object[props[length]], func[props[length]], null, true))) {
          break;
        }
      }
      return result;
    };
  }
  
  module.exports = createCallback;
  
});
require.register('lodash.forown', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var baseCreateCallback = require('lodash._basecreatecallback'),
      keys = require('lodash.keys'),
      objectTypes = require('lodash._objecttypes');
  
  /**
   * Iterates over own enumerable properties of an object, executing the callback
   * for each property. The callback is bound to `thisArg` and invoked with three
   * arguments; (value, key, object). Callbacks may exit iteration early by
   * explicitly returning `false`.
   *
   * @static
   * @memberOf _
   * @type Function
   * @category Objects
   * @param {Object} object The object to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {*} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns `object`.
   * @example
   *
   * _.forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
   *   console.log(key);
   * });
   * // => logs '0', '1', and 'length' (property order is not guaranteed across environments)
   */
  var forOwn = function(collection, callback, thisArg) {
    var index, iterable = collection, result = iterable;
    if (!iterable) return result;
    if (!objectTypes[typeof iterable]) return result;
    callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
      var ownIndex = -1,
          ownProps = objectTypes[typeof iterable] && keys(iterable),
          length = ownProps ? ownProps.length : 0;
  
      while (++ownIndex < length) {
        index = ownProps[ownIndex];
        if (callback(iterable[index], index, collection) === false) return result;
      }
    return result
  };
  
  module.exports = forOwn;
  
});
require.register('lodash.map', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var createCallback = require('lodash.createcallback'),
      forOwn = require('lodash.forown');
  
  /**
   * Creates an array of values by running each element in the collection
   * through the callback. The callback is bound to `thisArg` and invoked with
   * three arguments; (value, index|key, collection).
   *
   * If a property name is provided for `callback` the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is provided for `callback` the created "_.where" style callback
   * will return `true` for elements that have the properties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @alias collect
   * @category Collections
   * @param {Array|Object|string} collection The collection to iterate over.
   * @param {Function|Object|string} [callback=identity] The function called
   *  per iteration. If a property name or object is provided it will be used
   *  to create a "_.pluck" or "_.where" style callback, respectively.
   * @param {*} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of the results of each `callback` execution.
   * @example
   *
   * _.map([1, 2, 3], function(num) { return num * 3; });
   * // => [3, 6, 9]
   *
   * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { return num * 3; });
   * // => [3, 6, 9] (property order is not guaranteed across environments)
   *
   * var characters = [
   *   { 'name': 'barney', 'age': 36 },
   *   { 'name': 'fred',   'age': 40 }
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.map(characters, 'name');
   * // => ['barney', 'fred']
   */
  function map(collection, callback, thisArg) {
    var index = -1,
        length = collection ? collection.length : 0;
  
    callback = createCallback(callback, thisArg, 3);
    if (typeof length == 'number') {
      var result = Array(length);
      while (++index < length) {
        result[index] = callback(collection[index], index, collection);
      }
    } else {
      result = [];
      forOwn(collection, function(value, key, collection) {
        result[++index] = callback(value, key, collection);
      });
    }
    return result;
  }
  
  module.exports = map;
  
});
require.register('style', function(module, exports, require) {
  // TODO: handle setting special shortcut transform properties with arrays (translate, scale)?
  
  var isObject = require('lodash.isobject')
  	, isNan = require('lodash.isnan')
  	, isArray = require('lodash.isarray')
  	, isString = require('lodash.isstring')
  	, map = require('lodash.map')
  	, win = window
  	, doc = window.document
  	, el = doc.createElement('div')
  
  		// Hash of unit values
  	, numeric = {
  			'top': 'px',
  			'bottom': 'px',
  			'left': 'px',
  			'right': 'px',
  			'width': 'px',
  			'height': 'px',
  			'margin-top': 'px',
  			'margin-bottom': 'px',
  			'margin-left': 'px',
  			'margin-right': 'px',
  			'padding-top': 'px',
  			'padding-bottom': 'px',
  			'padding-left': 'px',
  			'padding-right': 'px',
  			'border-bottom-left-radius': 'px',
  			'border-bottom-right-radius': 'px',
  			'border-top-left-radius': 'px',
  			'border-top-right-radius': 'px',
   			'transition-duration': 'ms',
   			'opacity': '',
  			'font-size': 'px',
  			'translateX': 'px',
  			'translateY': 'px',
  			'translateZ': 'px',
  			'scaleX': '',
  			'scaleY': '',
  			'scaleZ': '',
  			'rotate': 'deg',
  			'rotateX': 'deg',
  			'rotateY': 'deg',
  			'rotateZ': 'deg',
  			'skewX': 'px',
  			'skewY': 'px'
  		}
  	, colour = {
  			'background-color': true,
  			'color': true,
  			'border-color': true
  		}
  		// Hash of shorthand properties
  	, shorthand = {
  			'border-radius': ['border-bottom-left-radius', 'border-bottom-right-radius', 'border-top-left-radius', 'border-top-right-radius'],
  			'border-color': ['border-bottom-color', 'border-left-color', 'border-top-color', 'border-right-color'],
  			'margin': ['margin-top', 'margin-right', 'margin-left', 'margin-bottom'],
  			'padding': ['padding-top', 'padding-right', 'padding-left', 'padding-bottom']
  		}
  		// Hash of transform properties
  	, transform = {
  			'transform': true,
  			'translate': true,
  			'translateX': true,
  			'translateY': true,
  			'translate3d': true,
  			'translateZ': true,
  			'rotate': true,
  			'rotate3d': true,
  			'rotateX': true,
  			'rotateY': true,
  			'rotateZ': true,
  			'scale': true,
  			'scaleX': true,
  			'scaleY': true,
  			'scale3d': true,
  			'scaleZ': true,
  			'skewX': true,
  			'skewY': true,
  			'perspective': true,
  			'matrix': true,
  			'matrix3d': true
  		}
  
  	, platformStyles = {}
  	, platformPrefix = ''
  
  	, RE_UNITS = /(px|%|em|ms|s|deg)$/
  	, RE_IE_OPACITY = /opacity=(\d+)/i
  	, RE_RGB = /rgb\((\d+),\s?(\d+),\s?(\d+)\)/
  	, RE_MATRIX = /^matrix(?:3d)?\(([^\)]+)/
  	, VENDOR_PREFIXES = ['-webkit-', '-moz-', '-ms-', '-o-']
  	, MATRIX_IDENTITY = [[1, 0, 0, 1, 0, 0], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]]
  	, MATRIX_PROPERTY_INDEX = {
  		translateX: [4,12],
  		translateY: [5,13],
  		translateZ: [null,14],
  		scaleX: [0,0],
  		scaleY: [3,5],
  		scaleZ: [null,10],
  		rotate: [0,0],
  		rotateX: [null,5],
  		rotateY: [null,0],
  		rotateZ: [null,0],
  		skewY: [1,1],
  		skewX: [2,2]
  	};
  
  // Store all possible styles this platform supports
  var s = current(doc.documentElement)
  	, add = function (prop) {
  			platformStyles[prop] = true;
  			// Grab the prefix style
  			if (!platformPrefix && prop.charAt(0) == '-') {
  				platformPrefix = /^-\w+-/.exec(prop)[0];
  			}
  		};
  
  if (s.length) {
  	for (var i = 0, n = s.length; i < n; i++) {
  		add(s[i]);
  	}
  } else {
  	for (var prop in s) {
  		add(prop);
  	}
  }
  
  // Store opacity property name (normalize IE opacity/filter)
  var opacity = !platformStyles['opacity'] && platformStyles['filter'] ? 'filter' : 'opacity';
  
  // API
  exports.isSupported = isSupported;
  exports.getPrefixed = getPrefixed;
  exports.getShorthand = getShorthand;
  exports.getAll = getAll;
  exports.expandShorthand = expandShorthand;
  exports.parseOpacity = parseOpacity;
  exports.getOpacityValue = getOpacityValue;
  exports.parseNumber = parseNumber;
  exports.parseTransform = parseTransform;
  exports.getStyle = getStyle;
  exports.getNumericStyle = getNumericStyle;
  exports.getDocumentStyle = getDocumentStyle;
  exports.setStyle = setStyle;
  exports.clearStyle = clearStyle;
  exports.platformStyles = platformStyles;
  exports.platformPrefix = platformPrefix;
  // CSS3 feature tests (also forces cache inclusion)
  exports.hasTransitions = isSupported('transition');
  exports.hasTransforms = isSupported('transform');
  exports.has3DTransforms = (function () {
  	if (exports.hasTransforms) {
  		var prop = camelCase(getPrefixed('transform'));
  		el.style[prop] = 'translateZ(10px)';
  		return el.style[prop] != '';
  	}
  	return false;
  })();
  
  /**
   * Determine if 'property' is supported on this platform
   * @returns {Boolean}
   */
  function isSupported (property) {
  	var props = [property, platformPrefix + property]
  		, support = false
  		, prop;
  
  	for (var i = 0, n = props.length; i < n; i++) {
  		prop = props[i];
  		// Use cached
  		if (exports.platformStyles[prop]) return true;
  		if (typeof el.style[prop] === 'string'
  			|| typeof el.style[camelCase(prop)] === 'string') {
  				support = true;
  				exports.platformStyles[prop] = true;
  				break;
  		}
  	}
  
  	return support;
  }
  
  /**
   * Retrieve the vendor prefixed version of the property
   * @param {String} property
   * @returns {String}
   */
  function getPrefixed (property) {
  	if (typeof property === 'string') {
  		// Handle transform pseudo-properties
  		if (transform[property]) {
  			property = 'transform';
  		}
  
  		if (exports.platformStyles[property]) return property;
  
  		if (isSupported(property)) {
  			if (exports.platformStyles[platformPrefix + property]) {
  				property = platformPrefix + property;
  			}
  		}
  	}
  
  	return property;
  }
  
  /**
   * Retrieve a proxy property to use for shorthand properties
   * @param {String} property
   * @returns {String}
   */
  function getShorthand (property) {
  	if (shorthand[property] != null) {
  		return shorthand[property][0];
  	} else {
  		return property;
  	}
  }
  
  /**
   * Retrieve all possible variations of the property
   * @param {String} property
   * @returns {Array}
   */
  function getAll (property) {
  	var all = [];
  
  	// Handle transform pseudo-properties
  	if (transform[property]) {
  		property = 'transform';
  	}
  
  	all.push(property);
  	// Handle shorthands
  	if (shorthand[property]) {
  		all = all.concat(shorthand[property]);
  	}
  	// Automatically add vendor prefix
  	for (var i = 0, n = all.length; i < n; i++) {
  		all.push(platformPrefix + all[i]);
  	}
  
  	return all;
  }
  
  /**
   * Expand shorthand properties
   * @param {String} property
   * @param {Object} value
   * @returns {Object|String}
   */
  function expandShorthand (property, value) {
  	if (shorthand[property] != null) {
  		var props = {};
  		for (var i = 0, n = shorthand[property].length; i < n; i++) {
  			props[shorthand[property][i]] = value;
  		}
  		return props;
  	} else {
  		return property;
  	}
  }
  
  /**
   * Parse current opacity value
   * @param {String} value
   * @returns {Number}
   */
  function parseOpacity (value) {
  	var match;
  	if (value === '') {
  		return null;
  	// IE case
  	} else if (opacity === 'filter') {
  		match = value.match(RE_IE_OPACITY);
  		if (match != null) {
  			return parseInt(match[1], 10) / 100;
  		}
  	} else {
  		return parseFloat(value);
  	}
  }
  
  /**
   * Convert opacity to IE filter syntax
   * @param {String} value
   * @returns {String}
   */
  function getOpacityValue (value) {
  	var val = parseFloat(value);
  	if (opacity === 'filter') {
  		val = "alpha(opacity=" + (val * 100) + ")";
  	}
  	return val;
  }
  
  /**
   * Split a value into a number and unit
   * @param {String} value
   * @param {String} property
   * @returns {Array}
   */
  function parseNumber (value, property) {
  	var channels, num, unit, unitTest;
  
  	if (value == null || value == 'none') {
  		value = 0;
  	}
  
  	// Handle arrays of values (translate, scale)
  	if (isArray(value)) {
  		return map(value, function (val) {
  			return parseNumber(val, property);
  		});
  	}
  
  	// Handle colours
  	if (colour[property]) {
  		// rgb()
  		if (value != null && value.charAt(0) !== '#') {
  			channels = RE_RGB.exec(value);
  			if (channels) {
  				return ["#" + ((1 << 24) | (channels[1] << 16) | (channels[2] << 8) | channels[3]).toString(16).slice(1), 'hex'];
  			} else {
  				return ['#ffffff', 'hex'];
  			}
  		} else {
  			return [value || '#ffffff', 'hex'];
  		}
  
  	// Handle numbers
  	} else {
  		num = parseFloat(value);
  		if (isNan(num)) {
  			return [value, ''];
  		} else {
  			unitTest = RE_UNITS.exec(value);
  			// Set unit or default
  			unit = (unitTest != null)
  				? unitTest[1]
  				: ((numeric[property] != null)
  						? numeric[property]
  						: 'px');
  			return [num, unit];
  		}
  	}
  }
  
  /**
   * Retrieve a 'property' from a transform 2d or 3d 'matrix'
   * @param {String|Array} matrix
   * @param {String} property
   * @returns {String|Number|Array}
   */
  function parseTransform (matrix, property) {
  	var m = matrixStringToArray(matrix)
  		, is3D = (m && m.length > 6) ? 1 : 0;
  
  	if (m) {
  		switch (property) {
  			case 'matrix':
  			case 'matrix3d':
  				return m;
  			case 'translateX':
  			case 'translateY':
  				return ''
  					+ m[MATRIX_PROPERTY_INDEX[property][is3D]]
  					+ 'px';
  			case 'translateZ':
  				return ''
  					+ (is3D ? m[MATRIX_PROPERTY_INDEX[property][is3D]] : '0')
  					+ 'px';
  			case 'translate':
  				return [parseTransform(matrix, 'translateX'), parseTransform(matrix, 'translateY')];
  			case 'translate3d':
  				return [parseTransform(matrix, 'translateX'), parseTransform(matrix, 'translateY'), parseTransform(matrix, 'translateZ')];
  			case 'scaleX':
  			case 'scaleY':
  				return m[MATRIX_PROPERTY_INDEX[property][is3D]];
  			case 'scaleZ':
  				return is3D ? m[10] : 1;
  			case 'scale':
  				return [parseTransform(matrix, 'scaleX'), parseTransform(matrix, 'scaleY')];
  			case 'scale3d':
  				return [parseTransform(matrix, 'scaleX'), parseTransform(matrix, 'scaleY'), parseTransform(matrix, 'scaleZ')];
  			case 'rotate':
  			case 'rotateY':
  			case 'rotateZ':
  				return ''
  					+ (Math.acos(m[0]) * 180) / Math.PI
  					+ 'deg';
  			case 'rotateX':
  				return ''
  					+ (Math.acos(m[5]) * 180) / Math.PI
  					+ 'deg';
  			case 'skewX':
  				return ''
  					+ (Math.atan(m[2]) * 180) / Math.PI
  					+ 'deg';
  			case 'skewY':
  				return ''
  					+ (Math.atan(m[1]) * 180) / Math.PI
  					+ 'deg';
  		}
  	}
  
  	return matrix;
  }
  
  /**
   * Convert a matrix property to a transform style string
   * Handles existing transforms and special grouped properties
   * @param {Element} element
   * @param {String} property
   * @param {String|Array} value
   * @returns {String}
   */
  function generateTransform (element, property, value) {
  	var matrix = current(element, getPrefixed(property))
  		, m, m1, is3D, idx, len;
  
  	if (matrix == 'none') matrix = '';
  
  	// Reset existing matrix, preserving translations
  	if (matrix) {
  		if (m = matrixStringToArray(matrix)) {
  			is3D = m.length > 6 ? 1 : 0;
  			len = is3D ? 3 : 2;
  			idx = is3D ? 12 : 4;
  			// Preserve translations
  			if (!(~property.indexOf('translate'))) {
  				m1 = MATRIX_IDENTITY[is3D].slice(0, idx)
  					.concat(m.slice(idx, idx + len));
  				if (is3D) m1.push(MATRIX_IDENTITY[is3D].slice(-1));
  				m = m1;
  			// Preserve translations and nullify changed
  			} else {
  				if (property == 'translate' || property == 'translate3d') {
  					m1 = m.slice(0, idx)
  						.concat(MATRIX_IDENTITY[is3D].slice(idx, idx + len));
  					if (is3D) m1.push(m.slice(-1));
  					m = m1;
  				} else if (property == 'translateX' || property == 'translateY' || property == 'translateZ') {
  					idx = MATRIX_PROPERTY_INDEX[property][is3D];
  					if (idx) m[idx] = MATRIX_IDENTITY[is3D][idx];
  				}
  			}
  
  			matrix = is3D ? 'matrix3d' : 'matrix'
  				+ '('
  				+ m.join(', ')
  				+ ') ';
  		}
  	}
  
  	if (numeric[property] != null) {
  		return ''
  			+ matrix
  			+ property
  			+ '('
  			+ value
  			+ ')';
  	// Grouped properties
  	} else {
  		switch (property) {
  			case 'transform':
  			case 'transform3d':
  				return value;
  			case 'matrix':
  			case 'matrix3d':
  				return ''
  					+ property
  					+ '('
  					+ value
  					+ ')';
  			case 'translate':
  			case 'translate3d':
  				if (isArray(value)) {
  					// Add default unit
  					value = map(value, function(item) {
  						return !isString(item) ? item + 'px': item;
  					})
  					.join(', ');
  				}
  				return ''
  					+ matrix
  					+ property
  					+ '('
  					+ value
  					+ ')';
  			case 'scale':
  			case 'scale3d':
  				if (isArray(value)) {
  					value = value.join(', ');
  				}
  				return ''
  					+ matrix
  					+ property
  					+ '('
  					+ value
  					+ ')';
  		}
  	}
  }
  
  /**
   * Retrieve the style for 'property'
   * @param {Element} element
   * @param {String} property
   * @returns {Object}
   */
  function getStyle (element, property) {
  	var prop, value;
  
  	// Special case for opacity
  	if (property === 'opacity') {
  		return parseOpacity(current(element, opacity));
  	}
  
  	// Retrieve longhand and prefixed version
  	prop = getPrefixed(getShorthand(property));
  	value = current(element, prop);
  
  	// Special case for transform
  	if (transform[property]) {
  		return parseTransform(value, property);
  	}
  
  	switch (value) {
  		case '':
  			return null;
  		case 'auto':
  			return 0;
  		default:
  			return value;
  	}
  }
  
  /**
   * Retrieve the numeric value for 'property'
   * @param {Element} element
   * @param {String} property
   * @returns {Number}
   */
  function getNumericStyle (element, property) {
  	return parseNumber(getStyle(element, property), property);
  }
  
  function getDocumentStyle (selector, property) {
  	var styleSheets = document.styleSheets
  		, sheet, rules, rule;
  
  	if (styleSheets) {
  		for (var i = 0, n = styleSheets.length; i < n; i++) {
  			sheet = styleSheets[i];
  			if (rules = sheet.rules || sheet.cssRules) {
  				for (var j = 0, m = rules.length; j < m; j++) {
  					rule = rules[j];
  					if (selector === rule.selectorText) {
  						return rule.style.getPropertyValue(property);
  					}
  				}
  			}
  		}
  	}
  
  	return '';
  }
  
  /**
   * Set the style for 'property'
   * @param {Element} element
   * @param {String|Object} property
   * @param {Object} value
   */
  function setStyle (element, property, value) {
  	var prop, matrix;
  
  	// Expand shorthands
  	prop = expandShorthand(property, value);
  	// Handle property hash returned from expandShorthand
  	if (isObject(prop)) {
  		for (var p in prop) {
  			setStyle(element, p, prop[p]);
  		}
  		return;
  	}
  
  	// Handle opacity
  	if (prop === 'opacity') {
  		prop = opacity;
  		value = getOpacityValue(value);
  	}
  
  	// Look up default numeric unit if none provided
  	if (value !== 'auto'
  		&& value !== 'inherit'
  		&& numeric[prop]
  		&& !RE_UNITS.test(value)) {
  			value += numeric[prop];
  	}
  
  	// Look up prefixed property
  	prop = getPrefixed(prop);
  
  	// Handle special transform properties
  	// TODO: bulk multiple transforms?
  	if (transform[property]) {
  		value = generateTransform(element, property, value);
  	}
  
  	element.style[camelCase(prop)] = value;
  }
  
  /**
   * Remove the style for 'property'
   * @param {Element} element
   * @param {String} property
   */
  function clearStyle (element, property) {
  	var style = element.getAttribute('style') || ''
  		, re;
  
  	if (style) {
  		property = getAll(property).join('[\\w-]*|') + '[\\w-]*';
  
  		re = new RegExp('(?:^|\\s)(?:' + property + '):\\s?[^;]+;', 'ig');
  		element.setAttribute('style', style.replace(re, ''));
  	}
  }
  
  /**
   * Retrieve current computed style
   * @param {Element} element
   * @param {String} property
   * @returns {String}
   */
  function current (element, property) {
  	var value;
  
  	if (win.getComputedStyle) {
  		if (property) {
  			value = win.getComputedStyle(element).getPropertyValue(property);
  			// Try with camel casing
  			if (value == null) win.getComputedStyle(element).getPropertyValue(camelCase(property));
  			return value;
  		} else {
  			return win.getComputedStyle(element);
  		}
  	// IE
  	} else {
  		if (property) {
  			value = element.currentStyle[property];
  			// Try with camel casing
  			if (value == null) element.currentStyle[camelCase(property)];
  			return value;
  		} else {
  			return element.currentStyle;
  		}
  	}
  }
  
  /**
   * CamelCase 'str, removing '-'
   * @param {String} str
   * @returns {String}
   */
  function camelCase (str) {
  	// IE requires vendor prefixed values to start with lowercase
  	if (str.indexOf('-ms-') == 0) str = str.slice(1);
  	return str.replace(/-([a-z]|[0-9])/ig, function(all, letter) {
  		return (letter + '').toUpperCase();
  	});
  }
  
  /**
   * Convert 'matrix' to Array
   * @param {String|Array} matrix
   * @returns {Array}
   */
  function matrixStringToArray (matrix) {
  	if (isArray(matrix)) {
  		return matrix;
  	} else if (re = matrix.match(RE_MATRIX)) {
  		// Convert string to array
  		return re[1].split(', ')
  			.map(function (item) {
  				return parseFloat(item);
  			});
  	}
  }
  
});
require.register('primitives/sunPrimitive', function(module, exports, require) {
  var svg = require('svg')  
  	, style = require('style')  
    
  	, TWO_PI = Math.PI * 2  
  	, RAY_COLOUR = style.getDocumentStyle('.sun-ray', 'fill') || '#e88d15'  
  	, CENTER_COLOUR = style.getDocumentStyle('.sun-centre', 'fill') ||'#faba2f'  
  	, HORIZON_COLOUR = style.getDocumentStyle('.sun-winter-horizon', 'fill') || '#4d4d4d'  
  	, STROKE_WIDTH = 4;  
    
  /**  
   * Render  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  exports.render = function (element, options) {  
  	if (options.type == 'svg') {  
  		return renderSVG(element, options);  
  	} else {  
  		return renderCanvas(element, options);  
  	}  
  };  
    
  /**  
   * Render svg version  
   * @param {DOMElement} element  
   * @param {Object} options  
   * @returns {String}  
   */  
  function renderSVG (element, options) {  
  	svg.appendChild(element, 'use', {  
  		'xlink:href': options.winter ? '#sunWinter' : '#sun',  
  		x: '0',  
  		y: '0',  
  		width: '100',  
  		height: '100',  
  		transform: 'translate('  
  			+ options.x  
  			+ ','  
  			+ options.y  
  			+ ') scale('  
  			+ options.scale  
  			+ ')'  
  	});  
  }  
    
  /**  
   * Render canvas version  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  function renderCanvas (element, options) {  
  	var ctx = element.getContext('2d');  
    
  	ctx.save();  
  	ctx.translate(options.x, options.y);  
  	ctx.scale(options.scale, options.scale);  
  	ctx.strokeStyle = options.bg;  
  	ctx.lineWidth = STROKE_WIDTH;  
    
  	if (options.winter) {  
  		// Horizon  
  		ctx.fillStyle = HORIZON_COLOUR;  
  		ctx.beginPath();  
  		ctx.moveTo(2.5,0);  
  		ctx.lineTo(87.6,0);  
  		ctx.bezierCurveTo(88.9,0,90,0.9,90,2);  
  		ctx.lineTo(90,2);  
  		ctx.bezierCurveTo(90,3.1,88.9,4,87.5,4);  
  		ctx.lineTo(2.5,4);  
  		ctx.bezierCurveTo(1.1,4,0,3.1,0,2);  
  		ctx.lineTo(0,2);  
  		ctx.bezierCurveTo(0,0.9,1.1,0,2.5,0);  
  		ctx.fill();  
  		ctx.closePath();  
    
  		// Mask  
  		ctx.beginPath()  
  		ctx.moveTo(0,8);  
  		ctx.lineTo(100,8);  
  		ctx.lineTo(100,100);  
  		ctx.lineTo(0,100);  
  		ctx.lineTo(0,8);  
  		ctx.closePath();  
  		ctx.clip();  
    
  		// Rays  
  		ctx.fillStyle = RAY_COLOUR;  
  		ctx.beginPath();  
  		ctx.moveTo(64.4,16.1);  
  		ctx.lineTo(87.6,10);  
  		ctx.bezierCurveTo(89.6,9.5,89.6,6.7,87.6,6.1);  
  		ctx.lineTo(64.4,0.1);  
  		ctx.lineTo(76.60000000000001,-20.7);  
  		ctx.bezierCurveTo(77.60000000000001,-22.5,75.60000000000001,-24.5,73.9,-23.4);  
  		ctx.lineTo(53.1,-11.2);  
  		ctx.lineTo(47,-34.5);  
  		ctx.bezierCurveTo(46.5,-36.5,43.7,-36.5,43.1,-34.5);  
  		ctx.lineTo(37,-11.2);  
  		ctx.lineTo(16.3,-23.4);  
  		ctx.bezierCurveTo(14.5,-24.4,12.5,-22.4,13.600000000000001,-20.7);  
  		ctx.lineTo(25.8,0.1);  
  		ctx.lineTo(2.5,6.1);  
  		ctx.bezierCurveTo(0.5,6.6,0.5,9.399999999999999,2.5,10);  
  		ctx.lineTo(25.8,16.1);  
  		ctx.lineTo(13.6,36.8);  
  		ctx.bezierCurveTo(12.6,38.599999999999994,14.6,40.599999999999994,16.3,39.5);  
  		ctx.lineTo(37.1,27.3);  
  		ctx.lineTo(43.2,50.6);  
  		ctx.bezierCurveTo(43.7,52.6,46.5,52.6,47.1,50.6);  
  		ctx.lineTo(53.2,27.3);  
  		ctx.lineTo(74,39.5);  
  		ctx.bezierCurveTo(75.8,40.5,77.8,38.5,76.7,36.8);  
  		ctx.lineTo(64.4,16.1);  
  		ctx.closePath();  
  		ctx.fill();  
    
  		// Center fill  
  		ctx.fillStyle = CENTER_COLOUR;  
  		ctx.beginPath();  
  		ctx.arc(45,8,22.5,0,TWO_PI,true);  
  		ctx.closePath();  
  		ctx.fill();  
  		ctx.stroke();  
    
  	} else {  
  		// Rays  
  		ctx.fillStyle = RAY_COLOUR;  
  		ctx.beginPath();  
  		ctx.moveTo(64.3,53);  
  		ctx.lineTo(87.6,46.9);  
  		ctx.bezierCurveTo(89.6,46.4,89.6,43.6,87.6,43);  
  		ctx.lineTo(64.3,37);  
  		ctx.lineTo(76.5,16.2);  
  		ctx.bezierCurveTo(77.5,14.399999999999999,75.5,12.399999999999999,73.8,13.5);  
  		ctx.lineTo(53,25.7);  
  		ctx.lineTo(46.9,2.4);  
  		ctx.bezierCurveTo(46.4,0.3999999999999999,43.6,0.3999999999999999,43,2.4);  
  		ctx.lineTo(37,25.7);  
  		ctx.lineTo(16.3,13.5);  
  		ctx.bezierCurveTo(14.5,12.5,12.5,14.5,13.600000000000001,16.2);  
  		ctx.lineTo(25.7,37);  
  		ctx.lineTo(2.4,43.1);  
  		ctx.bezierCurveTo(0.3999999999999999,43.6,0.3999999999999999,46.4,2.4,47);  
  		ctx.lineTo(25.7,53);  
  		ctx.lineTo(13.5,73.7);  
  		ctx.bezierCurveTo(12.5,75.5,14.5,77.5,16.2,76.4);  
  		ctx.lineTo(37,64.3);  
  		ctx.lineTo(43.1,87.6);  
  		ctx.bezierCurveTo(43.6,89.6,46.4,89.6,47,87.6);  
  		ctx.lineTo(53,64.3);  
  		ctx.lineTo(73.8,76.5);  
  		ctx.bezierCurveTo(75.6,77.5,77.6,75.5,76.5,73.8);  
  		ctx.lineTo(64.3,53);  
  		ctx.closePath();  
  		ctx.fill();  
    
  		// Center fill  
  		ctx.fillStyle = CENTER_COLOUR;  
  		ctx.beginPath();  
  		ctx.arc(45,45,22.5,0,TWO_PI,true);  
  		ctx.closePath();  
  		ctx.fill();  
  		ctx.stroke();  
  	}  
  	ctx.restore();  
  }
});
require.register('primitives/moonPrimitive', function(module, exports, require) {
  var svg = require('svg')  
  	, style = require('style')  
    
  	, TWO_PI = Math.PI * 2  
  	, FILL_COLOUR = style.getDocumentStyle('.moon', 'fill') || '#afc1c9';  
    
  /**  
   * Render  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  exports.render = function (element, options) {  
  	if (options.type == 'svg') {  
  		return renderSVG(element, options);  
  	} else {  
  		return renderCanvas(element, options);  
  	}  
  };  
    
  /**  
   * Render svg version  
   * @param {DOMElement} element  
   * @param {Object} options  
   * @returns {String}  
   */  
  function renderSVG (element, options) {  
  	svg.appendChild(element, 'use', {  
  		'xlink:href': '#moon',  
  		x: '0',  
  		y: '0',  
  		width: '100',  
  		height: '100',  
  		transform: 'translate('  
  			+ options.x  
  			+ ','  
  			+ options.y  
  			+ ') scale('  
  			+ options.scale  
  			+ ')'  
  	});  
  }  
    
  /**  
   * Render canvas version  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  function renderCanvas (element, options) {  
  	var ctx = element.getContext('2d');  
    
  	ctx.save();  
    
  	ctx.translate(options.x, options.y)  
  	ctx.scale(options.scale, options.scale);  
  	ctx.fillStyle = FILL_COLOUR;  
  	ctx.beginPath();  
  	ctx.moveTo(23,20);  
  	ctx.bezierCurveTo(23,12.322,25.887999999999998,5.321999999999999,30.631,0.015999999999998238);  
  	ctx.bezierCurveTo(30.421,0.012,30.212,0,30,0);  
  	ctx.bezierCurveTo(13.432,0,0,13.432,0,30);  
  	ctx.bezierCurveTo(0,46.568,13.432,60,30,60);  
  	ctx.bezierCurveTo(38.891,60,46.875,56.129,52.369,49.984);  
  	ctx.bezierCurveTo(36.093,49.646,23,36.356,23,20);  
  	ctx.closePath();  
  	ctx.fill();  
  	ctx.restore();  
  }
});
require.register('primitives/cloudPrimitive', function(module, exports, require) {
  var svg = require('svg')  
  	, STROKE_WIDTH = 4  
  	, WIDTH = 100;  
    
  /**  
   * Render  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  exports.render = function (element, options) {  
  	if (options.type == 'svg') {  
  		return renderSVG(element, options);  
  	} else {  
  		return renderCanvas(element, options);  
  	}  
  };  
    
  /**  
   * Render svg version  
   * @param {DOMElement} element  
   * @param {Object} options  
   * @returns {String}  
   */  
  function renderSVG (element, options) {  
  	svg.appendChild(element, 'use', {  
  		'xlink:href': '#cloud-' + options.tint * 100,  
  		x: '0',  
  		y: '0',  
  		width: '100',  
  		height: '100',  
  		transform: options.flip  
  			? 'translate('  
  				+ ((WIDTH * options.scale) + options.x)  
  				+ ','  
  				+ options.y  
  				+ ') scale('  
  				+ (-1 * options.scale)  
  				+ ', '  
  				+ options.scale  
  				+ ')'  
  			: 'translate('  
  				+ options.x  
  				+ ','  
  				+ options.y  
  				+ ') scale('  
  				+ options.scale  
  				+ ')'  
  	});  
  }  
    
  /**  
   * Render canvas version  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  function renderCanvas (element, options) {  
  	var ctx = element.getContext('2d')  
  		, tint = Math.floor(255 * (1-options.tint));  
    
  	ctx.save();  
  	if (options.flip) {  
  		ctx.translate((WIDTH * options.scale) + options.x, options.y)  
  		ctx.scale(-1 * options.scale, options.scale);  
  	} else {  
  		ctx.translate(options.x, options.y)  
  		ctx.scale(options.scale, options.scale);  
  	}  
    
  	// Fill  
  	ctx.strokeStyle = options.bg;  
  	ctx.lineWidth = STROKE_WIDTH;  
  	ctx.fillStyle = 'rgb(' + tint	+ ',' + tint + ',' + tint + ')';  
  	ctx.beginPath();  
  	ctx.moveTo(55.6,2);  
  	ctx.bezierCurveTo(46,1.7,37.1,7,34.1,17.3);  
  	ctx.bezierCurveTo(28,15.8,18.1,19.7,16.3,28.200000000000003);  
  	ctx.bezierCurveTo(10.1,28,2,33.1,2,41.6);  
  	ctx.bezierCurveTo(2,51,9,56,21.5,56);  
  	ctx.lineTo(65.1,56);  
  	ctx.bezierCurveTo(70.69999999999999,56,78,55.5,82.39999999999999,53.4);  
  	ctx.bezierCurveTo(97.3,46.199999999999996,94.69999999999999,21.1,75.99999999999999,18.799999999999997);  
  	ctx.bezierCurveTo(73.7,7.9,65.1,2.3,55.6,2);  
  	ctx.closePath();  
  	ctx.fill();  
  	ctx.stroke();  
  	ctx.restore();  
  }
});
require.register('primitives/raindropPrimitive', function(module, exports, require) {
  var svg = require('svg')  
  	, style = require('style')  
    
  	, TWO_PI = Math.PI * 2  
  	, FILL_COLOUR = style.getDocumentStyle('.raindrop', 'fill') || '#1671CC';  
    
  /**  
   * Render  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  exports.render = function (element, options) {  
  	if (options.type == 'svg') {  
  		return renderSVG(element, options);  
  	} else {  
  		return renderCanvas(element, options);  
  	}  
  };  
    
  /**  
   * Render svg version  
   * @param {DOMElement} element  
   * @param {Object} options  
   * @returns {String}  
   */  
  function renderSVG (element, options) {  
  	svg.appendChild(element, 'use', {  
  		'xlink:href': '#raindrop',  
  		x: '0',  
  		y: '0',  
  		width: '100',  
  		height: '100',  
  		transform: 'translate('  
  			+ options.x  
  			+ ','  
  			+ options.y  
  			+ ')'  
  	});  
  }  
    
  /**  
   * Render canvas version  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  function renderCanvas (element, options) {  
  	var ctx = element.getContext('2d');  
    
  	// Stroke  
  	ctx.save();  
  	ctx.fillStyle = options.bg;  
  	ctx.translate(options.x, options.y)  
  	ctx.scale(options.scale, options.scale);  
  	ctx.fillStyle = options.bg;  
  	ctx.beginPath();  
  	ctx.arc(9,9,9,0,TWO_PI,true);  
  	ctx.closePath();  
  	ctx.fill();  
    
  	// Fill  
  	ctx.fillStyle = FILL_COLOUR;  
  	ctx.beginPath();  
  	ctx.moveTo(20,16.8);  
  	ctx.bezierCurveTo(20,20.2,17.3,23,14,23);  
  	ctx.bezierCurveTo(10.7,23,8,20.2,8,16.8);  
  	ctx.bezierCurveTo(8,14.9,8,6,8,6);  
  	ctx.bezierCurveTo(13.5,11.5,20,11.2,20,16.8);  
  	ctx.closePath();  
  	ctx.fill();  
  	ctx.restore();  
  }
});
require.register('primitives/sleetPrimitive', function(module, exports, require) {
  var svg = require('svg')
  	, style = require('style')
  
  	, TWO_PI = Math.PI * 2
  	, FILL_COLOUR = style.getDocumentStyle('.sleet', 'fill') || '#1EB9D8';
  
  /**
   * Render
   * @param {DOMElement} element
   * @param {Object} options
   */
  exports.render = function (element, options) {
  	if (options.type == 'svg') {
  		return renderSVG(element, options);
  	} else {
  		return renderCanvas(element, options);
  	}
  }
  
  /**
   * Render svg version
   * @param {DOMElement} element
   * @param {Object} options
   * @returns {String}
   */
  function renderSVG (element, options) {
  	svg.appendChild(element, 'use', {
  		'xlink:href': '#sleet',
  		x: '0',
  		y: '0',
  		width: '100',
  		height: '100',
  		transform: 'translate('
  			+ options.x
  			+ ','
  			+ options.y
  			+ ')'
  	});
  }
  
  /**
   * Render canvas version
   * @param {DOMElement} element
   * @param {Object} options
   */
  function renderCanvas (element, options) {
  	var ctx = element.getContext('2d');
  
  	// Stroke
  	ctx.save();
  	ctx.fillStyle = options.bg;
  	ctx.translate(options.x, options.y)
  	ctx.scale(options.scale, options.scale);
  	ctx.fillStyle = options.bg;
  	ctx.beginPath();
  	ctx.arc(9,9,9,0,TWO_PI,true);
  	ctx.closePath();
  	ctx.fill();
  
  	// Fill
  	ctx.fillStyle = FILL_COLOUR;
  	ctx.beginPath();
  	ctx.moveTo(19.9,16.6);
  	ctx.bezierCurveTo(18.099999999999998,18.900000000000002,16.5,22.1,15.999999999999998,25.5);
  	ctx.bezierCurveTo(15.899999999999999,26,15.399999999999999,26.2,14.999999999999998,25.9);
  	ctx.bezierCurveTo(12.7,23.799999999999997,10.2,22.599999999999998,6.499999999999998,22.099999999999998);
  	ctx.bezierCurveTo(6.099999999999998,21.999999999999996,5.899999999999999,21.599999999999998,6.099999999999998,21.299999999999997);
  	ctx.bezierCurveTo(8.4,17,8.6,10.1,7.8,5);
  	ctx.bezierCurveTo(10.5,9.2,14.899999999999999,14,19.6,15.7);
  	ctx.bezierCurveTo(20,15.8,20.1,16.3,19.9,16.6);
  	ctx.closePath();
  	ctx.fill();
  	ctx.restore();
  };
});
require.register('primitives/snowflakePrimitive', function(module, exports, require) {
  var svg = require('svg')  
  	, style = require('style')  
    
  	, TWO_PI = Math.PI * 2  
  	, FILL_COLOUR = style.getDocumentStyle('.snowflake', 'fill') || '#54BFE3';  
    
  /**  
   * Render  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  exports.render = function (element, options) {  
  	if (options.type == 'svg') {  
  		return renderSVG(element, options);  
  	} else {  
  		return renderCanvas(element, options);  
  	}  
  };  
    
  /**  
   * Render svg version  
   * @param {DOMElement} element  
   * @param {Object} options  
   * @returns {String}  
   */  
  function renderSVG (element, options) {  
  	svg.appendChild(element, 'use', {  
  		'xlink:href': '#snowflake',  
  		x: '0',  
  		y: '0',  
  		width: '100',  
  		height: '100',  
  		transform: 'translate('  
  			+ options.x  
  			+ ','  
  			+ options.y  
  			+ ')'  
  	});  
  }  
    
  /**  
   * Render canvas version  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  function renderCanvas (element, options) {  
  	var ctx = element.getContext('2d');  
    
  	// Stroke  
  	ctx.save();  
  	ctx.fillStyle = options.bg;  
  	ctx.translate(options.x, options.y)  
  	ctx.scale(options.scale, options.scale);  
  	ctx.fillStyle = options.bg;  
  	ctx.beginPath();  
  	ctx.arc(9,9,9,0,TWO_PI,true);  
  	ctx.closePath();  
  	ctx.fill();  
    
  	// Fill  
  	ctx.fillStyle = FILL_COLOUR;  
  	ctx.beginPath();  
  	ctx.moveTo(6.2,6.9);  
  	ctx.lineTo(7.300000000000001,10.7);  
  	ctx.bezierCurveTo(7.000000000000001,10.899999999999999,6.700000000000001,11.2,6.4,11.5);  
  	ctx.bezierCurveTo(6,11.7,5.8,12,5.6,12.4);  
  	ctx.lineTo(1.7999999999999998,11.4);  
  	ctx.bezierCurveTo(1,11.2,0.2,11.7,0,12.5);  
  	ctx.bezierCurveTo(-0.2,13.3,0.3,14.1,1.1,14.3);  
  	ctx.lineTo(4.9,15.3);  
  	ctx.bezierCurveTo(4.9,16.1,5.2,16.900000000000002,5.5,17.6);  
  	ctx.lineTo(2.8,20.400000000000002);  
  	ctx.bezierCurveTo(2.1999999999999997,21.000000000000004,2.1999999999999997,21.900000000000002,2.8,22.500000000000004);  
  	ctx.bezierCurveTo(3.4,23.100000000000005,4.3,23.100000000000005,4.9,22.500000000000004);  
  	ctx.lineTo(7.6000000000000005,19.700000000000003);  
  	ctx.bezierCurveTo(8.3,20.1,9.100000000000001,20.300000000000004,9.9,20.300000000000004);  
  	ctx.lineTo(10.9,24.100000000000005);  
  	ctx.bezierCurveTo(11.1,24.900000000000006,11.9,25.300000000000004,12.700000000000001,25.100000000000005);  
  	ctx.bezierCurveTo(13.500000000000002,24.900000000000006,13.9,24.100000000000005,13.700000000000001,23.300000000000004);  
  	ctx.lineTo(12.600000000000001,19.500000000000004);  
  	ctx.bezierCurveTo(12.900000000000002,19.300000000000004,13.3,19.100000000000005,13.600000000000001,18.800000000000004);  
  	ctx.bezierCurveTo(13.900000000000002,18.500000000000004,14.100000000000001,18.200000000000003,14.3,17.800000000000004);  
  	ctx.lineTo(18.1,18.800000000000004);  
  	ctx.bezierCurveTo(18.900000000000002,19.000000000000004,19.700000000000003,18.500000000000004,19.900000000000002,17.700000000000003);  
  	ctx.bezierCurveTo(20.1,16.900000000000002,19.6,16.1,18.8,15.900000000000002);  
  	ctx.lineTo(15,14.900000000000002);  
  	ctx.bezierCurveTo(15,14.100000000000001,14.7,13.300000000000002,14.3,12.600000000000001);  
  	ctx.lineTo(17,9.8);  
  	ctx.bezierCurveTo(17.6,9.200000000000001,17.5,8.3,17,7.700000000000001);  
  	ctx.bezierCurveTo(16.4,7.100000000000001,15.5,7.100000000000001,14.9,7.700000000000001);  
  	ctx.lineTo(12.2,10.5);  
  	ctx.bezierCurveTo(11.5,10.1,10.7,9.9,9.899999999999999,9.9);  
  	ctx.lineTo(9,6.1);  
  	ctx.bezierCurveTo(8.8,5.3,8,4.8999999999999995,7.2,5.1);  
  	ctx.bezierCurveTo(6.5,5.3,6,6.1,6.2,6.9);  
  	ctx.closePath();  
  	ctx.moveTo(11.8,13.2);  
  	ctx.bezierCurveTo(12.8,14.2,12.8,15.799999999999999,11.8,16.8);  
  	ctx.bezierCurveTo(10.8,17.8,9.200000000000001,17.8,8.200000000000001,16.8);  
  	ctx.bezierCurveTo(7.200000000000001,15.8,7.200000000000001,14.200000000000001,8.200000000000001,13.200000000000001);  
  	ctx.bezierCurveTo(9.2,12.2,10.8,12.2,11.8,13.2);  
  	ctx.closePath();  
  	ctx.fill();  
  	ctx.restore();  
  }
});
require.register('primitives/fogPrimitive', function(module, exports, require) {
  var svg = require('svg');  
    
  /**  
   * Render  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  exports.render = function (element, options) {  
  	if (options.type == 'svg') {  
  		return renderSVG(element, options);  
  	} else {  
  		return renderCanvas(element, options);  
  	}  
  };  
    
  /**  
   * Render svg version  
   * @param {DOMElement} element  
   * @param {Object} options  
   * @returns {String}  
   */  
  function renderSVG (element, options) {  
  	svg.appendChild(element, 'use', {  
  		'xlink:href': '#fog',  
  		x: '0',  
  		y: '0',  
  		width: '100',  
  		height: '100',  
  		transform: 'translate('  
  			+ options.x  
  			+ ','  
  			+ options.y  
  			+ ')'  
  	});  
  }  
    
  /**  
   * Render canvas version  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  function renderCanvas (element, options) {  
  	var ctx = element.getContext('2d')  
  		, tint = Math.floor(255 * (1-options.tint));  
    
  	ctx.save();  
  	ctx.fillStyle = 'rgb(' + tint	+ ',' + tint + ',' + tint + ')';  
  	ctx.translate(options.x, options.y)  
  	ctx.scale(options.scale, options.scale);  
  	ctx.beginPath();  
  	ctx.moveTo(82.3,42);  
  	ctx.lineTo(2.7,42);  
  	ctx.bezierCurveTo(1.2,42,0,42.9,0,44);  
  	ctx.bezierCurveTo(0,45.1,1.2,46,2.7,46);  
  	ctx.lineTo(82.4,46);  
  	ctx.bezierCurveTo(83.9,46,85.10000000000001,45.1,85.10000000000001,44);  
  	ctx.bezierCurveTo(85.10000000000001,42.9,83.8,42,82.3,42);  
  	ctx.closePath();  
  	ctx.fill();  
    
  	ctx.beginPath();  
  	ctx.moveTo(80.1,50);  
  	ctx.lineTo(5.9,50);  
  	ctx.bezierCurveTo(4.3,50,3,50.9,3,52);  
  	ctx.bezierCurveTo(3,53.1,4.3,54,5.9,54);  
  	ctx.lineTo(80.2,54);  
  	ctx.bezierCurveTo(81.8,54,83.10000000000001,53.1,83.10000000000001,52);  
  	ctx.bezierCurveTo(83,50.9,81.7,50,80.1,50);  
  	ctx.closePath();  
  	ctx.fill();  
    
  	ctx.beginPath();  
  	ctx.moveTo(80.1,58);  
  	ctx.lineTo(10.9,58);  
  	ctx.bezierCurveTo(9.3,58,8,58.9,8,60);  
  	ctx.bezierCurveTo(8,61.1,9.3,62,10.9,62);  
  	ctx.lineTo(80.10000000000001,62);  
  	ctx.bezierCurveTo(81.7,62,83.00000000000001,61.1,83.00000000000001,60);  
  	ctx.bezierCurveTo(83.00000000000001,58.9,81.7,58,80.1,58);  
  	ctx.closePath();  
  	ctx.fill();  
    
  	ctx.beginPath();  
  	ctx.moveTo(51.2,0);  
  	ctx.bezierCurveTo(42.1,-0.3,33.6,4.8,30.700000000000003,14.6);  
  	ctx.bezierCurveTo(24.800000000000004,13.2,15.400000000000002,16.9,13.700000000000003,25);  
  	ctx.bezierCurveTo(8.2,24.9,1.2,29,0.1,36);  
  	ctx.bezierCurveTo(0,37,0.7,37.9,1.7,37.9);  
  	ctx.lineTo(84,37.9);  
  	ctx.bezierCurveTo(85,37.9,85.8,37.199999999999996,85.9,36.199999999999996);  
  	ctx.bezierCurveTo(86.9,27.299999999999997,81.80000000000001,17.499999999999996,70.7,16.099999999999994);  
  	ctx.bezierCurveTo(68.5,5.6,60.2,0.3,51.2,0);  
  	ctx.closePath();  
  	ctx.fill();  
  	ctx.restore();  
  }  
  
});
require.register('primitives/lightningPrimitive', function(module, exports, require) {
  var svg = require('svg')  
  	, style = require('style')  
    
  	, FILL_COLOUR = style.getDocumentStyle('.lightning', 'fill') || '#c9af16';  
    
  /**  
   * Render  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  exports.render = function (element, options) {  
  	if (options.type == 'svg') {  
  		return renderSVG(element, options);  
  	} else {  
  		return renderCanvas(element, options);  
  	}  
  };  
    
  /**  
   * Render svg version  
   * @param {DOMElement} element  
   * @param {Object} options  
   * @returns {String}  
   */  
  function renderSVG (element, options) {  
  	svg.appendChild(element, 'use', {  
  		'xlink:href': '#lightning',  
  		x: '0',  
  		y: '0',  
  		width: '100',  
  		height: '100',  
  		transform: 'translate('  
  			+ options.x  
  			+ ','  
  			+ options.y  
  			+ ')'  
  	});  
  }  
    
  /**  
   * Render canvas version  
   * @param {DOMElement} element  
   * @param {Object} options  
   */  
  function renderCanvas (element, options) {  
  	var ctx = element.getContext('2d');  
    
  	// Fill  
  	ctx.save();  
  	ctx.translate(options.x, options.y)  
  	ctx.scale(options.scale, options.scale);  
    
  	ctx.fillStyle = FILL_COLOUR;  
  	ctx.beginPath();  
  	ctx.moveTo(10.413,0);  
  	ctx.lineTo(4.163,12.484);  
  	ctx.lineTo(12.488,12.484);  
  	ctx.lineTo(0,25);  
  	ctx.lineTo(25.001,8.32);  
  	ctx.lineTo(16.663000000000004,8.32);  
  	ctx.lineTo(24.995,0);  
  	ctx.lineTo(10.413,0);  
  	ctx.closePath();  
  	ctx.fill();  
  	ctx.restore();  
  }  
  
});
require.register('weatherSymbol', function(module, exports, require) {
  // Convert with http://www.professorcloud.com/svg-to-element/
  
  var svg = require('svg')
  	, primitives = {
  			sun: require('primitives/sunPrimitive'),
  			moon: require('primitives/moonPrimitive'),
  			cloud: require('primitives/cloudPrimitive'),
  			raindrop: require('primitives/raindropPrimitive'),
  			sleet: require('primitives/sleetPrimitive'),
  			snowflake: require('primitives/snowflakePrimitive'),
  			fog: require('primitives/fogPrimitive'),
  			lightning: require('primitives/lightningPrimitive')
  		}
  	, formula = {"10":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.4},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"raindrop","x":65,"y":72},{"primitive":"raindrop","x":49,"y":72},{"primitive":"raindrop","x":33,"y":68}],"11":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.4},{"primitive":"lightning","x":14,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"raindrop","x":69,"y":72},{"primitive":"raindrop","x":53,"y":72},{"primitive":"raindrop","x":37,"y":68}],"12":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.3},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"sleet","x":55,"y":72},{"primitive":"sleet","x":39,"y":68}],"13":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.3},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"snowflake","x":54,"y":69},{"primitive":"snowflake","x":36,"y":71}],"14":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.3},{"primitive":"lightning","x":19,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"snowflake","x":62,"y":69},{"primitive":"snowflake","x":44,"y":71}],"15":[{"primitive":"fog","x":4,"y":18,"tint":0.15}],"22":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.3},{"primitive":"lightning","x":21,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"raindrop","x":60,"y":72},{"primitive":"raindrop","x":44,"y":68}],"23":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.3},{"primitive":"lightning","x":19,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"sleet","x":58,"y":72},{"primitive":"sleet","x":42,"y":68}],"30":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.15},{"primitive":"lightning","x":27,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"raindrop","x":51,"y":68}],"31":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.15},{"primitive":"lightning","x":25,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"sleet","x":48,"y":68}],"32":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.4},{"primitive":"lightning","x":15,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"sleet","x":71,"y":72},{"primitive":"sleet","x":55,"y":72},{"primitive":"sleet","x":38,"y":68}],"33":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.15},{"primitive":"lightning","x":23,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"snowflake","x":49,"y":69}],"34":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.4},{"primitive":"lightning","x":8,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"snowflake","x":70,"y":69},{"primitive":"snowflake","x":51,"y":69},{"primitive":"snowflake","x":33,"y":71}],"46":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.15},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"raindrop","x":48,"y":68}],"47":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.15},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"sleet","x":45,"y":68}],"48":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.4},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"sleet","x":67,"y":72},{"primitive":"sleet","x":50,"y":68},{"primitive":"sleet","x":33,"y":68}],"49":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.15},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"snowflake","x":43,"y":69}],"50":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.4},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"snowflake","x":63,"y":69},{"primitive":"snowflake","x":44,"y":69},{"primitive":"snowflake","x":26,"y":71}],"01d":[{"primitive":"sun","x":5,"y":5}],"02d":[{"primitive":"sun","x":5,"y":5},{"primitive":"cloud","x":8,"y":56,"scale":0.6,"flip":true,"tint":0.1}],"03d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.1}],"40d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"raindrop","x":48,"y":68}],"05d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"raindrop","x":55,"y":72},{"primitive":"raindrop","x":39,"y":68}],"41d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"raindrop","x":65,"y":72},{"primitive":"raindrop","x":49,"y":72},{"primitive":"raindrop","x":33,"y":68}],"42d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"sleet","x":45,"y":68}],"07d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"sleet","x":55,"y":72},{"primitive":"sleet","x":39,"y":68}],"43d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"sleet","x":67,"y":72},{"primitive":"sleet","x":50,"y":68},{"primitive":"sleet","x":33,"y":68}],"44d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"snowflake","x":43,"y":69}],"08d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"snowflake","x":54,"y":69},{"primitive":"snowflake","x":36,"y":71}],"45d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"snowflake","x":63,"y":69},{"primitive":"snowflake","x":44,"y":69},{"primitive":"snowflake","x":26,"y":71}],"24d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"lightning","x":27,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"raindrop","x":51,"y":68}],"06d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"lightning","x":21,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"raindrop","x":60,"y":72},{"primitive":"raindrop","x":44,"y":68}],"25d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"lightning","x":14,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"raindrop","x":69,"y":72},{"primitive":"raindrop","x":53,"y":72},{"primitive":"raindrop","x":37,"y":68}],"26d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"lightning","x":25,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"sleet","x":48,"y":68}],"20d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"lightning","x":19,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"sleet","x":58,"y":72},{"primitive":"sleet","x":42,"y":68}],"27d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"lightning","x":15,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"sleet","x":71,"y":72},{"primitive":"sleet","x":55,"y":72},{"primitive":"sleet","x":38,"y":68}],"28d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"lightning","x":23,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"snowflake","x":49,"y":69}],"21d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"lightning","x":19,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"snowflake","x":62,"y":69},{"primitive":"snowflake","x":44,"y":71}],"29d":[{"primitive":"sun","x":4,"y":7,"scale":0.6},{"primitive":"lightning","x":8,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"snowflake","x":70,"y":69},{"primitive":"snowflake","x":51,"y":69},{"primitive":"snowflake","x":33,"y":71}],"01m":[{"primitive":"sun","x":5,"y":32,"winter":true}],"02m":[{"primitive":"sun","x":5,"y":32,"winter":true},{"primitive":"cloud","x":8,"y":46,"scale":0.6,"flip":true,"tint":0.1}],"03m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"cloud","x":7,"y":22,"tint":0.1}],"40m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"raindrop","x":48,"y":68}],"05m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"raindrop","x":55,"y":72},{"primitive":"raindrop","x":39,"y":68}],"41m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"raindrop","x":65,"y":72},{"primitive":"raindrop","x":49,"y":72},{"primitive":"raindrop","x":33,"y":68}],"42m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"sleet","x":45,"y":68}],"07m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"sleet","x":55,"y":72},{"primitive":"sleet","x":39,"y":68}],"43m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"sleet","x":67,"y":72},{"primitive":"sleet","x":50,"y":68},{"primitive":"sleet","x":33,"y":68}],"44m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"snowflake","x":43,"y":69}],"08m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"snowflake","x":54,"y":69},{"primitive":"snowflake","x":36,"y":71}],"45m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"snowflake","x":63,"y":69},{"primitive":"snowflake","x":44,"y":69},{"primitive":"snowflake","x":26,"y":71}],"24m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"lightning","x":27,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"raindrop","x":51,"y":68}],"06m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"lightning","x":21,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"raindrop","x":60,"y":72},{"primitive":"raindrop","x":44,"y":68}],"25m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"lightning","x":14,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"raindrop","x":69,"y":72},{"primitive":"raindrop","x":53,"y":72},{"primitive":"raindrop","x":37,"y":68}],"26m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"lightning","x":25,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"sleet","x":48,"y":68}],"20m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"lightning","x":19,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"sleet","x":58,"y":72},{"primitive":"sleet","x":42,"y":68}],"27m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"lightning","x":15,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"sleet","x":71,"y":72},{"primitive":"sleet","x":55,"y":72},{"primitive":"sleet","x":38,"y":68}],"28m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"lightning","x":23,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"snowflake","x":49,"y":69}],"21m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"lightning","x":19,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"snowflake","x":62,"y":69},{"primitive":"snowflake","x":44,"y":71}],"29m":[{"primitive":"sun","x":8,"y":20,"scale":0.6,"winter":true},{"primitive":"lightning","x":8,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"snowflake","x":70,"y":69},{"primitive":"snowflake","x":51,"y":69},{"primitive":"snowflake","x":33,"y":71}],"01n":[{"primitive":"moon","x":20,"y":20}],"02n":[{"primitive":"moon","x":20,"y":20},{"primitive":"cloud","x":8,"y":56,"scale":0.6,"flip":true,"tint":0.1}],"03n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.1}],"40n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"raindrop","x":48,"y":68}],"05n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"raindrop","x":55,"y":72},{"primitive":"raindrop","x":39,"y":68}],"41n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"raindrop","x":65,"y":72},{"primitive":"raindrop","x":49,"y":72},{"primitive":"raindrop","x":33,"y":68}],"42n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"sleet","x":45,"y":68}],"07n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"sleet","x":55,"y":72},{"primitive":"sleet","x":39,"y":68}],"43n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"sleet","x":67,"y":72},{"primitive":"sleet","x":50,"y":68},{"primitive":"sleet","x":33,"y":68}],"44n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"snowflake","x":43,"y":69}],"08n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"snowflake","x":54,"y":69},{"primitive":"snowflake","x":36,"y":71}],"45n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"snowflake","x":63,"y":69},{"primitive":"snowflake","x":44,"y":69},{"primitive":"snowflake","x":26,"y":71}],"24n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"lightning","x":27,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"raindrop","x":51,"y":68}],"06n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"lightning","x":21,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"raindrop","x":60,"y":72},{"primitive":"raindrop","x":44,"y":68}],"25n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"lightning","x":14,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"raindrop","x":69,"y":72},{"primitive":"raindrop","x":53,"y":72},{"primitive":"raindrop","x":37,"y":68}],"26n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"lightning","x":25,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"sleet","x":48,"y":68}],"20n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"lightning","x":19,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"sleet","x":58,"y":72},{"primitive":"sleet","x":42,"y":68}],"27n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"lightning","x":15,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"sleet","x":71,"y":72},{"primitive":"sleet","x":55,"y":72},{"primitive":"sleet","x":38,"y":68}],"28n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"lightning","x":23,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.3},{"primitive":"snowflake","x":49,"y":69}],"21n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"lightning","x":19,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"snowflake","x":62,"y":69},{"primitive":"snowflake","x":44,"y":71}],"29n":[{"primitive":"moon","x":18,"y":13,"scale":0.6},{"primitive":"lightning","x":8,"y":75},{"primitive":"cloud","x":7,"y":22,"tint":0.5},{"primitive":"snowflake","x":70,"y":69},{"primitive":"snowflake","x":51,"y":69},{"primitive":"snowflake","x":33,"y":71}],"04":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.1},{"primitive":"cloud","x":7,"y":22,"tint":0.15}],"09":[{"primitive":"cloud","x":5,"y":10,"scale":0.8,"flip":true,"tint":0.3},{"primitive":"cloud","x":7,"y":22,"tint":0.4},{"primitive":"raindrop","x":55,"y":72},{"primitive":"raindrop","x":39,"y":68}]}
  
  	, DEFAULT_BG = '#ffffff'
  	, SVG = 'svg'
  	, CANVAS = 'canvas'
  	, IMG = 'img';
  
  module.exports = function (container, options) {
  	if (!container) return;
  
  	options = options || {};
  	var type = options.svg
  				? SVG
  				: (options.canvas
  					? CANVAS
  					: IMG)
  		, element = createElement(type)
  		, id = container.getAttribute('data-id').split('.')[0]
  		, w = container.offsetWidth
  		, h = container.offsetHeight
  		, scale = options.scale || 1
  		, tScale = (type == CANVAS) ? (w/100) * scale : 1
  		, bg = getStyle(container, 'background-color') || DEFAULT_BG
  		, f = formula[id]
  		, layer, opts;
  
  	if (type == SVG || type == CANVAS) {
  		if (type == CANVAS) {
  			if (w != 0) {
  				element.width = w * scale;
  				element.height = h * scale;
  			}
  		}
  
  		if (f) {
  			for (var i = 0, n = f.length; i < n; i++) {
  				layer = f[i];
  				opts = {
  					type: type,
  					x: Math.round(layer.x * tScale),
  					y: Math.round(layer.y * tScale),
  					scale: (layer.scale || 1) * tScale,
  					small: layer.small,
  					flip: layer.flip,
  					tint: layer.tint,
  					winter: layer.winter,
  					width: w * scale,
  					height: h * scale,
  					bg: bg
  				};
  
  				primitives[layer.primitive].render(element, opts);
  			}
  		}
  	}
  
  	container.appendChild(element);
  };
  
  function getStyle (element, prop) {
  	return window.getComputedStyle(element).getPropertyValue(prop);
  }
  
  function createElement (type) {
  	var el;
  
  	if (type == SVG) {
  		el = document.createElementNS(svg.NS, type);
  		el.setAttribute('x', '0px');
  		el.setAttribute('y', '0px');
  		el.setAttribute('viewBox', '0 0 100 100');
  	} else {
  		el = document.createElement(type);
  	}
  
  	return el;
  }
});
require.register('lodash._baseindexof', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  
  /**
   * The base implementation of `_.indexOf` without support for binary searches
   * or `fromIndex` constraints.
   *
   * @private
   * @param {Array} array The array to search.
   * @param {*} value The value to search for.
   * @param {number} [fromIndex=0] The index to search from.
   * @returns {number} Returns the index of the matched value or `-1`.
   */
  function baseIndexOf(array, value, fromIndex) {
    var index = (fromIndex || 0) - 1,
        length = array ? array.length : 0;
  
    while (++index < length) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }
  
  module.exports = baseIndexOf;
  
});
require.register('lodash.sortedindex', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var createCallback = require('lodash.createcallback'),
      identity = require('lodash.identity');
  
  /**
   * Uses a binary search to determine the smallest index at which a value
   * should be inserted into a given sorted array in order to maintain the sort
   * order of the array. If a callback is provided it will be executed for
   * `value` and each element of `array` to compute their sort ranking. The
   * callback is bound to `thisArg` and invoked with one argument; (value).
   *
   * If a property name is provided for `callback` the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is provided for `callback` the created "_.where" style callback
   * will return `true` for elements that have the properties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to inspect.
   * @param {*} value The value to evaluate.
   * @param {Function|Object|string} [callback=identity] The function called
   *  per iteration. If a property name or object is provided it will be used
   *  to create a "_.pluck" or "_.where" style callback, respectively.
   * @param {*} [thisArg] The `this` binding of `callback`.
   * @returns {number} Returns the index at which `value` should be inserted
   *  into `array`.
   * @example
   *
   * _.sortedIndex([20, 30, 50], 40);
   * // => 2
   *
   * // using "_.pluck" callback shorthand
   * _.sortedIndex([{ 'x': 20 }, { 'x': 30 }, { 'x': 50 }], { 'x': 40 }, 'x');
   * // => 2
   *
   * var dict = {
   *   'wordToNumber': { 'twenty': 20, 'thirty': 30, 'fourty': 40, 'fifty': 50 }
   * };
   *
   * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
   *   return dict.wordToNumber[word];
   * });
   * // => 2
   *
   * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
   *   return this.wordToNumber[word];
   * }, dict);
   * // => 2
   */
  function sortedIndex(array, value, callback, thisArg) {
    var low = 0,
        high = array ? array.length : low;
  
    // explicitly reference `identity` for better inlining in Firefox
    callback = callback ? createCallback(callback, thisArg, 1) : identity;
    value = callback(value);
  
    while (low < high) {
      var mid = (low + high) >>> 1;
      (callback(array[mid]) < value)
        ? low = mid + 1
        : high = mid;
    }
    return low;
  }
  
  module.exports = sortedIndex;
  
});
require.register('lodash.indexof', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var baseIndexOf = require('lodash._baseindexof'),
      sortedIndex = require('lodash.sortedindex');
  
  /* Native method shortcuts for methods with the same name as other `lodash` methods */
  var nativeMax = Math.max;
  
  /**
   * Gets the index at which the first occurrence of `value` is found using
   * strict equality for comparisons, i.e. `===`. If the array is already sorted
   * providing `true` for `fromIndex` will run a faster binary search.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to search.
   * @param {*} value The value to search for.
   * @param {boolean|number} [fromIndex=0] The index to search from or `true`
   *  to perform a binary search on a sorted array.
   * @returns {number} Returns the index of the matched value or `-1`.
   * @example
   *
   * _.indexOf([1, 2, 3, 1, 2, 3], 2);
   * // => 1
   *
   * _.indexOf([1, 2, 3, 1, 2, 3], 2, 3);
   * // => 4
   *
   * _.indexOf([1, 1, 2, 2, 3, 3], 2, true);
   * // => 2
   */
  function indexOf(array, value, fromIndex) {
    if (typeof fromIndex == 'number') {
      var length = array ? array.length : 0;
      fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex || 0);
    } else if (fromIndex) {
      var index = sortedIndex(array, value);
      return array[index] === value ? index : -1;
    }
    return baseIndexOf(array, value, fromIndex);
  }
  
  module.exports = indexOf;
  
});
require.register('classlist', function(module, exports, require) {
  var indexOf = require('lodash.indexof')
  	, useNative = document.documentElement.classList != null;
  
  var RE_TRIM = /^\s+|\s+$/g;
  
  /**
   * Check if 'element' has class 'clas'
   * @param {Element} element
   * @param {String} clas
   * @return {Boolean}
   */
  exports.hasClass = function(element, clas) {
  	if (useNative) {
  		return element.classList.contains(clas);
  	} else {
  		var classes = element.className.replace(RE_TRIM, '').split(' ');
  		return indexOf(classes, clas) >= 0;
  	}
  };
  
  /**
   * Check if 'element' has a class matching 'pattern'
   * @param {Element} element
   * @param {String} pattern
   * @return {String}
   */
  exports.matchClass = function(element, pattern) {
  	var classes = element.className.replace(RE_TRIM, '').split(' ')
  		, clas;
  	for (var i = 0, n = classes.length; i < n; i++) {
  		clas = classes[i];
  		if (clas.indexOf(pattern) !== -1) {
  			return clas;
  		}
  	}
  	return '';
  };
  
  /**
   * Add class 'clas' to 'element'
   * @param {Element} element
   * @param {String} clas
   */
  exports.addClass = function(element, clas) {
  	if (useNative) {
  		element.classList.add(clas);
  	} else {
  		element.className += ' ' + clas;
  	}
  };
  
  /**
   * Remove class 'clas' from 'element'
   * @param {Element} element
   * @param {String} clas
   */
  exports.removeClass = function(element, clas) {
  	var c, classes;
  	if (clas) {
  		if (useNative) {
  			element.classList.remove(clas);
  		} else {
  			var classes = element.className.replace(RE_TRIM, '').split(' ')
  				, results = [];
  			for (var i = 0, n = classes.length; i < n; i++) {
  				if (classes[i] !== clas) results.push(classes[i]);
  			}
  			element.className = results.join(' ');
  		}
  	}
  };
  
  /**
   * Toggle class 'clas' on 'element'
   * @param {Element} element
   * @param {String} clas
   */
  exports.toggleClass = function(element, clas) {
  	if (exports.hasClass(element, clas)) {
  		exports.removeClass(element, clas);
  	} else {
  		exports.addClass(element, clas);
  	}
  };
  
  /**
   * Replace class 'clasOld' with 'clasNew' on 'element'
   * @param {Element} element
   * @param {String} clas
   */
  exports.replaceClass = function(element, clasOld, clasNew) {
  	if (clasOld) {
  		if (clasNew) {
  			element.className = element.className.replace(clasOld, clasNew);
  		} else {
  			exports.removeClass(element, clasOld);
  		}
  	} else if (clasNew) {
  		exports.addClass(element, clasNew);
  	}
  };
  
  /**
   * Add class 'clas' to 'element', and remove after 'duration' milliseconds
   * @param {Element} element
   * @param {String} clas
   * @param {Number} duration
   */
  exports.addTemporaryClass = function(element, clas, duration) {
  	exports.addClass(element, clas);
  	setTimeout((function() {
  		exports.removeClass(element, clas);
  	}), duration);
  };
  
});
require.register('lodash.foreach', function(module, exports, require) {
  /**
   * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
   * Build: `lodash modularize modern exports="npm" -o ./npm/`
   * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <http://lodash.com/license>
   */
  var baseCreateCallback = require('lodash._basecreatecallback'),
      forOwn = require('lodash.forown');
  
  /**
   * Iterates over elements of a collection, executing the callback for each
   * element. The callback is bound to `thisArg` and invoked with three arguments;
   * (value, index|key, collection). Callbacks may exit iteration early by
   * explicitly returning `false`.
   *
   * Note: As with other "Collections" methods, objects with a `length` property
   * are iterated like arrays. To avoid this behavior `_.forIn` or `_.forOwn`
   * may be used for object iteration.
   *
   * @static
   * @memberOf _
   * @alias each
   * @category Collections
   * @param {Array|Object|string} collection The collection to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {*} [thisArg] The `this` binding of `callback`.
   * @returns {Array|Object|string} Returns `collection`.
   * @example
   *
   * _([1, 2, 3]).forEach(function(num) { console.log(num); }).join(',');
   * // => logs each number and returns '1,2,3'
   *
   * _.forEach({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { console.log(num); });
   * // => logs each number and returns the object (property order is not guaranteed across environments)
   */
  function forEach(collection, callback, thisArg) {
    var index = -1,
        length = collection ? collection.length : 0;
  
    callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
    if (typeof length == 'number') {
      while (++index < length) {
        if (callback(collection[index], index, collection) === false) {
          break;
        }
      }
    } else {
      forOwn(collection, callback);
    }
    return collection;
  }
  
  module.exports = forEach;
  
});
require.register('main', function(module, exports, require) {
  window.global = window;
  
  var dust = require('dust')
  	, data = {"symbols":[{"title":"clear","variations":[{"id":"01d"},{"id":"01m"},{"id":"01n"}]},{"title":"fair","variations":[{"id":"02d"},{"id":"02m"},{"id":"02n"}]},{"title":"partly cloudy","variations":[{"id":"03d"},{"id":"03m"},{"id":"03n"}]},{"title":"cloudy","variations":[{"id":"04"}]},{"title":"light rain showers","variations":[{"id":"40d"},{"id":"40m"},{"id":"40n"}]},{"title":"rain showers","variations":[{"id":"05d"},{"id":"05m"},{"id":"05n"}]},{"title":"heavy rain showers","variations":[{"id":"41d"},{"id":"41m"},{"id":"41n"}]},{"title":"light sleet showers","variations":[{"id":"42d"},{"id":"42m"},{"id":"42n"}]},{"title":"sleet showers","variations":[{"id":"07d"},{"id":"07m"},{"id":"07n"}]},{"title":"heavy sleet showers","variations":[{"id":"43d"},{"id":"43m"},{"id":"43n"}]},{"title":"light snow showers","variations":[{"id":"44d"},{"id":"44m"},{"id":"44n"}]},{"title":"snow showers","variations":[{"id":"08d"},{"id":"08m"},{"id":"08n"}]},{"title":"heavy snow showers","variations":[{"id":"45d"},{"id":"45m"},{"id":"45n"}]},{"title":"light rain","variations":[{"id":"46"}]},{"title":"rain","variations":[{"id":"09"}]},{"title":"heavy rain","variations":[{"id":"10"}]},{"title":"light sleet","variations":[{"id":"47"}]},{"title":"sleet","variations":[{"id":"12"}]},{"title":"heavy sleet","variations":[{"id":"48"}]},{"title":"light snow","variations":[{"id":"49"}]},{"title":"snow","variations":[{"id":"13"}]},{"title":"heavy snow","variations":[{"id":"50"}]},{"title":"fog","variations":[{"id":"15"}]},{"title":"light rain showers with thunder","variations":[{"id":"24d"},{"id":"24m"},{"id":"24n"}]},{"title":"rain showers with thunder","variations":[{"id":"06d"},{"id":"06m"},{"id":"06n"}]},{"title":"heavy rain showers with thunder","variations":[{"id":"25d"},{"id":"25m"},{"id":"25n"}]},{"title":"light sleet showers with thunder","variations":[{"id":"26d"},{"id":"26m"},{"id":"26n"}]},{"title":"sleet showers with thunder","variations":[{"id":"20d"},{"id":"20m"},{"id":"20n"}]},{"title":"heavy sleet showers with thunder","variations":[{"id":"27d"},{"id":"27m"},{"id":"27n"}]},{"title":"light snow showers with thunder","variations":[{"id":"28d"},{"id":"28m"},{"id":"28n"}]},{"title":"snow showers with thunder","variations":[{"id":"21d"},{"id":"21m"},{"id":"21n"}]},{"title":"heavy snow showers with thunder","variations":[{"id":"29d"},{"id":"29m"},{"id":"29n"}]},{"title":"light rain with thunder","variations":[{"id":"30"}]},{"title":"rain with thunder","variations":[{"id":"22"}]},{"title":"heavy rain with thunder","variations":[{"id":"11"}]},{"title":"light sleet with thunder","variations":[{"id":"31"}]},{"title":"sleet with thunder","variations":[{"id":"23"}]},{"title":"heavy sleet with thunder","variations":[{"id":"32"}]},{"title":"light snow with thunder","variations":[{"id":"33"}]},{"title":"snow with thunder","variations":[{"id":"14"}]},{"title":"heavy snow with thunder","variations":[{"id":"34"}]}]}
  	, template = require('symbolGroup')
  	, weatherSymbol = require('weatherSymbol')
  	, classList = require('classlist')
  	, forEach = require('lodash.foreach')
  	, el = document.getElementById('symbols')
  	, slice = Array.prototype.slice;
  
  // Render template
  dust.render('symbolGroup', data, function(err, html) {
  	if (err) {
  		console.log(err);
  	} else {
  		el.innerHTML = html;
  	}
  });
  
  // Draw canvas symbols
  forEach(document.querySelectorAll('figure'), function (el) {
  	var symbol = el.querySelector('.symbol')
  		, options = {};
  
  	if (classList.hasClass(el, 'svg')) {
  		options.svg = true;
  	} else if (classList.hasClass(el, 'canvas')) {
  		options.canvas = true;
  	} else if (classList.hasClass(el, 'img')) {
  		options.img = true;
  	}
  
  	weatherSymbol(symbol, options);
  });
});
require('main');