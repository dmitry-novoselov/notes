/**
 * Modules
 *
 * Copyright (c) 2013 Filatov Dmitry (dfilatov@yandex-team.ru)
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 * @version 0.1.2
 */

(function(global) {

var undef,

    DECL_STATES = {
        NOT_RESOLVED : 'NOT_RESOLVED',
        IN_RESOLVING : 'IN_RESOLVING',
        RESOLVED     : 'RESOLVED'
    },

    /**
     * Creates a new instance of modular system
     * @returns {Object}
     */
    create = function() {
        var curOptions = {
                trackCircularDependencies : true,
                allowMultipleDeclarations : true
            },

            modulesStorage = {},
            waitForNextTick = false,
            pendingRequires = [],

            /**
             * Defines module
             * @param {String} name
             * @param {String[]} [deps]
             * @param {Function} declFn
             */
            define = function(name, deps, declFn) {
                if(!declFn) {
                    declFn = deps;
                    deps = [];
                }

                var module = modulesStorage[name];
                if(!module) {
                    module = modulesStorage[name] = {
                        name : name,
                        decl : undef
                    };
                }

                module.decl = {
                    name       : name,
                    prev       : module.decl,
                    fn         : declFn,
                    state      : DECL_STATES.NOT_RESOLVED,
                    deps       : deps,
                    dependents : [],
                    exports    : undef
                };
            },

            /**
             * Requires modules
             * @param {String|String[]} modules
             * @param {Function} cb
             * @param {Function} [errorCb]
             */
            require = function(modules, cb, errorCb) {
                if(typeof modules === 'string') {
                    modules = [modules];
                }

                if(!waitForNextTick) {
                    waitForNextTick = true;
                    nextTick(onNextTick);
                }

                pendingRequires.push({
                    deps : modules,
                    cb   : function(exports, error) {
                        error?
                            (errorCb || onError)(error) :
                            cb.apply(global, exports);
                    }
                });
            },

            /**
             * Returns state of module
             * @param {String} name
             * @returns {String} state, possible values are NOT_DEFINED, NOT_RESOLVED, IN_RESOLVING, RESOLVED
             */
            getState = function(name) {
                var module = modulesStorage[name];
                return module?
                    DECL_STATES[module.decl.state] :
                    'NOT_DEFINED';
            },

            /**
             * Returns whether the module is defined
             * @param {String} name
             * @returns {Boolean}
             */
            isDefined = function(name) {
                return !!modulesStorage[name];
            },

            /**
             * Sets options
             * @param {Object} options
             */
            setOptions = function(options) {
                for(var name in options) {
                    if(options.hasOwnProperty(name)) {
                        curOptions[name] = options[name];
                    }
                }
            },

            getStat = function() {
                var res = {},
                    module;

                for(var name in modulesStorage) {
                    if(modulesStorage.hasOwnProperty(name)) {
                        module = modulesStorage[name];
                        (res[module.decl.state] || (res[module.decl.state] = [])).push(name);
                    }
                }

                return res;
            },

            onNextTick = function() {
                waitForNextTick = false;
                applyRequires();
            },

            applyRequires = function() {
                var requiresToProcess = pendingRequires,
                    i = 0, require;

                pendingRequires = [];

                while(require = requiresToProcess[i++]) {
                    requireDeps(null, require.deps, [], require.cb);
                }
            },

            requireDeps = function(fromDecl, deps, path, cb) {
                var unresolvedDepsCnt = deps.length;
                if(!unresolvedDepsCnt) {
                    cb([]);
                }

                var decls = [],
                    onDeclResolved = function(_, error) {
                        if(error) {
                            cb(null, error);
                            return;
                        }

                        if(!--unresolvedDepsCnt) {
                            var exports = [],
                                i = 0, decl;
                            while(decl = decls[i++]) {
                                exports.push(decl.exports);
                            }
                            cb(exports);
                        }
                    },
                    i = 0, len = unresolvedDepsCnt,
                    dep, decl;

                while(i < len) {
                    dep = deps[i++];
                    if(typeof dep === 'string') {
                        if(!modulesStorage[dep]) {
                            cb(null, buildModuleNotFoundError(dep, fromDecl));
                            return;
                        }

                        decl = modulesStorage[dep].decl;
                    }
                    else {
                        decl = dep;
                    }

                    decls.push(decl);

                    startDeclResolving(decl, path, onDeclResolved);
                }
            },

            startDeclResolving = function(decl, path, cb) {
                if(decl.state === DECL_STATES.RESOLVED) {
                    cb(decl.exports);
                    return;
                }
                else if(decl.state === DECL_STATES.IN_RESOLVING) {
                    curOptions.trackCircularDependencies && isDependenceCircular(decl, path)?
                        cb(null, buildCircularDependenceError(decl, path)) :
                        decl.dependents.push(cb);
                    return;
                }

                decl.dependents.push(cb);

                if(decl.prev && !curOptions.allowMultipleDeclarations) {
                    provideError(decl, buildMultipleDeclarationError(decl));
                    return;
                }

                curOptions.trackCircularDependencies && (path = path.slice()).push(decl);

                var isProvided = false,
                    deps = decl.prev? decl.deps.concat([decl.prev]) : decl.deps;

                decl.state = DECL_STATES.IN_RESOLVING;
                requireDeps(
                    decl,
                    deps,
                    path,
                    function(depDeclsExports, error) {
                        if(error) {
                            provideError(decl, error);
                            return;
                        }

                        depDeclsExports.unshift(function(exports, error) {
                            if(isProvided) {
                                cb(null, buildDeclAreadyProvidedError(decl));
                                return;
                            }

                            isProvided = true;
                            error?
                                provideError(decl, error) :
                                provideDecl(decl, exports);
                        });

                        decl.fn.apply(
                            {
                                name   : decl.name,
                                deps   : decl.deps,
                                global : global
                            },
                            depDeclsExports);
                    });
            },

            provideDecl = function(decl, exports) {
                decl.exports = exports;
                decl.state = DECL_STATES.RESOLVED;

                var i = 0, dependent;
                while(dependent = decl.dependents[i++]) {
                    dependent(exports);
                }

                decl.dependents = undef;
            },

            provideError = function(decl, error) {
                decl.state = DECL_STATES.NOT_RESOLVED;

                var i = 0, dependent;
                while(dependent = decl.dependents[i++]) {
                    dependent(null, error);
                }

                decl.dependents = [];
            };

        return {
            create     : create,
            define     : define,
            require    : require,
            getState   : getState,
            isDefined  : isDefined,
            setOptions : setOptions,
            getStat    : getStat
        };
    },

    onError = function(e) {
        nextTick(function() {
            throw e;
        });
    },

    buildModuleNotFoundError = function(name, decl) {
        return Error(decl?
            'Module "' + decl.name + '": can\'t resolve dependence "' + name + '"' :
            'Required module "' + name + '" can\'t be resolved');
    },

    buildCircularDependenceError = function(decl, path) {
        var strPath = [],
            i = 0, pathDecl;
        while(pathDecl = path[i++]) {
            strPath.push(pathDecl.name);
        }
        strPath.push(decl.name);

        return Error('Circular dependence has been detected: "' + strPath.join(' -> ') + '"');
    },

    buildDeclAreadyProvidedError = function(decl) {
        return Error('Declaration of module "' + decl.name + '" has already been provided');
    },

    buildMultipleDeclarationError = function(decl) {
        return Error('Multiple declarations of module "' + decl.name + '" have been detected');
    },

    isDependenceCircular = function(decl, path) {
        var i = 0, pathDecl;
        while(pathDecl = path[i++]) {
            if(decl === pathDecl) {
                return true;
            }
        }
        return false;
    },

    nextTick = (function() {
        var fns = [],
            enqueueFn = function(fn) {
                return fns.push(fn) === 1;
            },
            callFns = function() {
                var fnsToCall = fns, i = 0, len = fns.length;
                fns = [];
                while(i < len) {
                    fnsToCall[i++]();
                }
            };

        if(typeof process === 'object' && process.nextTick) { // nodejs
            return function(fn) {
                enqueueFn(fn) && process.nextTick(callFns);
            };
        }

        if(global.setImmediate) { // ie10
            return function(fn) {
                enqueueFn(fn) && global.setImmediate(callFns);
            };
        }

        if(global.postMessage && !global.opera) { // modern browsers
            var isPostMessageAsync = true;
            if(global.attachEvent) {
                var checkAsync = function() {
                        isPostMessageAsync = false;
                    };
                global.attachEvent('onmessage', checkAsync);
                global.postMessage('__checkAsync', '*');
                global.detachEvent('onmessage', checkAsync);
            }

            if(isPostMessageAsync) {
                var msg = '__modules' + (+new Date()),
                    onMessage = function(e) {
                        if(e.data === msg) {
                            e.stopPropagation && e.stopPropagation();
                            callFns();
                        }
                    };

                global.addEventListener?
                    global.addEventListener('message', onMessage, true) :
                    global.attachEvent('onmessage', onMessage);

                return function(fn) {
                    enqueueFn(fn) && global.postMessage(msg, '*');
                };
            }
        }

        var doc = global.document;
        if('onreadystatechange' in doc.createElement('script')) { // ie6-ie8
            var head = doc.getElementsByTagName('head')[0],
                createScript = function() {
                    var script = doc.createElement('script');
                    script.onreadystatechange = function() {
                        script.parentNode.removeChild(script);
                        script = script.onreadystatechange = null;
                        callFns();
                    };
                    head.appendChild(script);
                };

            return function(fn) {
                enqueueFn(fn) && createScript();
            };
        }

        return function(fn) { // old browsers
            enqueueFn(fn) && setTimeout(callFns, 0);
        };
    })();

if(typeof exports === 'object') {
    module.exports = create();
}
else {
    global.modules = create();
}

})(typeof window !== 'undefined' ? window : global);

/* begin: ../../common.blocks/cookie/cookie.js */
/**
 * @module cookie
 * @description Inspired from $.cookie plugin by Klaus Hartl (stilbuero.de)
 */

modules.define('cookie', function(provide) {

provide(/** @exports */{
    /**
     * Returns cookie by given name
     * @param {String} name
     * @returns {String|null}
     */
    get : function(name) {
        var res = null;
        if(document.cookie && document.cookie !== '') {
            var cookies = document.cookie.split(';');
            for(var i = 0; i < cookies.length; i++) {
                var cookie = cookies[i].trim();
                // Does this cookie string begin with the name we want?
                if(cookie.substring(0, name.length + 1) === (name + '=')) {
                    res = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return res;
    },

    /**
     * Sets cookie by given name
     * @param {String} name
     * @param {String} val
     * @param {Object} options
     * @returns {cookie} this
     */
    set : function(name, val, options) {
        options = options || {};
        if(val === null) {
            val = '';
            options.expires = -1;
        }
        var expires = '';
        if(options.expires && (typeof options.expires === 'number' || options.expires.toUTCString)) {
            var date;
            if(typeof options.expires === 'number') {
                date = new Date();
                date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
            } else {
                date = options.expires;
            }
            expires = '; expires=' + date.toUTCString(); // use expires attribute, max-age is not supported by IE
        }
        // CAUTION: Needed to parenthesize options.path and options.domain
        // in the following expressions, otherwise they evaluate to undefined
        // in the packed version for some reason...
        var path = options.path? '; path=' + (options.path) : '',
            domain = options.domain? '; domain=' + (options.domain) : '',
            secure = options.secure? '; secure' : '';
        document.cookie = [name, '=', encodeURIComponent(val), expires, path, domain, secure].join('');

        return this;
    }
});

});

/* end: ../../common.blocks/cookie/cookie.js */
/* begin: ../../common.blocks/dom/dom.js */
/**
 * @module dom
 * @description some DOM utils
 */

modules.define('dom', ['jquery'], function(provide, $) {

provide(/** @exports */{
    /**
     * Checks whether a DOM elem is in a context
     * @param {jQuery} ctx DOM elem where check is being performed
     * @param {jQuery} domElem DOM elem to check
     * @returns {Boolean}
     */
    contains : function(ctx, domElem) {
        var res = false;

        domElem.each(function() {
            var domNode = this;
            do {
                if(~ctx.index(domNode)) return !(res = true);
            } while(domNode = domNode.parentNode);

            return res;
        });

        return res;
    },

    /**
     * Returns current focused DOM elem in document
     * @returns {jQuery}
     */
    getFocused : function() {
        // "Error: Unspecified error." in iframe in IE9
        try { return $(document.activeElement); } catch(e) {}
    },

    /**
     * Checks whether a DOM element contains focus
     * @param {jQuery} domElem
     * @returns {Boolean}
     */
    containsFocus : function(domElem) {
        return this.contains(domElem, this.getFocused());
    },

    /**
    * Checks whether a browser currently can set focus on DOM elem
    * @param {jQuery} domElem
    * @returns {Boolean}
    */
    isFocusable : function(domElem) {
        var domNode = domElem[0];

        if(!domNode) return false;
        if(domNode.hasAttribute('tabindex')) return true;

        switch(domNode.tagName.toLowerCase()) {
            case 'iframe':
                return true;

            case 'input':
            case 'button':
            case 'textarea':
            case 'select':
                return !domNode.disabled;

            case 'a':
                return !!domNode.href;
        }

        return false;
    },

    /**
    * Checks whether a domElem is intended to edit text
    * @param {jQuery} domElem
    * @returns {Boolean}
    */
    isEditable : function(domElem) {
        var domNode = domElem[0];

        if(!domNode) return false;

        switch(domNode.tagName.toLowerCase()) {
            case 'input':
                var type = domNode.type;
                return (type === 'text' || type === 'password') && !domNode.disabled && !domNode.readOnly;

            case 'textarea':
                return !domNode.disabled && !domNode.readOnly;

            default:
                return domNode.contentEditable === 'true';
        }
    }
});

});

/* end: ../../common.blocks/dom/dom.js */
/* begin: ../../common.blocks/jquery/jquery.js */
/**
 * @module jquery
 * @description Provide jQuery (load if it does not exist).
 */

modules.define(
    'jquery',
    ['loader_type_js', 'jquery__config'],
    function(provide, loader, cfg) {

/* global jQuery */

function doProvide(preserveGlobal) {
    /**
     * @exports
     * @type Function
     */
    provide(preserveGlobal? jQuery : jQuery.noConflict(true));
}

typeof jQuery !== 'undefined'?
    doProvide(true) :
    loader(cfg.url, doProvide);
});

/* end: ../../common.blocks/jquery/jquery.js */
/* begin: ../../common.blocks/jquery/__config/jquery__config.js */
/**
 * @module jquery__config
 * @description Configuration for jQuery
 */

modules.define('jquery__config', function(provide) {

provide(/** @exports */{
    /**
     * URL for loading jQuery if it does not exist
     * @type {String}
     */
    url : 'https://yastatic.net/jquery/2.2.3/jquery.min.js'
});

});

/* end: ../../common.blocks/jquery/__config/jquery__config.js */
/* begin: ../../desktop.blocks/jquery/__config/jquery__config.js */
/**
 * @module jquery__config
 * @description Configuration for jQuery
 */

modules.define(
    'jquery__config',
    ['ua', 'objects'],
    function(provide, ua, objects, base) {

provide(
    ua.msie && parseInt(ua.version, 10) < 9?
        objects.extend(
            base,
            {
                url : 'https://yastatic.net/jquery/1.12.3/jquery.min.js'
            }) :
        base);

});

/* end: ../../desktop.blocks/jquery/__config/jquery__config.js */
/* begin: ../../desktop.blocks/ua/ua.js */
/**
 * @module ua
 * @description Detect some user agent features (works like jQuery.browser in jQuery 1.8)
 * @see http://code.jquery.com/jquery-migrate-1.1.1.js
 */

modules.define('ua', function(provide) {

var ua = navigator.userAgent.toLowerCase(),
    match = /(chrome)[ \/]([\w.]+)/.exec(ua) ||
        /(webkit)[ \/]([\w.]+)/.exec(ua) ||
        /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) ||
        /(msie) ([\w.]+)/.exec(ua) ||
        ua.indexOf('compatible') < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
        [],
    matched = {
        browser : match[1] || '',
        version : match[2] || '0'
    },
    browser = {};

if(matched.browser) {
    browser[matched.browser] = true;
    browser.version = matched.version;
}

if(browser.chrome) {
    browser.webkit = true;
} else if(browser.webkit) {
    browser.safari = true;
}

/**
 * @exports
 * @type Object
 */
provide(browser);

});

/* end: ../../desktop.blocks/ua/ua.js */
/* begin: ../../common.blocks/objects/objects.vanilla.js */
/**
 * @module objects
 * @description A set of helpers to work with JavaScript objects
 */

modules.define('objects', function(provide) {

var hasOwnProp = Object.prototype.hasOwnProperty;

provide(/** @exports */{
    /**
     * Extends a given target by
     * @param {Object} target object to extend
     * @param {Object} source
     * @returns {Object}
     */
    extend : function(target, source) {
        (typeof target !== 'object' || target === null) && (target = {});

        for(var i = 1, len = arguments.length; i < len; i++) {
            var obj = arguments[i];
            if(obj) {
                for(var key in obj) {
                    hasOwnProp.call(obj, key) && (target[key] = obj[key]);
                }
            }
        }

        return target;
    },

    /**
     * Check whether a given object is empty (contains no enumerable properties)
     * @param {Object} obj
     * @returns {Boolean}
     */
    isEmpty : function(obj) {
        for(var key in obj) {
            if(hasOwnProp.call(obj, key)) {
                return false;
            }
        }

        return true;
    },

    /**
     * Generic iterator function over object
     * @param {Object} obj object to iterate
     * @param {Function} fn callback
     * @param {Object} [ctx] callbacks's context
     */
    each : function(obj, fn, ctx) {
        for(var key in obj) {
            if(hasOwnProp.call(obj, key)) {
                ctx? fn.call(ctx, obj[key], key) : fn(obj[key], key);
            }
        }
    }
});

});

/* end: ../../common.blocks/objects/objects.vanilla.js */
/* begin: ../../common.blocks/events/events.vanilla.js */
/**
 * @module events
 */

modules.define(
    'events',
    ['identify', 'inherit', 'functions'],
    function(provide, identify, inherit, functions) {

var undef,
    storageExpando = '__' + (+new Date) + 'storage',
    getFnId = function(fn, ctx) {
        return identify(fn) + (ctx? identify(ctx) : '');
    },

    /**
     * @class Event
     * @exports events:Event
     */
    Event = inherit(/** @lends Event.prototype */{
        /**
         * @constructor
         * @param {String} type
         * @param {Object} target
         */
        __constructor : function(type, target) {
            /**
             * Type
             * @member {String}
             */
            this.type = type;

            /**
             * Target
             * @member {Object}
             */
            this.target = target;

            /**
             * Result
             * @member {*}
             */
            this.result = undef;

            /**
             * Data
             * @member {*}
             */
            this.data = undef;

            this._isDefaultPrevented = false;
            this._isPropagationStopped = false;
        },

        /**
         * Prevents default action
         */
        preventDefault : function() {
            this._isDefaultPrevented = true;
        },

        /**
         * Returns whether is default action prevented
         * @returns {Boolean}
         */
        isDefaultPrevented : function() {
            return this._isDefaultPrevented;
        },

        /**
         * Stops propagation
         */
        stopPropagation : function() {
            this._isPropagationStopped = true;
        },

        /**
         * Returns whether is propagation stopped
         * @returns {Boolean}
         */
        isPropagationStopped : function() {
            return this._isPropagationStopped;
        }
    }),

    /**
     * @lends Emitter
     * @lends Emitter.prototype
     */
    EmitterProps = {
        /**
         * Adds an event handler
         * @param {String} e Event type
         * @param {Object} [data] Additional data that the handler gets as e.data
         * @param {Function} fn Handler
         * @param {Object} [ctx] Handler context
         * @returns {Emitter} this
         */
        on : function(e, data, fn, ctx, _special) {
            if(typeof e === 'string') {
                if(functions.isFunction(data)) {
                    ctx = fn;
                    fn = data;
                    data = undef;
                }

                var id = getFnId(fn, ctx),
                    storage = this[storageExpando] || (this[storageExpando] = {}),
                    eventTypes = e.split(' '), eventType,
                    i = 0, list, item,
                    eventStorage;

                while(eventType = eventTypes[i++]) {
                    eventStorage = storage[eventType] || (storage[eventType] = { ids : {}, list : {} });
                    if(!(id in eventStorage.ids)) {
                        list = eventStorage.list;
                        item = { fn : fn, data : data, ctx : ctx, special : _special };
                        if(list.last) {
                            list.last.next = item;
                            item.prev = list.last;
                        } else {
                            list.first = item;
                        }
                        eventStorage.ids[id] = list.last = item;
                    }
                }
            } else {
                for(var key in e) {
                    e.hasOwnProperty(key) && this.on(key, e[key], data, _special);
                }
            }

            return this;
        },

        /**
         * Adds a one time handler for the event.
         * Handler is executed only the next time the event is fired, after which it is removed.
         * @param {String} e Event type
         * @param {Object} [data] Additional data that the handler gets as e.data
         * @param {Function} fn Handler
         * @param {Object} [ctx] Handler context
         * @returns {Emitter} this
         */
        once : function(e, data, fn, ctx) {
            return this.on(e, data, fn, ctx, { once : true });
        },

        /**
         * Removes event handler or handlers
         * @param {String} [e] Event type
         * @param {Function} [fn] Handler
         * @param {Object} [ctx] Handler context
         * @returns {Emitter} this
         */
        un : function(e, fn, ctx) {
            if(typeof e === 'string' || typeof e === 'undefined') {
                var storage = this[storageExpando];
                if(storage) {
                    if(e) { // if event type was passed
                        var eventTypes = e.split(' '),
                            i = 0, eventStorage;
                        while(e = eventTypes[i++]) {
                            if(eventStorage = storage[e]) {
                                if(fn) {  // if specific handler was passed
                                    var id = getFnId(fn, ctx),
                                        ids = eventStorage.ids;
                                    if(id in ids) {
                                        var list = eventStorage.list,
                                            item = ids[id],
                                            prev = item.prev,
                                            next = item.next;

                                        if(prev) {
                                            prev.next = next;
                                        } else if(item === list.first) {
                                            list.first = next;
                                        }

                                        if(next) {
                                            next.prev = prev;
                                        } else if(item === list.last) {
                                            list.last = prev;
                                        }

                                        delete ids[id];
                                    }
                                } else {
                                    delete this[storageExpando][e];
                                }
                            }
                        }
                    } else {
                        delete this[storageExpando];
                    }
                }
            } else {
                for(var key in e) {
                    e.hasOwnProperty(key) && this.un(key, e[key], fn);
                }
            }

            return this;
        },

        /**
         * Fires event handlers
         * @param {String|events:Event} e Event
         * @param {Object} [data] Additional data
         * @returns {Emitter} this
         */
        emit : function(e, data) {
            var storage = this[storageExpando],
                eventInstantiated = false;

            if(storage) {
                var eventTypes = [typeof e === 'string'? e : e.type, '*'],
                    i = 0, eventType, eventStorage;
                while(eventType = eventTypes[i++]) {
                    if(eventStorage = storage[eventType]) {
                        var item = eventStorage.list.first,
                            lastItem = eventStorage.list.last,
                            res;
                        while(item) {
                            if(!eventInstantiated) { // instantiate Event only on demand
                                eventInstantiated = true;
                                typeof e === 'string' && (e = new Event(e));
                                e.target || (e.target = this);
                            }

                            e.data = item.data;
                            res = item.fn.apply(item.ctx || this, arguments);
                            if(typeof res !== 'undefined') {
                                e.result = res;
                                if(res === false) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }
                            }

                            item.special && item.special.once &&
                                this.un(e.type, item.fn, item.ctx);

                            if(item === lastItem) {
                                break;
                            }

                            item = item.next;
                        }
                    }
                }
            }

            return this;
        }
    },
    /**
     * @class Emitter
     * @exports events:Emitter
     */
    Emitter = inherit(
        EmitterProps,
        EmitterProps);

provide({
    Emitter : Emitter,
    Event : Event
});

});

/* end: ../../common.blocks/events/events.vanilla.js */
/* begin: ../../common.blocks/inherit/inherit.vanilla.js */
/**
 * @module inherit
 * @version 2.2.1
 * @author Filatov Dmitry <dfilatov@yandex-team.ru>
 * @description This module provides some syntax sugar for "class" declarations, constructors, mixins, "super" calls and static members.
 */

(function(global) {

var hasIntrospection = (function(){'_';}).toString().indexOf('_') > -1,
    emptyBase = function() {},
    hasOwnProperty = Object.prototype.hasOwnProperty,
    objCreate = Object.create || function(ptp) {
        var inheritance = function() {};
        inheritance.prototype = ptp;
        return new inheritance();
    },
    objKeys = Object.keys || function(obj) {
        var res = [];
        for(var i in obj) {
            hasOwnProperty.call(obj, i) && res.push(i);
        }
        return res;
    },
    extend = function(o1, o2) {
        for(var i in o2) {
            hasOwnProperty.call(o2, i) && (o1[i] = o2[i]);
        }

        return o1;
    },
    toStr = Object.prototype.toString,
    isArray = Array.isArray || function(obj) {
        return toStr.call(obj) === '[object Array]';
    },
    isFunction = function(obj) {
        return toStr.call(obj) === '[object Function]';
    },
    noOp = function() {},
    needCheckProps = true,
    testPropObj = { toString : '' };

for(var i in testPropObj) { // fucking ie hasn't toString, valueOf in for
    testPropObj.hasOwnProperty(i) && (needCheckProps = false);
}

var specProps = needCheckProps? ['toString', 'valueOf'] : null;

function getPropList(obj) {
    var res = objKeys(obj);
    if(needCheckProps) {
        var specProp, i = 0;
        while(specProp = specProps[i++]) {
            obj.hasOwnProperty(specProp) && res.push(specProp);
        }
    }

    return res;
}

function override(base, res, add) {
    var addList = getPropList(add),
        j = 0, len = addList.length,
        name, prop;
    while(j < len) {
        if((name = addList[j++]) === '__self') {
            continue;
        }
        prop = add[name];
        if(isFunction(prop) &&
                (!hasIntrospection || prop.toString().indexOf('.__base') > -1)) {
            res[name] = (function(name, prop) {
                var baseMethod = base[name]?
                        base[name] :
                        name === '__constructor'? // case of inheritance from plane function
                            res.__self.__parent :
                            noOp;
                return function() {
                    var baseSaved = this.__base;
                    this.__base = baseMethod;
                    var res = prop.apply(this, arguments);
                    this.__base = baseSaved;
                    return res;
                };
            })(name, prop);
        } else {
            res[name] = prop;
        }
    }
}

function applyMixins(mixins, res) {
    var i = 1, mixin;
    while(mixin = mixins[i++]) {
        res?
            isFunction(mixin)?
                inherit.self(res, mixin.prototype, mixin) :
                inherit.self(res, mixin) :
            res = isFunction(mixin)?
                inherit(mixins[0], mixin.prototype, mixin) :
                inherit(mixins[0], mixin);
    }
    return res || mixins[0];
}

/**
* Creates class
* @exports
* @param {Function|Array} [baseClass|baseClassAndMixins] class (or class and mixins) to inherit from
* @param {Object} prototypeFields
* @param {Object} [staticFields]
* @returns {Function} class
*/
function inherit() {
    var args = arguments,
        withMixins = isArray(args[0]),
        hasBase = withMixins || isFunction(args[0]),
        base = hasBase? withMixins? applyMixins(args[0]) : args[0] : emptyBase,
        props = args[hasBase? 1 : 0] || {},
        staticProps = args[hasBase? 2 : 1],
        res = props.__constructor || (hasBase && base.prototype.__constructor)?
            function() {
                return this.__constructor.apply(this, arguments);
            } :
            hasBase?
                function() {
                    return base.apply(this, arguments);
                } :
                function() {};

    if(!hasBase) {
        res.prototype = props;
        res.prototype.__self = res.prototype.constructor = res;
        return extend(res, staticProps);
    }

    extend(res, base);

    res.__parent = base;

    var basePtp = base.prototype,
        resPtp = res.prototype = objCreate(basePtp);

    resPtp.__self = resPtp.constructor = res;

    props && override(basePtp, resPtp, props);
    staticProps && override(base, res, staticProps);

    return res;
}

inherit.self = function() {
    var args = arguments,
        withMixins = isArray(args[0]),
        base = withMixins? applyMixins(args[0], args[0][0]) : args[0],
        props = args[1],
        staticProps = args[2],
        basePtp = base.prototype;

    props && override(basePtp, basePtp, props);
    staticProps && override(base, base, staticProps);

    return base;
};

var defineAsGlobal = true;
if(typeof exports === 'object') {
    module.exports = inherit;
    defineAsGlobal = false;
}

if(typeof modules === 'object') {
    modules.define('inherit', function(provide) {
        provide(inherit);
    });
    defineAsGlobal = false;
}

if(typeof define === 'function') {
    define(function(require, exports, module) {
        module.exports = inherit;
    });
    defineAsGlobal = false;
}

defineAsGlobal && (global.inherit = inherit);

})(this);

/* end: ../../common.blocks/inherit/inherit.vanilla.js */
/* begin: ../../common.blocks/identify/identify.vanilla.js */
/**
 * @module identify
 */

modules.define('identify', function(provide) {

var counter = 0,
    expando = '__' + (+new Date),
    get = function() {
        return 'uniq' + (++counter);
    };

provide(
    /**
     * Makes unique ID
     * @exports
     * @param {Object} obj Object that needs to be identified
     * @param {Boolean} [onlyGet=false] Return a unique value only if it had already been assigned before
     * @returns {String} ID
     */
    function(obj, onlyGet) {
        if(!obj) return get();

        var key = 'uniqueID' in obj? 'uniqueID' : expando; // Use when possible native uniqueID for elements in IE

        return onlyGet || key in obj?
            obj[key] :
            obj[key] = get();
    }
);

});

/* end: ../../common.blocks/identify/identify.vanilla.js */
/* begin: ../../common.blocks/functions/functions.vanilla.js */
/**
 * @module functions
 * @description A set of helpers to work with JavaScript functions
 */

modules.define('functions', function(provide) {

var toStr = Object.prototype.toString;

provide(/** @exports */{
    /**
     * Checks whether a given object is function
     * @param {*} obj
     * @returns {Boolean}
     */
    isFunction : function(obj) {
        return toStr.call(obj) === '[object Function]';
    },

    /**
     * Empty function
     */
    noop : function() {}
});

});

/* end: ../../common.blocks/functions/functions.vanilla.js */
/* begin: ../../common.blocks/events/__channels/events__channels.vanilla.js */
/**
 * @module events__channels
 */

modules.define('events__channels', ['events'], function(provide, events) {

var undef,
    channels = {};

provide(
    /**
     * Returns/destroys a named communication channel
     * @exports
     * @param {String} [id='default'] Channel ID
     * @param {Boolean} [drop=false] Destroy the channel
     * @returns {events:Emitter|undefined} Communication channel
     */
    function(id, drop) {
        if(typeof id === 'boolean') {
            drop = id;
            id = undef;
        }

        id || (id = 'default');

        if(drop) {
            if(channels[id]) {
                channels[id].un();
                delete channels[id];
            }
            return;
        }

        return channels[id] || (channels[id] = new events.Emitter());
    });
});

/* end: ../../common.blocks/events/__channels/events__channels.vanilla.js */
/* begin: ../../common.blocks/functions/__debounce/functions__debounce.vanilla.js */
/**
 * @module functions__debounce
 */

modules.define('functions__debounce', function(provide) {

var global = this.global;

provide(
    /**
     * Debounces given function
     * @exports
     * @param {Function} fn function to debounce
     * @param {Number} timeout debounce interval
     * @param {Boolean} [invokeAsap=false] invoke before first interval
     * @param {Object} [ctx] context of function invocation
     * @returns {Function} debounced function
     */
    function(fn, timeout, invokeAsap, ctx) {
        if(arguments.length === 3 && typeof invokeAsap !== 'boolean') {
            ctx = invokeAsap;
            invokeAsap = false;
        }

        var timer;
        return function() {
            var args = arguments;
            ctx || (ctx = this);

            invokeAsap && !timer && fn.apply(ctx, args);

            global.clearTimeout(timer);

            timer = global.setTimeout(function() {
                invokeAsap || fn.apply(ctx, args);
                timer = null;
            }, timeout);
        };
    });
});

/* end: ../../common.blocks/functions/__debounce/functions__debounce.vanilla.js */
/* begin: ../../common.blocks/functions/__throttle/functions__throttle.vanilla.js */
/**
 * @module functions__throttle
 */

modules.define('functions__throttle', function(provide) {

var global = this.global;

provide(
    /**
     * Throttle given function
     * @exports
     * @param {Function} fn function to throttle
     * @param {Number} timeout throttle interval
     * @param {Boolean} [invokeAsap=true] invoke before first interval
     * @param {Object} [ctx] context of function invocation
     * @returns {Function} throttled function
     */
    function(fn, timeout, invokeAsap, ctx) {
        var typeofInvokeAsap = typeof invokeAsap;
        if(typeofInvokeAsap === 'undefined') {
            invokeAsap = true;
        } else if(arguments.length === 3 && typeofInvokeAsap !== 'boolean') {
            ctx = invokeAsap;
            invokeAsap = true;
        }

        var timer, args, needInvoke,
            wrapper = function() {
                if(needInvoke) {
                    fn.apply(ctx, args);
                    needInvoke = false;
                    timer = global.setTimeout(wrapper, timeout);
                } else {
                    timer = null;
                }
            };

        return function() {
            args = arguments;
            ctx || (ctx = this);
            needInvoke = true;

            if(!timer) {
                invokeAsap?
                    wrapper() :
                    timer = global.setTimeout(wrapper, timeout);
            }
        };
    });

});

/* end: ../../common.blocks/functions/__throttle/functions__throttle.vanilla.js */
/* begin: ../../common.blocks/i-bem/i-bem.vanilla.js */
/**
 * @module i-bem
 */

modules.define(
    'i-bem',
    [
        'i-bem__internal',
        'inherit',
        'identify',
        'next-tick',
        'objects',
        'functions',
        'events'
    ],
    function(
        provide,
        INTERNAL,
        inherit,
        identify,
        nextTick,
        objects,
        functions,
        events) {

var undef,

    MOD_DELIM = INTERNAL.MOD_DELIM,
    ELEM_DELIM = INTERNAL.ELEM_DELIM,

    /**
     * Storage for block init functions
     * @private
     * @type Array
     */
    initFns = [],

    /**
     * Storage for block declarations (hash by block name)
     * @private
     * @type Object
     */
    blocks = {};

/**
 * Builds the name of the handler method for setting a modifier
 * @param {String} prefix
 * @param {String} modName Modifier name
 * @param {String} modVal Modifier value
 * @param {String} [elemName] Element name
 * @returns {String}
 */
function buildModFnName(prefix, modName, modVal, elemName) {
    return '__' + prefix +
        (elemName? '__elem_' + elemName : '') +
       '__mod' +
       (modName? '_' + modName : '') +
       (modVal? '_' + modVal : '');
}

/**
 * Transforms a hash of modifier handlers to methods
 * @param {String} prefix
 * @param {Object} modFns
 * @param {Object} props
 * @param {String} [elemName]
 */
function modFnsToProps(prefix, modFns, props, elemName) {
    if(functions.isFunction(modFns)) {
        props[buildModFnName(prefix, '*', '*', elemName)] = modFns;
    } else {
        var modName, modVal, modFn;
        for(modName in modFns) {
            if(modFns.hasOwnProperty(modName)) {
                modFn = modFns[modName];
                if(functions.isFunction(modFn)) {
                    props[buildModFnName(prefix, modName, '*', elemName)] = modFn;
                } else {
                    for(modVal in modFn) {
                        if(modFn.hasOwnProperty(modVal)) {
                            props[buildModFnName(prefix, modName, modVal, elemName)] = modFn[modVal];
                        }
                    }
                }
            }
        }
    }
}

function buildCheckMod(modName, modVal) {
    return modVal?
        Array.isArray(modVal)?
            function(block) {
                var i = 0, len = modVal.length;
                while(i < len)
                    if(block.hasMod(modName, modVal[i++]))
                        return true;
                return false;
            } :
            function(block) {
                return block.hasMod(modName, modVal);
            } :
        function(block) {
            return block.hasMod(modName);
        };
}

function convertModHandlersToMethods(props) {
    if(props.beforeSetMod) {
        modFnsToProps('before', props.beforeSetMod, props);
        delete props.beforeSetMod;
    }

    if(props.onSetMod) {
        modFnsToProps('after', props.onSetMod, props);
        delete props.onSetMod;
    }

    var elemName;
    if(props.beforeElemSetMod) {
        for(elemName in props.beforeElemSetMod) {
            if(props.beforeElemSetMod.hasOwnProperty(elemName)) {
                modFnsToProps('before', props.beforeElemSetMod[elemName], props, elemName);
            }
        }
        delete props.beforeElemSetMod;
    }

    if(props.onElemSetMod) {
        for(elemName in props.onElemSetMod) {
            if(props.onElemSetMod.hasOwnProperty(elemName)) {
                modFnsToProps('after', props.onElemSetMod[elemName], props, elemName);
            }
        }
        delete props.onElemSetMod;
    }
}

/**
 * @class BEM
 * @description Base block for creating BEM blocks
 * @augments events:Emitter
 * @exports
 */
var BEM = inherit(events.Emitter, /** @lends BEM.prototype */ {
    /**
     * @constructor
     * @private
     * @param {Object} mods Block modifiers
     * @param {Object} params Block parameters
     * @param {Boolean} [initImmediately=true]
     */
    __constructor : function(mods, params, initImmediately) {
        /**
         * Cache of block modifiers
         * @member {Object}
         * @private
         */
        this._modCache = mods || {};

        /**
         * Current modifiers in the stack
         * @member {Object}
         * @private
         */
        this._processingMods = {};

        /**
         * Block parameters, taking into account the defaults
         * @member {Object}
         * @readonly
         */
        this.params = objects.extend(this.getDefaultParams(), params);

        initImmediately !== false?
            this._init() :
            initFns.push(this._init, this);
    },

    /**
     * Initializes the block
     * @private
     */
    _init : function() {
        return this.setMod('js', 'inited');
    },

    /**
     * Adds an event handler
     * @param {String|Object} e Event type
     * @param {Object} [data] Additional data that the handler gets as e.data
     * @param {Function} fn Handler
     * @param {Object} [ctx] Handler context
     * @returns {BEM} this
     */
    on : function(e, data, fn, ctx) {
        if(typeof e === 'object' && (functions.isFunction(data) || functions.isFunction(fn))) { // mod change event
            e = this.__self._buildModEventName(e);
        }

        return this.__base.apply(this, arguments);
    },

    /**
     * Removes event handler or handlers
     * @param {String|Object} [e] Event type
     * @param {Function} [fn] Handler
     * @param {Object} [ctx] Handler context
     * @returns {BEM} this
     */
    un : function(e, fn, ctx) {
        if(typeof e === 'object' && functions.isFunction(fn)) { // mod change event
            e = this.__self._buildModEventName(e);
        }

        return this.__base.apply(this, arguments);
    },

    /**
     * Executes the block's event handlers and live event handlers
     * @protected
     * @param {String} e Event name
     * @param {Object} [data] Additional information
     * @returns {BEM} this
     */
    emit : function(e, data) {
        var isModJsEvent = false;
        if(typeof e === 'object' && !(e instanceof events.Event)) {
            isModJsEvent = e.modName === 'js';
            e = this.__self._buildModEventName(e);
        }

        if(isModJsEvent || this.hasMod('js', 'inited')) {
            this.__base(e = this._buildEvent(e), data);
            this._ctxEmit(e, data);
        }

        return this;
    },

    _ctxEmit : function(e, data) {
        this.__self.emit(e, data);
    },

    /**
     * Builds event
     * @private
     * @param {String|events:Event} e
     * @returns {events:Event}
     */
    _buildEvent : function(e) {
        typeof e === 'string'?
            e = new events.Event(e, this) :
            e.target || (e.target = this);

        return e;
    },

    /**
     * Checks whether a block or nested element has a modifier
     * @param {Object} [elem] Nested element
     * @param {String} modName Modifier name
     * @param {String|Boolean} [modVal] Modifier value. If defined and not of type String or Boolean, it is casted to String
     * @returns {Boolean}
     */
    hasMod : function(elem, modName, modVal) {
        var len = arguments.length,
            invert = false;

        if(len === 1) {
            modVal = '';
            modName = elem;
            elem = undef;
            invert = true;
        } else if(len === 2) {
            if(typeof elem === 'string') {
                modVal = modName;
                modName = elem;
                elem = undef;
            } else {
                modVal = '';
                invert = true;
            }
        }

        var typeModVal = typeof modVal;
        typeModVal === 'string' ||
            typeModVal === 'boolean' ||
            typeModVal === 'undefined' || (modVal = modVal.toString());

        var res = this.getMod(elem, modName) === modVal;
        return invert? !res : res;
    },

    /**
     * Returns the value of the modifier of the block/nested element
     * @param {Object} [elem] Nested element
     * @param {String} modName Modifier name
     * @returns {String|Boolean} Modifier value
     */
    getMod : function(elem, modName) {
        var type = typeof elem;
        if(type === 'string' || type === 'undefined') { // elem either omitted or undefined
            modName = elem || modName;
            var modCache = this._modCache;
            return modName in modCache?
                modCache[modName] || '' :
                modCache[modName] = this._extractModVal(modName);
        }

        return this._getElemMod(modName, elem);
    },

    /**
     * Returns the value of the modifier of the nested element
     * @private
     * @param {String} modName Modifier name
     * @param {Object} elem Nested element
     * @param {Object} [elemName] Nested element name
     * @returns {String} Modifier value
     */
    _getElemMod : function(modName, elem, elemName) {
        return this._extractModVal(modName, elem, elemName);
    },

    /**
     * Returns values of modifiers of the block/nested element
     * @param {Object} [elem] Nested element
     * @param {String} [...modNames] Modifier names
     * @returns {Object} Hash of modifier values
     */
    getMods : function(elem) {
        var hasElem = elem && typeof elem !== 'string',
            modNames = [].slice.call(arguments, hasElem? 1 : 0),
            res = this._extractMods(modNames, hasElem? elem : undef);

        if(!hasElem) { // caching
            modNames.length?
                modNames.forEach(function(name) {
                    this._modCache[name] = res[name];
                }, this) :
                this._modCache = res;
        }

        return res;
    },

    /**
     * Sets the modifier for a block/nested element
     * @param {Object} [elem] Nested element
     * @param {String} modName Modifier name
     * @param {String|Boolean} [modVal=true] Modifier value. If not of type String or Boolean, it is casted to String
     * @returns {BEM} this
     */
    setMod : function(elem, modName, modVal) {
        if(typeof modVal === 'undefined') {
            if(typeof elem === 'string') { // if no elem
                modVal = typeof modName === 'undefined'?
                    true :  // e.g. setMod('focused')
                    modName; // e.g. setMod('js', 'inited')
                modName = elem;
                elem = undef;
            } else { // if elem
                modVal = true; // e.g. setMod(elem, 'focused')
            }
        }

        if(!elem || elem[0]) {
            if(modVal === false) {
                modVal = '';
            } else if(typeof modVal !== 'boolean') {
                modVal = modVal.toString();
            }

            var modId = (elem && elem[0]? identify(elem[0]) : '') + '_' + modName;

            if(this._processingMods[modId])
                return this;

            var elemName,
                curModVal = elem?
                    this._getElemMod(modName, elem, elemName = this.__self._extractElemNameFrom(elem)) :
                    this.getMod(modName);

            if(curModVal === modVal)
                return this;

            this._processingMods[modId] = true;

            var needSetMod = true,
                modFnParams = [modName, modVal, curModVal];

            elem && modFnParams.unshift(elem);

            var modVars = [['*', '*'], [modName, '*'], [modName, modVal]],
                prefixes = ['before', 'after'],
                i = 0, prefix, j, modVar;

            while(prefix = prefixes[i++]) {
                j = 0;
                while(modVar = modVars[j++]) {
                    if(this._callModFn(prefix, elemName, modVar[0], modVar[1], modFnParams) === false) {
                        needSetMod = false;
                        break;
                    }
                }

                if(!needSetMod) break;

                if(prefix === 'before') {
                    elem || (this._modCache[modName] = modVal); // cache only block mods
                    this._onSetMod(modName, modVal, curModVal, elem, elemName);
                }
            }

            this._processingMods[modId] = null;
            needSetMod && this._emitModChangeEvents(modName, modVal, curModVal, elem, elemName);
        }

        return this;
    },

    /**
     * Function after successfully changing the modifier of the block/nested element
     * @protected
     * @param {String} modName Modifier name
     * @param {String} modVal Modifier value
     * @param {String} oldModVal Old modifier value
     * @param {Object} [elem] Nested element
     * @param {String} [elemName] Element name
     */
    _onSetMod : function(modName, modVal, oldModVal, elem, elemName) {},

    _emitModChangeEvents : function(modName, modVal, oldModVal, elem, elemName) {
        var eventData = { modName : modName, modVal : modVal, oldModVal : oldModVal };
        elem && (eventData.elem = elem);
        this
            .emit({ modName : modName, modVal : '*', elem : elemName }, eventData)
            .emit({ modName : modName, modVal : modVal, elem : elemName }, eventData);
    },

    /**
     * Sets a modifier for a block/nested element, depending on conditions.
     * If the condition parameter is passed: when true, modVal1 is set; when false, modVal2 is set.
     * If the condition parameter is not passed: modVal1 is set if modVal2 was set, or vice versa.
     * @param {Object} [elem] Nested element
     * @param {String} modName Modifier name
     * @param {String} [modVal1=true] First modifier value, optional for boolean modifiers
     * @param {String} [modVal2] Second modifier value
     * @param {Boolean} [condition] Condition
     * @returns {BEM} this
     */
    toggleMod : function(elem, modName, modVal1, modVal2, condition) {
        if(typeof elem === 'string') { // if this is a block
            condition = modVal2;
            modVal2 = modVal1;
            modVal1 = modName;
            modName = elem;
            elem = undef;
        }

        if(typeof modVal1 === 'undefined') { // boolean mod
            modVal1 = true;
        }

        if(typeof modVal2 === 'undefined') {
            modVal2 = '';
        } else if(typeof modVal2 === 'boolean') {
            condition = modVal2;
            modVal2 = '';
        }

        var modVal = this.getMod(elem, modName);
        (modVal === modVal1 || modVal === modVal2) &&
            this.setMod(
                elem,
                modName,
                typeof condition === 'boolean'?
                    (condition? modVal1 : modVal2) :
                    this.hasMod(elem, modName, modVal1)? modVal2 : modVal1);

        return this;
    },

    /**
     * Removes a modifier from a block/nested element
     * @protected
     * @param {Object} [elem] Nested element
     * @param {String} modName Modifier name
     * @returns {BEM} this
     */
    delMod : function(elem, modName) {
        if(!modName) {
            modName = elem;
            elem = undef;
        }

        return this.setMod(elem, modName, '');
    },

    /**
     * Executes handlers for setting modifiers
     * @private
     * @param {String} prefix
     * @param {String} elemName Element name
     * @param {String} modName Modifier name
     * @param {String} modVal Modifier value
     * @param {Array} modFnParams Handler parameters
     */
    _callModFn : function(prefix, elemName, modName, modVal, modFnParams) {
        var modFnName = buildModFnName(prefix, modName, modVal, elemName);
        return this[modFnName]?
           this[modFnName].apply(this, modFnParams) :
           undef;
    },

    /**
     * Retrieves the value of the modifier
     * @private
     * @param {String} modName Modifier name
     * @param {Object} [elem] Element
     * @returns {String} Modifier value
     */
    _extractModVal : function(modName, elem) {
        return '';
    },

    /**
     * Retrieves name/value for a list of modifiers
     * @private
     * @param {Array} modNames Names of modifiers
     * @param {Object} [elem] Element
     * @returns {Object} Hash of modifier values by name
     */
    _extractMods : function(modNames, elem) {
        return {};
    },

    /**
     * Returns a block's default parameters
     * @protected
     * @returns {Object}
     */
    getDefaultParams : function() {
        return {};
    },

    /**
     * Deletes a block
     * @private
     */
    _destruct : function() {
        this.delMod('js');
    },

    /**
     * Executes given callback on next turn eventloop in block's context
     * @protected
     * @param {Function} fn callback
     * @returns {BEM} this
     */
    nextTick : function(fn) {
        var _this = this;
        nextTick(function() {
            _this.hasMod('js', 'inited') && fn.call(_this);
        });
        return this;
    }
}, /** @lends BEM */{

    _name : 'i-bem',

    /**
     * Storage for block declarations (hash by block name)
     * @type Object
     */
    blocks : blocks,

    /**
     * Declares blocks and creates a block class
     * @param {String|Object} decl Block name (simple syntax) or description
     * @param {String} decl.block|decl.name Block name
     * @param {String} [decl.baseBlock] Name of the parent block
     * @param {Array} [decl.baseMix] Mixed block names
     * @param {String} [decl.modName] Modifier name
     * @param {String|Array} [decl.modVal] Modifier value
     * @param {Object} [props] Methods
     * @param {Object} [staticProps] Static methods
     * @returns {Function}
     */
    decl : function(decl, props, staticProps) {
        // string as block
        typeof decl === 'string' && (decl = { block : decl });
        // inherit from itself
        if(arguments.length <= 2 &&
                typeof decl === 'object' &&
                (!decl || (typeof decl.block !== 'string' && typeof decl.modName !== 'string'))) {
            staticProps = props;
            props = decl;
            decl = {};
        }
        typeof decl.block === 'undefined' && (decl.block = this.getName());

        var baseBlock;
        if(typeof decl.baseBlock === 'undefined') {
            baseBlock = blocks[decl.block] || this;
        } else if(typeof decl.baseBlock === 'string') {
            baseBlock = blocks[decl.baseBlock];
            if(!baseBlock)
                throw('baseBlock "' + decl.baseBlock + '" for "' + decl.block + '" is undefined');
        } else {
            baseBlock = decl.baseBlock;
        }

        convertModHandlersToMethods(props || (props = {}));

        if(decl.modName) {
            var checkMod = buildCheckMod(decl.modName, decl.modVal);
            objects.each(props, function(prop, name) {
                functions.isFunction(prop) &&
                    (props[name] = function() {
                        var method;
                        if(checkMod(this)) {
                            method = prop;
                        } else {
                            var baseMethod = baseBlock.prototype[name];
                            baseMethod && baseMethod !== prop &&
                                (method = this.__base);
                        }
                        return method?
                            method.apply(this, arguments) :
                            undef;
                    });
            });
        }

        if(staticProps && typeof staticProps.live === 'boolean') {
            var live = staticProps.live;
            staticProps.live = function() {
                return live;
            };
        }

        var block, baseBlocks = baseBlock;
        if(decl.baseMix) {
            baseBlocks = [baseBlocks];
            decl.baseMix.forEach(function(mixedBlock) {
                if(!blocks[mixedBlock]) {
                    throw('mix block "' + mixedBlock + '" for "' + decl.block + '" is undefined');
                }
                baseBlocks.push(blocks[mixedBlock]);
            });
        }

        if(decl.block === baseBlock.getName()) {
            // makes a new "live" if the old one was already executed
            (block = inherit.self(baseBlocks, props, staticProps))._processLive(true);
        } else {
            (block = blocks[decl.block] = inherit(baseBlocks, props, staticProps))._name = decl.block;
            delete block._liveInitable;
        }

        return block;
    },

    declMix : function(block, props, staticProps) {
        convertModHandlersToMethods(props || (props = {}));
        return blocks[block] = inherit(props, staticProps);
    },

    /**
     * Processes a block's live properties
     * @private
     * @param {Boolean} [heedLive=false] Whether to take into account that the block already processed its live properties
     * @returns {Boolean} Whether the block is a live block
     */
    _processLive : function(heedLive) {
        return false;
    },

    /**
     * Factory method for creating an instance of the block named
     * @param {String|Object} block Block name or description
     * @param {Object} [params] Block parameters
     * @returns {BEM}
     */
    create : function(block, params) {
        typeof block === 'string' && (block = { block : block });

        return new blocks[block.block](block.mods, params);
    },

    /**
     * Returns the name of the current block
     * @returns {String}
     */
    getName : function() {
        return this._name;
    },

    /**
     * Adds an event handler
     * @param {String|Object} e Event type
     * @param {Object} [data] Additional data that the handler gets as e.data
     * @param {Function} fn Handler
     * @param {Object} [ctx] Handler context
     * @returns {Function} this
     */
    on : function(e, data, fn, ctx) {
        if(typeof e === 'object' && (functions.isFunction(data) || functions.isFunction(fn))) { // mod change event
            e = this._buildModEventName(e);
        }

        return this.__base.apply(this, arguments);
    },

    /**
     * Removes event handler or handlers
     * @param {String|Object} [e] Event type
     * @param {Function} [fn] Handler
     * @param {Object} [ctx] Handler context
     * @returns {Function} this
     */
    un : function(e, fn, ctx) {
        if(typeof e === 'object' && functions.isFunction(fn)) { // mod change event
            e = this._buildModEventName(e);
        }

        return this.__base.apply(this, arguments);
    },

    _buildModEventName : function(modEvent) {
        var res = MOD_DELIM + modEvent.modName + MOD_DELIM + (modEvent.modVal === false? '' : modEvent.modVal);
        modEvent.elem && (res = ELEM_DELIM + modEvent.elem + res);
        return res;
    },

    /**
     * Retrieves the name of an element nested in a block
     * @private
     * @param {Object} elem Nested element
     * @returns {String|undefined}
     */
    _extractElemNameFrom : function(elem) {},

    /**
     * Executes the block init functions
     * @private
     */
    _runInitFns : function() {
        if(initFns.length) {
            var fns = initFns,
                fn, i = 0;

            initFns = [];
            while(fn = fns[i]) {
                fn.call(fns[i + 1]);
                i += 2;
            }
        }
    }
});

provide(BEM);

});

/* end: ../../common.blocks/i-bem/i-bem.vanilla.js */
/* begin: ../../common.blocks/i-bem/__internal/i-bem__internal.vanilla.js */
/**
 * @module i-bem__internal
 */

modules.define('i-bem__internal', function(provide) {

var undef,
    /**
     * Separator for modifiers and their values
     * @const
     * @type String
     */
    MOD_DELIM = '_',

    /**
     * Separator between names of a block and a nested element
     * @const
     * @type String
     */
    ELEM_DELIM = '__',

    /**
     * Pattern for acceptable element and modifier names
     * @const
     * @type String
     */
    NAME_PATTERN = '[a-zA-Z0-9-]+';

function isSimple(obj) {
    var typeOf = typeof obj;
    return typeOf === 'string' || typeOf === 'number' || typeOf === 'boolean';
}

function buildModPostfix(modName, modVal) {
    var res = '';
    /* jshint eqnull: true */
    if(modVal != null && modVal !== false) {
        res += MOD_DELIM + modName;
        modVal !== true && (res += MOD_DELIM + modVal);
    }
    return res;
}

function buildBlockClass(name, modName, modVal) {
    return name + buildModPostfix(modName, modVal);
}

function buildElemClass(block, name, modName, modVal) {
    return buildBlockClass(block, undef, undef) +
        ELEM_DELIM + name +
        buildModPostfix(modName, modVal);
}

provide(/** @exports */{
    NAME_PATTERN : NAME_PATTERN,

    MOD_DELIM : MOD_DELIM,
    ELEM_DELIM : ELEM_DELIM,

    buildModPostfix : buildModPostfix,

    /**
     * Builds the class of a block or element with a modifier
     * @param {String} block Block name
     * @param {String} [elem] Element name
     * @param {String} [modName] Modifier name
     * @param {String|Number} [modVal] Modifier value
     * @returns {String} Class
     */
    buildClass : function(block, elem, modName, modVal) {
        if(isSimple(modName)) {
            if(!isSimple(modVal)) {
                modVal = modName;
                modName = elem;
                elem = undef;
            }
        } else if(typeof modName !== 'undefined') {
            modName = undef;
        } else if(elem && typeof elem !== 'string') {
            elem = undef;
        }

        if(!(elem || modName)) { // optimization for simple case
            return block;
        }

        return elem?
            buildElemClass(block, elem, modName, modVal) :
            buildBlockClass(block, modName, modVal);
    },

    /**
     * Builds full classes for a buffer or element with modifiers
     * @param {String} block Block name
     * @param {String} [elem] Element name
     * @param {Object} [mods] Modifiers
     * @returns {String} Class
     */
    buildClasses : function(block, elem, mods) {
        if(elem && typeof elem !== 'string') {
            mods = elem;
            elem = undef;
        }

        var res = elem?
            buildElemClass(block, elem, undef, undef) :
            buildBlockClass(block, undef, undef);

        if(mods) {
            for(var modName in mods) {
                if(mods.hasOwnProperty(modName) && mods[modName]) {
                    res += ' ' + (elem?
                        buildElemClass(block, elem, modName, mods[modName]) :
                        buildBlockClass(block, modName, mods[modName]));
                }
            }
        }

        return res;
    }
});

});

/* end: ../../common.blocks/i-bem/__internal/i-bem__internal.vanilla.js */
/* begin: ../../common.blocks/next-tick/next-tick.vanilla.js */
/**
 * @module next-tick
 */

modules.define('next-tick', function(provide) {

/**
 * Executes given function on next tick.
 * @exports
 * @type Function
 * @param {Function} fn
 */

var global = this.global,
    fns = [],
    enqueueFn = function(fn) {
        return fns.push(fn) === 1;
    },
    callFns = function() {
        var fnsToCall = fns, i = 0, len = fns.length;
        fns = [];
        while(i < len) {
            fnsToCall[i++]();
        }
    };

    /* global process */
    if(typeof process === 'object' && process.nextTick) { // nodejs
        return provide(function(fn) {
            enqueueFn(fn) && process.nextTick(callFns);
        });
    }

    if(global.setImmediate) { // ie10
        return provide(function(fn) {
            enqueueFn(fn) && global.setImmediate(callFns);
        });
    }

    if(global.postMessage) { // modern browsers
        var isPostMessageAsync = true;
        if(global.attachEvent) {
            var checkAsync = function() {
                    isPostMessageAsync = false;
                };
            global.attachEvent('onmessage', checkAsync);
            global.postMessage('__checkAsync', '*');
            global.detachEvent('onmessage', checkAsync);
        }

        if(isPostMessageAsync) {
            var msg = '__nextTick' + (+new Date),
                onMessage = function(e) {
                    if(e.data === msg) {
                        e.stopPropagation && e.stopPropagation();
                        callFns();
                    }
                };

            global.addEventListener?
                global.addEventListener('message', onMessage, true) :
                global.attachEvent('onmessage', onMessage);

            return provide(function(fn) {
                enqueueFn(fn) && global.postMessage(msg, '*');
            });
        }
    }

    var doc = global.document;
    if('onreadystatechange' in doc.createElement('script')) { // ie6-ie8
        var head = doc.getElementsByTagName('head')[0],
            createScript = function() {
                var script = doc.createElement('script');
                script.onreadystatechange = function() {
                    script.parentNode.removeChild(script);
                    script = script.onreadystatechange = null;
                    callFns();
                };
                head.appendChild(script);
            };

        return provide(function(fn) {
            enqueueFn(fn) && createScript();
        });
    }

    provide(function(fn) { // old browsers
        enqueueFn(fn) && global.setTimeout(callFns, 0);
    });
});

/* end: ../../common.blocks/next-tick/next-tick.vanilla.js */
/* begin: ../../common.blocks/i-bem/_elem-instances/i-bem_elem-instances.js */
/**
 * @module i-bem
 */

modules.define(
    'i-bem',
    ['i-bem__internal', 'inherit'],
    function(provide, INTERNAL, inherit, BEM) {

var buildClass = INTERNAL.buildClass;

/**
 * @class BEM
 * @augments BEM
 * @exports
 */
provide(BEM.decl(null, /** @lends BEM */{

    /**
     * Declares elements and creates an elements class
     * @protected
     * @param {Object} decl Element description
     * @param {String} decl.block Block name
     * @param {String} decl.elem Element name
     * @param {String} [decl.baseBlock] Name of the parent block
     * @param {Array} [decl.baseMix] Mixed block names
     * @param {String} [decl.modName] Modifier name
     * @param {String|Array} [decl.modVal] Modifier value
     * @param {Object} [props] Methods
     * @param {Object} [staticProps] Static methods
     * @returns {Function}
     */
    decl : function(decl, props, staticProps) {
        var block;
        if(decl.elem) {
            typeof decl.block === 'undefined' && (decl.block = this._blockName);
            block = this.__base(
                {
                    block : buildClass(decl.block, decl.elem),
                    baseBlock : decl.baseBlock,
                    baseMix : decl.baseMix,
                    modName : decl.modName,
                    modVal : decl.modVal
                },
                props,
                staticProps);
            block._blockName = decl.block;
            block._elemName = decl.elem;
        } else {
            block = this.__base.apply(this, arguments);
            block._elemName || (block._blockName = block._name);
        }
        return block;
    },

    /**
     * Factory method for creating an instance of the element named
     * @param {Object} desc Description
     * @param {Object} [params] Instance parameters
     * @returns {BEM}
     */
    create : function(desc, params) {
        return desc.elem?
            new BEM.blocks[buildClass(desc.block, desc.elem)](desc.mods, params) :
            this.__base(desc, params);
    },

    /**
     * Returns the name of the current instance
     * @protected
     * @param {Boolean} [shortName] return the short name of the current instance
     * @returns {String}
     */
    getName : function(shortName) {
        return shortName? (this._elemName || this._blockName) : this._name;
    }
}));

});

/* end: ../../common.blocks/i-bem/_elem-instances/i-bem_elem-instances.js */
/* begin: ../../common.blocks/i-bem/__dom/i-bem__dom.js */
/**
 * @module i-bem__dom
 */

modules.define(
    'i-bem__dom',
    ['i-bem', 'i-bem__internal', 'identify', 'objects', 'functions', 'jquery', 'dom'],
    function(provide, BEM, INTERNAL, identify, objects, functions, $, dom) {

var undef,
    win = $(window),
    doc = $(document),

    /**
     * Storage for DOM elements by unique key
     * @type Object
     */
    uniqIdToDomElems = {},

    /**
     * Storage for blocks by unique key
     * @type Object
     */
    uniqIdToBlock = {},

    /**
     * Storage for DOM element's parent nodes
     * @type Object
     */
    domNodesToParents = {},

    /**
     * Storage for block parameters
     * @type Object
     */
    domElemToParams = {},

    /**
     * Storage for liveCtx event handlers
     * @type Object
     */
    liveEventCtxStorage = {},

    /**
     * Storage for liveClass event handlers
     * @type Object
     */
    liveClassEventStorage = {},

    blocks = BEM.blocks,

    BEM_CLASS = 'i-bem',
    BEM_SELECTOR = '.' + BEM_CLASS,
    BEM_PARAMS_ATTR = 'data-bem',

    NAME_PATTERN = INTERNAL.NAME_PATTERN,

    MOD_DELIM = INTERNAL.MOD_DELIM,
    ELEM_DELIM = INTERNAL.ELEM_DELIM,

    EXTRACT_MODS_RE = RegExp(
        '[^' + MOD_DELIM + ']' + MOD_DELIM + '(' + NAME_PATTERN + ')' +
        '(?:' + MOD_DELIM + '(' + NAME_PATTERN + '))?$'),

    buildModPostfix = INTERNAL.buildModPostfix,
    buildClass = INTERNAL.buildClass,

    reverse = Array.prototype.reverse;

/**
 * Initializes blocks on a DOM element
 * @param {jQuery} domElem DOM element
 * @param {String} uniqInitId ID of the "initialization wave"
 */
function initBlocks(domElem, uniqInitId) {
    var domNode = domElem[0],
        params = getParams(domNode),
        blockName;

    for(blockName in params)
        initBlock(
            blockName,
            domElem,
            processParams(params[blockName], blockName, uniqInitId));
}

/**
 * Initializes a specific block on a DOM element, or returns the existing block if it was already created
 * @param {String} blockName Block name
 * @param {jQuery} domElem DOM element
 * @param {Object} [params] Initialization parameters
 * @param {Boolean} [forceLive=false] Force live initialization
 * @param {Function} [callback] Handler to call after complete initialization
 */
function initBlock(blockName, domElem, params, forceLive, callback) {
    var domNode = domElem[0];

    params || (params = processParams(getBlockParams(domNode, blockName), blockName));

    var uniqId = params.uniqId,
        block = uniqIdToBlock[uniqId];

    if(block) {
        if(block.domElem.index(domNode) < 0) {
            block.domElem = block.domElem.add(domElem);
            objects.extend(block.params, params);
        }

        return block;
    }

    uniqIdToDomElems[uniqId] = uniqIdToDomElems[uniqId]?
        uniqIdToDomElems[uniqId].add(domElem) :
        domElem;

    var parentDomNode = domNode.parentNode;
    if(!parentDomNode || parentDomNode.nodeType === 11) { // jquery doesn't unique disconnected node
        $.unique(uniqIdToDomElems[uniqId]);
    }

    var blockClass = blocks[blockName] || DOM.decl(blockName, {}, { live : true }, true);
    if(!(blockClass._liveInitable = !!blockClass._processLive()) || forceLive || params.live === false) {
        forceLive && domElem.addClass(BEM_CLASS); // add css class for preventing memory leaks in further destructing

        block = new blockClass(uniqIdToDomElems[uniqId], params, !!forceLive);

        delete uniqIdToDomElems[uniqId];
        callback && callback.apply(block, Array.prototype.slice.call(arguments, 4));
        return block;
    }
}

/**
 * Processes and adds necessary block parameters
 * @param {Object} params Initialization parameters
 * @param {String} blockName Block name
 * @param {String} [uniqInitId] ID of the "initialization wave"
 */
function processParams(params, blockName, uniqInitId) {
    params.uniqId ||
        (params.uniqId = (params.id?
            blockName + '-id-' + params.id :
            identify()) + (uniqInitId || identify()));

    return params;
}

/**
 * Helper for searching for a DOM element using a selector inside the context, including the context itself
 * @param {jQuery} ctx Context
 * @param {String} selector CSS selector
 * @param {Boolean} [excludeSelf=false] Exclude context from search
 * @returns {jQuery}
 */
function findDomElem(ctx, selector, excludeSelf) {
    var res = ctx.find(selector);
    return excludeSelf?
       res :
       res.add(ctx.filter(selector));
}

/**
 * Returns parameters of a block's DOM element
 * @param {HTMLElement} domNode DOM node
 * @returns {Object}
 */
function getParams(domNode, blockName) {
    var uniqId = identify(domNode);
    return domElemToParams[uniqId] ||
        (domElemToParams[uniqId] = extractParams(domNode));
}

/**
 * Returns parameters of a block extracted from DOM node
 * @param {HTMLElement} domNode DOM node
 * @param {String} blockName
 * @returns {Object}
 */

function getBlockParams(domNode, blockName) {
    var params = getParams(domNode);
    return params[blockName] || (params[blockName] = {});
}

/**
 * Retrieves block parameters from a DOM element
 * @param {HTMLElement} domNode DOM node
 * @returns {Object}
 */
function extractParams(domNode) {
    var attrVal = domNode.getAttribute(BEM_PARAMS_ATTR);
    return attrVal? JSON.parse(attrVal) : {};
}

/**
 * Uncouple DOM node from the block. If this is the last node, then destroys the block.
 * @param {BEMDOM} block block
 * @param {HTMLElement} domNode DOM node
 */
function removeDomNodeFromBlock(block, domNode) {
    block.domElem.length === 1?
        block._destruct() :
        block.domElem = block.domElem.not(domNode);
}

/**
 * Fills DOM node's parent nodes to the storage
 * @param {jQuery} domElem
 */
function storeDomNodeParents(domElem) {
    domElem.each(function() {
        domNodesToParents[identify(this)] = this.parentNode;
    });
}

/**
 * Returns jQuery collection for provided HTML
 * @param {jQuery|String} html
 * @returns {jQuery}
 */
function getJqueryCollection(html) {
    return $(typeof html === 'string'? $.parseHTML(html, null, true) : html);
}

var DOM;

$(function() {

/**
 * @class BEMDOM
 * @description Base block for creating BEM blocks that have DOM representation
 * @exports
 */

DOM = BEM.decl('i-bem__dom',/** @lends BEMDOM.prototype */{
    /**
     * @constructor
     * @private
     * @param {jQuery} domElem DOM element that the block is created on
     * @param {Object} params Block parameters
     * @param {Boolean} [initImmediately=true]
     */
    __constructor : function(domElem, params, initImmediately) {
        /**
         * DOM elements of block
         * @member {jQuery}
         * @readonly
         */
        this.domElem = domElem;

        /**
         * Cache for names of events on DOM elements
         * @member {Object}
         * @private
         */
        this._eventNameCache = {};

        /**
         * Cache for elements
         * @member {Object}
         * @private
         */
        this._elemCache = {};

        /**
         * @member {String} Unique block ID
         * @private
         */
        this._uniqId = params.uniqId;

        uniqIdToBlock[this._uniqId] = this;

        /**
         * @member {Boolean} Flag for whether it's necessary to unbind from the document and window when destroying the block
         * @private
         */
        this._needSpecialUnbind = false;

        this.__base(null, params, initImmediately);
    },

    /**
     * Finds blocks inside the current block or its elements (including context)
     * @param {String|jQuery} [elem] Block element
     * @param {String|Object} block Name or description (block,modName,modVal) of the block to find
     * @returns {BEMDOM[]}
     */
    findBlocksInside : function(elem, block) {
        return this._findBlocks('find', elem, block);
    },

    /**
     * Finds the first block inside the current block or its elements (including context)
     * @param {String|jQuery} [elem] Block element
     * @param {String|Object} block Name or description (block,modName,modVal) of the block to find
     * @returns {BEMDOM}
     */
    findBlockInside : function(elem, block) {
        return this._findBlocks('find', elem, block, true);
    },

    /**
     * Finds blocks outside the current block or its elements (including context)
     * @param {String|jQuery} [elem] Block element
     * @param {String|Object} block Name or description (block,modName,modVal) of the block to find
     * @returns {BEMDOM[]}
     */
    findBlocksOutside : function(elem, block) {
        return this._findBlocks('parents', elem, block);
    },

    /**
     * Finds the first block outside the current block or its elements (including context)
     * @param {String|jQuery} [elem] Block element
     * @param {String|Object} block Name or description (block,modName,modVal) of the block to find
     * @returns {BEMDOM}
     */
    findBlockOutside : function(elem, block) {
        return this._findBlocks('closest', elem, block)[0] || null;
    },

    /**
     * Finds blocks on DOM elements of the current block or its elements
     * @param {String|jQuery} [elem] Block element
     * @param {String|Object} block Name or description (block,modName,modVal) of the block to find
     * @returns {BEMDOM[]}
     */
    findBlocksOn : function(elem, block) {
        return this._findBlocks('', elem, block);
    },

    /**
     * Finds the first block on DOM elements of the current block or its elements
     * @param {String|jQuery} [elem] Block element
     * @param {String|Object} block Name or description (block,modName,modVal) of the block to find
     * @returns {BEMDOM}
     */
    findBlockOn : function(elem, block) {
        return this._findBlocks('', elem, block, true);
    },

    _findBlocks : function(select, elem, block, onlyFirst) {
        if(!block) {
            block = elem;
            elem = undef;
        }

        var ctxElem = elem?
                (typeof elem === 'string'? this.findElem(elem) : elem) :
                this.domElem,
            isSimpleBlock = typeof block === 'string',
            blockName = isSimpleBlock? block : (block.block || block.blockName),
            selector = '.' +
                (isSimpleBlock?
                    buildClass(blockName) :
                    buildClass(blockName, block.modName, block.modVal)) +
                (onlyFirst? ':first' : ''),
            domElems = ctxElem.filter(selector);

        select && (domElems = domElems.add(ctxElem[select](selector)));

        if(onlyFirst) {
            return domElems[0]? initBlock(blockName, domElems.eq(0), undef, true)._init() : null;
        }

        var res = [],
            uniqIds = {};

        domElems.each(function(i, domElem) {
            var block = initBlock(blockName, $(domElem), undef, true)._init();
            if(!uniqIds[block._uniqId]) {
                uniqIds[block._uniqId] = true;
                res.push(block);
            }
        });

        return res;
    },

    /**
     * Adds an event handler for any DOM element
     * @protected
     * @param {jQuery} domElem DOM element where the event will be listened for
     * @param {String|Object} event Event name or event object
     * @param {Object} [data] Additional event data
     * @param {Function} fn Handler function, which will be executed in the block's context
     * @returns {BEMDOM} this
     */
    bindToDomElem : function(domElem, event, data, fn) {
        if(functions.isFunction(data)) {
            fn = data;
            data = undef;
        }

        fn?
            domElem.bind(
                this._buildEventName(event),
                data,
                $.proxy(fn, this)) :
            objects.each(event, function(fn, event) {
                this.bindToDomElem(domElem, event, data, fn);
            }, this);

        return this;
    },

    /**
     * Adds an event handler to the document
     * @protected
     * @param {String|Object} event Event name or event object
     * @param {Object} [data] Additional event data
     * @param {Function} fn Handler function, which will be executed in the block's context
     * @returns {BEMDOM} this
     */
    bindToDoc : function(event, data, fn) {
        this._needSpecialUnbind = true;
        return this.bindToDomElem(doc, event, data, fn);
    },

    /**
     * Adds an event handler to the window
     * @protected
     * @param {String|Object} event Event name or event object
     * @param {Object} [data] Additional event data
     * @param {Function} fn Handler function, which will be executed in the block's context
     * @returns {BEMDOM} this
     */
    bindToWin : function(event, data, fn) {
        this._needSpecialUnbind = true;
        return this.bindToDomElem(win, event, data, fn);
    },

    /**
     * Adds an event handler to the block's main DOM elements or its nested elements
     * @protected
     * @param {jQuery|String} [elem] Element
     * @param {String|Object} event Event name or event object
     * @param {Object} [data] Additional event data
     * @param {Function} fn Handler function, which will be executed in the block's context
     * @returns {BEMDOM} this
     */
    bindTo : function(elem, event, data, fn) {
        var len = arguments.length;
        if(len === 3) {
            if(functions.isFunction(data)) {
                fn = data;
                if(typeof event === 'object') {
                    data = event;
                    event = elem;
                    elem = this.domElem;
                }
            }
        } else if(len === 2) {
            if(functions.isFunction(event)) {
                fn = event;
                event = elem;
                elem = this.domElem;
            } else if(!(typeof elem === 'string' || elem instanceof $)) {
                data = event;
                event = elem;
                elem = this.domElem;
            }
        } else if(len === 1) {
            event = elem;
            elem = this.domElem;
        }

        typeof elem === 'string' && (elem = this.elem(elem));

        return this.bindToDomElem(elem, event, data, fn);
    },

    /**
     * Removes event handlers from any DOM element
     * @protected
     * @param {jQuery} domElem DOM element where the event was being listened for
     * @param {String|Object} event Event name or event object
     * @param {Function} [fn] Handler function
     * @returns {BEMDOM} this
     */
    unbindFromDomElem : function(domElem, event, fn) {
        if(typeof event === 'string') {
            event = this._buildEventName(event);
            fn?
                domElem.unbind(event, fn) :
                domElem.unbind(event);
        } else {
            objects.each(event, function(fn, event) {
                this.unbindFromDomElem(domElem, event, fn);
            }, this);
        }

        return this;
    },

    /**
     * Removes event handler from document
     * @protected
     * @param {String|Object} event Event name or event object
     * @param {Function} [fn] Handler function
     * @returns {BEMDOM} this
     */
    unbindFromDoc : function(event, fn) {
        return this.unbindFromDomElem(doc, event, fn);
    },

    /**
     * Removes event handler from window
     * @protected
     * @param {String|Object} event Event name or event object
     * @param {Function} [fn] Handler function
     * @returns {BEMDOM} this
     */
    unbindFromWin : function(event, fn) {
        return this.unbindFromDomElem(win, event, fn);
    },

    /**
     * Removes event handlers from the block's main DOM elements or its nested elements
     * @protected
     * @param {jQuery|String} [elem] Nested element
     * @param {String|Object} event Event name or event object
     * @param {Function} [fn] Handler function
     * @returns {BEMDOM} this
     */
    unbindFrom : function(elem, event, fn) {
        var argLen = arguments.length;
        if(argLen === 1) {
            event = elem;
            elem = this.domElem;
        } else if(argLen === 2 && functions.isFunction(event)) {
            fn = event;
            event = elem;
            elem = this.domElem;
        } else if(typeof elem === 'string') {
            elem = this.elem(elem);
        }

        return this.unbindFromDomElem(elem, event, fn);
    },

    /**
     * Builds a full name for an event
     * @private
     * @param {String} event Event name
     * @returns {String}
     */
    _buildEventName : function(event) {
        return event.indexOf(' ') > 1?
            event.split(' ').map(function(e) {
                return this._buildOneEventName(e);
            }, this).join(' ') :
            this._buildOneEventName(event);
    },

    /**
     * Builds a full name for a single event
     * @private
     * @param {String} event Event name
     * @returns {String}
     */
    _buildOneEventName : function(event) {
        var eventNameCache = this._eventNameCache;

        if(event in eventNameCache) return eventNameCache[event];

        var uniq = '.' + this._uniqId;

        if(event.indexOf('.') < 0) return eventNameCache[event] = event + uniq;

        var lego = '.bem_' + this.__self._name;

        return eventNameCache[event] = event.split('.').map(function(e, i) {
            return i === 0? e + lego : lego + '_' + e;
        }).join('') + uniq;
    },

    _ctxEmit : function(e, data) {
        this.__base.apply(this, arguments);

        var _this = this,
            storage = liveEventCtxStorage[_this.__self._buildCtxEventName(e.type)],
            ctxIds = {};

        storage && _this.domElem.each(function(_, ctx) {
            var counter = storage.counter;
            while(ctx && counter) {
                var ctxId = identify(ctx, true);
                if(ctxId) {
                    if(ctxIds[ctxId]) break;
                    var storageCtx = storage.ctxs[ctxId];
                    if(storageCtx) {
                        objects.each(storageCtx, function(handler) {
                            handler.fn.call(
                                handler.ctx || _this,
                                e,
                                data);
                        });
                        counter--;
                    }
                    ctxIds[ctxId] = true;
                }
                ctx = ctx.parentNode || domNodesToParents[ctxId];
            }
        });
    },

    /**
     * Sets a modifier for a block/nested element
     * @param {jQuery} [elem] Nested element
     * @param {String} modName Modifier name
     * @param {String|Boolean} [modVal=true] Modifier value
     * @returns {BEMDOM} this
     */
    setMod : function(elem, modName, modVal) {
        if(elem && typeof modVal !== 'undefined' && elem.length > 1) {
            var _this = this;
            elem.each(function() {
                var item = $(this);
                item.__bemElemName = elem.__bemElemName;
                _this.setMod(item, modName, modVal);
            });
            return _this;
        }
        return this.__base(elem, modName, modVal);
    },

    /**
     * Retrieves modifier value from the DOM node's CSS class
     * @private
     * @param {String} modName Modifier name
     * @param {jQuery} [elem] Nested element
     * @param {String} [elemName] Name of the nested element
     * @returns {String} Modifier value
     */
    _extractModVal : function(modName, elem, elemName) {
        var domNode = (elem || this.domElem)[0],
            matches;

        domNode &&
            (matches = domNode.className
                .match(this.__self._buildModValRE(modName, elemName || elem)));

        return matches? matches[2] || true : '';
    },

    /**
     * Retrieves a name/value list of modifiers
     * @private
     * @param {Array} [modNames] Names of modifiers
     * @param {Object} [elem] Element
     * @returns {Object} Hash of modifier values by names
     */
    _extractMods : function(modNames, elem) {
        var res = {},
            extractAll = !modNames.length,
            countMatched = 0;

        ((elem || this.domElem)[0].className
            .match(this.__self._buildModValRE(
                '(' + (extractAll? NAME_PATTERN : modNames.join('|')) + ')',
                elem,
                'g')) || []).forEach(function(className) {
                    var matches = className.match(EXTRACT_MODS_RE);
                    res[matches[1]] = matches[2] || true;
                    ++countMatched;
                });

        // empty modifier values are not reflected in classes; they must be filled with empty values
        countMatched < modNames.length && modNames.forEach(function(modName) {
            modName in res || (res[modName] = '');
        });

        return res;
    },

    /**
     * Sets a modifier's CSS class for a block's DOM element or nested element
     * @private
     * @param {String} modName Modifier name
     * @param {String} modVal Modifier value
     * @param {String} oldModVal Old modifier value
     * @param {jQuery} [elem] Element
     * @param {String} [elemName] Element name
     */
    _onSetMod : function(modName, modVal, oldModVal, elem, elemName) {
        if(modName !== 'js' || modVal !== '') {
            var _self = this.__self,
                classPrefix = _self._buildModClassPrefix(modName, elemName),
                classRE = _self._buildModValRE(modName, elemName),
                needDel = modVal === '' || modVal === false;

            (elem || this.domElem).each(function() {
                var className = this.className,
                    modClassName = classPrefix;

                modVal !== true && (modClassName += MOD_DELIM + modVal);

                (oldModVal === true?
                    classRE.test(className) :
                    (' ' + className).indexOf(' ' + classPrefix + MOD_DELIM) > -1)?
                        this.className = className.replace(
                            classRE,
                            (needDel? '' : '$1' + modClassName)) :
                        needDel || $(this).addClass(modClassName);
            });

            elemName && this
                .dropElemCache(elemName, modName, oldModVal)
                .dropElemCache(elemName, modName, modVal);
        }

        this.__base.apply(this, arguments);
    },

    /**
     * Finds elements nested in a block
     * @param {jQuery} [ctx=this.domElem] Element where search is being performed
     * @param {String} names Nested element name (or names separated by spaces)
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @param {Boolean} [strictMode=false]
     * @returns {jQuery} DOM elements
     */
    findElem : function(ctx, names, modName, modVal, strictMode) {
        if(typeof ctx === 'string') {
            strictMode = modVal;
            modVal = modName;
            modName = names;
            names = ctx;
            ctx = this.domElem;
        }

        if(typeof modName === 'boolean') {
            strictMode = modName;
            modName = undef;
        }

        names = names.split(' ');

        var _self = this.__self,
            modPostfix = buildModPostfix(modName, modVal),
            selectors = [],
            keys = names.map(function(name) {
                selectors.push(_self.buildSelector(name, modName, modVal));
                return name + modPostfix;
            }),
            isSingleName = keys.length === 1,
            res = findDomElem(ctx, selectors.join(','));

        // caching results if possible
        ctx === this.domElem &&
            selectors.forEach(function(selector, i) {
                (this._elemCache[keys[i]] = isSingleName? res : res.filter(selector))
                    .__bemElemName = names[i];
            }, this);

        return strictMode? this._filterFindElemResults(res) : res;
    },

    /**
     * Filters results of findElem helper execution in strict mode
     * @param {jQuery} res DOM elements
     * @returns {jQuery} DOM elements
     */
    _filterFindElemResults : function(res) {
        var blockSelector = this.buildSelector(),
            domElem = this.domElem;
        return res.filter(function() {
            return domElem.index($(this).closest(blockSelector)) > -1;
        });
    },

    /**
     * Finds elements nested in a block
     * @private
     * @param {String} name Nested element name
     * @param {String} [modName] Modifier name
     * @param {String|Boolean} [modVal] Modifier value
     * @returns {jQuery} DOM elements
     */
    _elem : function(name, modName, modVal) {
        return this._elemCache[name + buildModPostfix(modName, modVal)] ||
            this.findElem(name, modName, modVal);
    },

    /**
     * Lazy search for elements nested in a block (caches results)
     * @param {String} names Nested element name (or names separated by spaces)
     * @param {String} [modName] Modifier name
     * @param {String|Boolean} [modVal=true] Modifier value
     * @returns {jQuery} DOM elements
     */
    elem : function(names, modName, modVal) {
        if(arguments.length === 2) {
            modVal = true;
        }

        if(modName && typeof modName !== 'string') {
            modName.__bemElemName = names;
            return modName;
        }

        if(names.indexOf(' ') < 0) {
            return this._elem(names, modName, modVal);
        }

        var res = $([]);
        names.split(' ').forEach(function(name) {
            res = res.add(this._elem(name, modName, modVal));
        }, this);
        return res;
    },

    /**
     * Finds elements outside the context
     * @param {jQuery} ctx context
     * @param {String} elemName Element name
     * @returns {jQuery} DOM elements
     */
    closestElem : function(ctx, elemName) {
        return ctx.closest(this.buildSelector(elemName));
    },

    /**
     * Clearing the cache for elements
     * @protected
     * @param {String} [names] Nested element name (or names separated by spaces)
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {BEMDOM} this
     */
    dropElemCache : function(names, modName, modVal) {
        if(names) {
            var modPostfix = buildModPostfix(modName, modVal);
            names.indexOf(' ') < 0?
                delete this._elemCache[names + modPostfix] :
                names.split(' ').forEach(function(name) {
                    delete this._elemCache[name + modPostfix];
                }, this);
        } else {
            this._elemCache = {};
        }

        return this;
    },

    /**
     * Retrieves parameters of a block element
     * @param {String|jQuery} elem Element
     * @returns {Object} Parameters
     */
    elemParams : function(elem) {
        var elemName;
        if(typeof elem === 'string') {
            elemName = elem;
            elem = this.elem(elem);
        } else {
            elemName = this.__self._extractElemNameFrom(elem);
        }

        return extractParams(elem[0])[this.__self.buildClass(elemName)] || {};
    },

    /**
     * Elemify given element
     * @param {jQuery} elem Element
     * @param {String} elemName Name
     * @returns {jQuery}
     */
    elemify : function(elem, elemName) {
        (elem = $(elem)).__bemElemName = elemName;
        return elem;
    },

    /**
     * Checks whether a DOM element is in a block
     * @protected
     * @param {jQuery} [ctx=this.domElem] Element where check is being performed
     * @param {jQuery} domElem DOM element
     * @returns {Boolean}
     */
    containsDomElem : function(ctx, domElem) {
        if(arguments.length === 1) {
            domElem = ctx;
            ctx = this.domElem;
        }

        return dom.contains(ctx, domElem);
    },

    /**
     * Builds a CSS selector corresponding to a block/element and modifier
     * @param {String} [elem] Element name
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {String}
     */
    buildSelector : function(elem, modName, modVal) {
        return this.__self.buildSelector(elem, modName, modVal);
    },

    /**
     * Destructs a block
     * @private
     */
    _destruct : function() {
        var _this = this,
            _self = _this.__self;

        _this._needSpecialUnbind && _self.doc.add(_self.win).unbind('.' + _this._uniqId);

        _this.__base();

        delete uniqIdToBlock[_this.un()._uniqId];
    }

}, /** @lends BEMDOM */{

    /**
     * Scope
     * @type jQuery
     */
    scope : $('body'),

    /**
     * Document shortcut
     * @type jQuery
     */
    doc : doc,

    /**
     * Window shortcut
     * @type jQuery
     */
    win : win,

    /**
     * Processes a block's live properties
     * @private
     * @param {Boolean} [heedLive=false] Whether to take into account that the block already processed its live properties
     * @returns {Boolean} Whether the block is a live block
     */
    _processLive : function(heedLive) {
        var res = this._liveInitable;

        if('live' in this) {
            var noLive = typeof res === 'undefined';

            if(noLive ^ heedLive) { // should be opposite to each other
                res = this.live() !== false;

                var blockName = this.getName(),
                    origLive = this.live;

                this.live = function() {
                    return this.getName() === blockName?
                        res :
                        origLive.apply(this, arguments);
                };
            }
        }

        return res;
    },

    /**
     * Initializes blocks on a fragment of the DOM tree
     * @param {jQuery|String} [ctx=scope] Root DOM node
     * @returns {jQuery} ctx Initialization context
     */
    init : function(ctx) {
        if(typeof ctx === 'string') {
            ctx = $(ctx);
        } else if(!ctx) ctx = DOM.scope;

        var uniqInitId = identify();
        findDomElem(ctx, BEM_SELECTOR).each(function() {
            initBlocks($(this), uniqInitId);
        });

        this._runInitFns();

        return ctx;
    },

    /**
     * @param {jQuery} ctx Root DOM node
     * @param {Boolean} [excludeSelf=false] Exclude the main domElem
     * @param {Boolean} [destructDom=false] Remove DOM node during destruction
     * @private
     */
    _destruct : function(ctx, excludeSelf, destructDom) {
        var _ctx;
        if(excludeSelf) {
            storeDomNodeParents(_ctx = ctx.children());
            destructDom && ctx.empty();
        } else {
            storeDomNodeParents(_ctx = ctx);
            destructDom && ctx.remove();
        }

        reverse.call(findDomElem(_ctx, BEM_SELECTOR)).each(function(_, domNode) {
            var params = getParams(domNode);
            objects.each(params, function(blockParams) {
                if(blockParams.uniqId) {
                    var block = uniqIdToBlock[blockParams.uniqId];
                    block?
                        removeDomNodeFromBlock(block, domNode) :
                        delete uniqIdToDomElems[blockParams.uniqId];
                }
            });
            delete domElemToParams[identify(domNode)];
        });
    },

    /**
     * Destroys blocks on a fragment of the DOM tree
     * @param {jQuery} ctx Root DOM node
     * @param {Boolean} [excludeSelf=false] Exclude the main domElem
     */
    destruct : function(ctx, excludeSelf) {
        this._destruct(ctx, excludeSelf, true);
    },

    /**
     * Detaches blocks on a fragment of the DOM tree without destructing DOM tree
     * @param {jQuery} ctx Root DOM node
     * @param {Boolean} [excludeSelf=false] Exclude the main domElem
     */
    detach : function(ctx, excludeSelf) {
        this._destruct(ctx, excludeSelf);
    },

    /**
     * Replaces a fragment of the DOM tree inside the context, destroying old blocks and intializing new ones
     * @param {jQuery} ctx Root DOM node
     * @param {jQuery|String} content New content
     * @returns {jQuery} Updated root DOM node
     */
    update : function(ctx, content) {
        this.destruct(ctx, true);
        return this.init(ctx.html(content));
    },

    /**
     * Changes a fragment of the DOM tree including the context and initializes blocks.
     * @param {jQuery} ctx Root DOM node
     * @param {jQuery|String} content Content to be added
     * @returns {jQuery} New content
     */
    replace : function(ctx, content) {
        var prev = ctx.prev(),
            parent = ctx.parent();

        content = getJqueryCollection(content);

        this.destruct(ctx);

        return this.init(prev.length?
            content.insertAfter(prev) :
            content.prependTo(parent));
    },

    /**
     * Adds a fragment of the DOM tree at the end of the context and initializes blocks
     * @param {jQuery} ctx Root DOM node
     * @param {jQuery|String} content Content to be added
     * @returns {jQuery} New content
     */
    append : function(ctx, content) {
        return this.init(getJqueryCollection(content).appendTo(ctx));
    },

    /**
     * Adds a fragment of the DOM tree at the beginning of the context and initializes blocks
     * @param {jQuery} ctx Root DOM node
     * @param {jQuery|String} content Content to be added
     * @returns {jQuery} New content
     */
    prepend : function(ctx, content) {
        return this.init(getJqueryCollection(content).prependTo(ctx));
    },

    /**
     * Adds a fragment of the DOM tree before the context and initializes blocks
     * @param {jQuery} ctx Contextual DOM node
     * @param {jQuery|String} content Content to be added
     * @returns {jQuery} New content
     */
    before : function(ctx, content) {
        return this.init(getJqueryCollection(content).insertBefore(ctx));
    },

    /**
     * Adds a fragment of the DOM tree after the context and initializes blocks
     * @param {jQuery} ctx Contextual DOM node
     * @param {jQuery|String} content Content to be added
     * @returns {jQuery} New content
     */
    after : function(ctx, content) {
        return this.init(getJqueryCollection(content).insertAfter(ctx));
    },

    /**
     * Builds a full name for a live event
     * @private
     * @param {String} e Event name
     * @returns {String}
     */
    _buildCtxEventName : function(e) {
        return this._name + ':' + e;
    },

    _liveClassBind : function(className, e, callback, invokeOnInit) {
        if(e.indexOf(' ') > -1) {
            e.split(' ').forEach(function(e) {
                this._liveClassBind(className, e, callback, invokeOnInit);
            }, this);
        } else {
            var storage = liveClassEventStorage[e],
                uniqId = identify(callback);

            if(!storage) {
                storage = liveClassEventStorage[e] = {};
                DOM.scope.bind(e, $.proxy(this._liveClassTrigger, this));
            }

            storage = storage[className] || (storage[className] = { uniqIds : {}, fns : [] });

            if(!(uniqId in storage.uniqIds)) {
                storage.fns.push({ uniqId : uniqId, fn : this._buildLiveEventFn(callback, invokeOnInit) });
                storage.uniqIds[uniqId] = storage.fns.length - 1;
            }
        }

        return this;
    },

    _liveClassUnbind : function(className, e, callback) {
        var storage = liveClassEventStorage[e];
        if(storage) {
            if(callback) {
                if(storage = storage[className]) {
                    var uniqId = identify(callback);
                    if(uniqId in storage.uniqIds) {
                        var i = storage.uniqIds[uniqId],
                            len = storage.fns.length - 1;
                        storage.fns.splice(i, 1);
                        while(i < len) storage.uniqIds[storage.fns[i++].uniqId] = i - 1;
                        delete storage.uniqIds[uniqId];
                    }
                }
            } else {
                delete storage[className];
            }
        }

        return this;
    },

    _liveClassTrigger : function(e) {
        var storage = liveClassEventStorage[e.type];
        if(storage) {
            var node = e.target, classNames = [];
            for(var className in storage) {
                classNames.push(className);
            }
            do {
                var nodeClassName = ' ' + node.className + ' ', i = 0;
                while(className = classNames[i++]) {
                    if(nodeClassName.indexOf(' ' + className + ' ') > -1) {
                        var j = 0, fns = storage[className].fns, fn, stopPropagationAndPreventDefault = false;
                        while(fn = fns[j++])
                            if(fn.fn.call($(node), e) === false) stopPropagationAndPreventDefault = true;

                        stopPropagationAndPreventDefault && e.preventDefault();
                        if(stopPropagationAndPreventDefault || e.isPropagationStopped()) return;

                        classNames.splice(--i, 1);
                    }
                }
            } while(classNames.length && (node = node.parentNode));
        }
    },

    _buildLiveEventFn : function(callback, invokeOnInit) {
        var _this = this;
        return function(e) {
            e.currentTarget = this;
            var args = [
                    _this._name,
                    $(this).closest(_this.buildSelector()),
                    undef,
                    true
                ],
                block = initBlock.apply(null, invokeOnInit? args.concat([callback, e]) : args);

            if(block && !invokeOnInit && callback)
                return callback.apply(block, arguments);
        };
    },

    /**
     * Helper for live initialization for an event on DOM elements of a block or its elements
     * @protected
     * @param {String} [elemName] Element name or names (separated by spaces)
     * @param {String} event Event name
     * @param {Function} [callback] Handler to call after successful initialization
     */
    liveInitOnEvent : function(elemName, event, callback) {
        return this.liveBindTo(elemName, event, callback, true);
    },

    /**
     * Helper for subscribing to live events on DOM elements of a block or its elements
     * @protected
     * @param {String|Object} [to] Description (object with modName, modVal, elem) or name of the element or elements (space-separated)
     * @param {String} event Event name
     * @param {Function} [callback] Handler
     */
    liveBindTo : function(to, event, callback, invokeOnInit) {
        if(!event || functions.isFunction(event)) {
            callback = event;
            event = to;
            to = undef;
        }

        if(!to || typeof to === 'string') {
            to = { elem : to };
        }

        if(to.elem && to.elem.indexOf(' ') > 0) {
            to.elem.split(' ').forEach(function(elem) {
                this._liveClassBind(
                    this.buildClass(elem, to.modName, to.modVal),
                    event,
                    callback,
                    invokeOnInit);
            }, this);
            return this;
        }

        return this._liveClassBind(
            this.buildClass(to.elem, to.modName, to.modVal),
            event,
            callback,
            invokeOnInit);
    },

    /**
     * Helper for unsubscribing from live events on DOM elements of a block or its elements
     * @protected
     * @param {String} [elem] Name of the element or elements (space-separated)
     * @param {String} event Event name
     * @param {Function} [callback] Handler
     */
    liveUnbindFrom : function(elem, event, callback) {

        if(!event || functions.isFunction(event)) {
            callback = event;
            event = elem;
            elem = undef;
        }

        if(elem && elem.indexOf(' ') > 1) {
            elem.split(' ').forEach(function(elem) {
                this._liveClassUnbind(
                    this.buildClass(elem),
                    event,
                    callback);
            }, this);
            return this;
        }

        return this._liveClassUnbind(
            this.buildClass(elem),
            event,
            callback);
    },

    /**
     * Helper for live initialization when a different block is initialized
     * @private
     * @param {String} event Event name
     * @param {String} blockName Name of the block that should trigger a reaction when initialized
     * @param {Function} callback Handler to be called after successful initialization in the new block's context
     * @param {String} findFnName Name of the method for searching
     */
    _liveInitOnBlockEvent : function(event, blockName, callback, findFnName) {
        var name = this._name;
        blocks[blockName].on(event, function(e) {
            var args = arguments,
                blocks = e.target[findFnName](name);

            callback && blocks.forEach(function(block) {
                callback.apply(block, args);
            });
        });
        return this;
    },

    /**
     * Helper for live initialization for a different block's event on the current block's DOM element
     * @protected
     * @param {String} event Event name
     * @param {String} blockName Name of the block that should trigger a reaction when initialized
     * @param {Function} callback Handler to be called after successful initialization in the new block's context
     */
    liveInitOnBlockEvent : function(event, blockName, callback) {
        return this._liveInitOnBlockEvent(event, blockName, callback, 'findBlocksOn');
    },

    /**
     * Helper for live initialization for a different block's event inside the current block
     * @protected
     * @param {String} event Event name
     * @param {String} blockName Name of the block that should trigger a reaction when initialized
     * @param {Function} [callback] Handler to be called after successful initialization in the new block's context
     */
    liveInitOnBlockInsideEvent : function(event, blockName, callback) {
        return this._liveInitOnBlockEvent(event, blockName, callback, 'findBlocksOutside');
    },

    /**
     * Adds a live event handler to a block, based on a specified element where the event will be listened for
     * @param {jQuery} [ctx] The element in which the event will be listened for
     * @param {String} e Event name
     * @param {Object} [data] Additional information that the handler gets as e.data
     * @param {Function} fn Handler
     * @param {Object} [fnCtx] Handler's context
     */
    on : function(ctx, e, data, fn, fnCtx) {
        return typeof ctx === 'object' && ctx.jquery?
            this._liveCtxBind(ctx, e, data, fn, fnCtx) :
            this.__base(ctx, e, data, fn);
    },

    /**
     * Removes the live event handler from a block, based on a specified element where the event was being listened for
     * @param {jQuery} [ctx] The element in which the event was being listened for
     * @param {String} e Event name
     * @param {Function} [fn] Handler
     * @param {Object} [fnCtx] Handler context
     */
    un : function(ctx, e, fn, fnCtx) {
        return typeof ctx === 'object' && ctx.jquery?
            this._liveCtxUnbind(ctx, e, fn, fnCtx) :
            this.__base(ctx, e, fn);
    },

    /**
     * Adds a live event handler to a block, based on a specified element where the event will be listened for
     * @private
     * @param {jQuery} ctx The element in which the event will be listened for
     * @param {String} e  Event name
     * @param {Object} [data] Additional information that the handler gets as e.data
     * @param {Function} fn Handler
     * @param {Object} [fnCtx] Handler context
     * @returns {BEMDOM} this
     */
    _liveCtxBind : function(ctx, e, data, fn, fnCtx) {
        if(typeof e === 'object') {
            if(functions.isFunction(data) || functions.isFunction(fn)) { // mod change event
                e = this._buildModEventName(e);
            } else {
                objects.each(e, function(fn, e) {
                    this._liveCtxBind(ctx, e, fn, data);
                }, this);
                return this;
            }
        }

        if(functions.isFunction(data)) {
            fnCtx = fn;
            fn = data;
            data = undef;
        }

        if(e.indexOf(' ') > -1) {
            e.split(' ').forEach(function(e) {
                this._liveCtxBind(ctx, e, data, fn, fnCtx);
            }, this);
        } else {
            var ctxE = this._buildCtxEventName(e),
                storage = liveEventCtxStorage[ctxE] ||
                    (liveEventCtxStorage[ctxE] = { counter : 0, ctxs : {} });

            ctx.each(function() {
                var ctxId = identify(this),
                    ctxStorage = storage.ctxs[ctxId];
                if(!ctxStorage) {
                    ctxStorage = storage.ctxs[ctxId] = {};
                    ++storage.counter;
                }
                ctxStorage[identify(fn) + (fnCtx? identify(fnCtx) : '')] = {
                    fn : fn,
                    data : data,
                    ctx : fnCtx
                };
            });
        }

        return this;
    },

    /**
     * Removes a live event handler from a block, based on a specified element where the event was being listened for
     * @private
     * @param {jQuery} ctx The element in which the event was being listened for
     * @param {String|Object} e Event name
     * @param {Function} [fn] Handler
     * @param {Object} [fnCtx] Handler context
     */
    _liveCtxUnbind : function(ctx, e, fn, fnCtx) {
        if(typeof e === 'object' && functions.isFunction(fn)) { // mod change event
            e = this._buildModEventName(e);
        }

        var storage = liveEventCtxStorage[e = this._buildCtxEventName(e)];

        if(storage) {
            ctx.each(function() {
                var ctxId = identify(this, true),
                    ctxStorage;
                if(ctxId && (ctxStorage = storage.ctxs[ctxId])) {
                    fn && delete ctxStorage[identify(fn) + (fnCtx? identify(fnCtx) : '')];
                    if(!fn || objects.isEmpty(ctxStorage)) {
                        storage.counter--;
                        delete storage.ctxs[ctxId];
                    }
                }
            });
            storage.counter || delete liveEventCtxStorage[e];
        }

        return this;
    },

    /**
     * Retrieves the name of an element nested in a block
     * @private
     * @param {jQuery} elem Nested element
     * @returns {String|undef}
     */
    _extractElemNameFrom : function(elem) {
        if(elem.__bemElemName) return elem.__bemElemName;

        var matches = elem[0].className.match(this._buildElemNameRE());
        return matches? matches[1] : undef;
    },

    /**
     * Builds a prefix for the CSS class of a DOM element or nested element of the block, based on modifier name
     * @private
     * @param {String} modName Modifier name
     * @param {jQuery|String} [elem] Element
     * @returns {String}
     */
    _buildModClassPrefix : function(modName, elem) {
        return this._name +
               (elem?
                   ELEM_DELIM + (typeof elem === 'string'? elem : this._extractElemNameFrom(elem)) :
                   '') +
               MOD_DELIM + modName;
    },

    /**
     * Builds a regular expression for extracting modifier values from a DOM element or nested element of a block
     * @private
     * @param {String} modName Modifier name
     * @param {jQuery|String} [elem] Element
     * @param {String} [quantifiers] Regular expression quantifiers
     * @returns {RegExp}
     */
    _buildModValRE : function(modName, elem, quantifiers) {
        return new RegExp(
            '(\\s|^)' +
            this._buildModClassPrefix(modName, elem) +
            '(?:' + MOD_DELIM + '(' + NAME_PATTERN + '))?(?=\\s|$)',
            quantifiers);
    },

    /**
     * Builds a regular expression for extracting names of elements nested in a block
     * @private
     * @returns {RegExp}
     */
    _buildElemNameRE : function() {
        return new RegExp(this._name + ELEM_DELIM + '(' + NAME_PATTERN + ')(?:\\s|$)');
    },

    /**
     * Builds a CSS class corresponding to the block/element and modifier
     * @param {String} [elem] Element name
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {String}
     */
    buildClass : function(elem, modName, modVal) {
        return buildClass(this._name, elem, modName, modVal);
    },

    /**
     * Builds a CSS selector corresponding to the block/element and modifier
     * @param {String} [elem] Element name
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {String}
     */
    buildSelector : function(elem, modName, modVal) {
        return '.' + this.buildClass(elem, modName, modVal);
    }
});

/**
 * Returns a block on a DOM element and initializes it if necessary
 * @param {String} blockName Block name
 * @param {Object} [params] Block parameters
 * @returns {BEMDOM}
 */
$.fn.bem = function(blockName, params) {
    return initBlock(blockName, this, params, true)._init();
};

provide(DOM);

});

});

(function() {

var origDefine = modules.define;

modules.define = function(name, deps, decl) {
    origDefine.apply(modules, arguments);

    name !== 'i-bem__dom_init' && arguments.length > 2 && ~deps.indexOf('i-bem__dom') &&
        modules.define('i-bem__dom_init', [name], function(provide, _, prev) {
            provide(prev);
        });
};

})();

/* end: ../../common.blocks/i-bem/__dom/i-bem__dom.js */
/* begin: ../../common.blocks/i-bem/__dom/_init/i-bem__dom_init.js */
/**
 * @module i-bem__dom_init
 */

modules.define('i-bem__dom_init', ['i-bem__dom'], function(provide, BEMDOM) {

provide(
    /**
     * Initializes blocks on a fragment of the DOM tree
     * @exports
     * @param {jQuery} [ctx=scope] Root DOM node
     * @returns {jQuery} ctx Initialization context
     */
    function(ctx) {
        return BEMDOM.init(ctx);
    });
});

/* end: ../../common.blocks/i-bem/__dom/_init/i-bem__dom_init.js */
/* begin: ../../common.blocks/i-bem/__dom/_elem-instances/i-bem__dom_elem-instances.js */
/**
 * @module i-bem__dom
 */

modules.define(
    'i-bem__dom',
    ['i-bem', 'i-bem__internal', 'jquery'],
    function(provide, BEM, INTERNAL, $, BEMDOM) {

var buildClass = INTERNAL.buildClass,
    NAME_PATTERN = INTERNAL.NAME_PATTERN,
    MOD_DELIM = INTERNAL.MOD_DELIM,
    ELEM_DELIM = INTERNAL.ELEM_DELIM,
    blocks = BEM.blocks,
    slice = Array.prototype.slice;

/**
 * @class BEMDOM
 * @augments BEMDOM
 * @exports
 */
provide(BEMDOM.decl(/** @lends BEMDOM.prototype */{

    /**
     * Delegates native getMod helper to element's instance
     * @protected
     * @param {jQuery} [elem] Nested element
     * @param {String} modName Modifier name
     * @returns {String} Modifier value
     */
    getMod : function(elem, modName) {
        var elemClass;

        if(elem && modName && blocks[elemClass = this.__self._buildElemClass(elem)]) {
            return this.__base.call(this.findBlockOn(elem, elemClass), modName);
        }
        return this.__base(elem, modName);
    },

    /**
     * Delegates native getMods helper to element's instance
     * @protected
     * @param {jQuery} [elem] Nested element
     * @param {String} [modName1, ..., modNameN] Modifier names
     * @returns {Object} Hash of modifier values
     */
    getMods : function(elem) {
        var elemClass;

        if(elem && typeof elem !== 'string' && blocks[elemClass = this.__self._buildElemClass(elem)]) {
            return this.__base.apply(this.findBlockOn(elem, elemClass), slice.call(arguments, 1));
        }
        return this.__base.apply(this, arguments);
    },

    /**
     * Delegates native setMod helper to element's instances
     * @protected
     * @param {jQuery} [elem] Nested element
     * @param {String} modName Modifier name
     * @param {String} modVal Modifier value
     * @returns {BEM}
     */
    setMod : function(elem, modName, modVal) {
        var elemClass;

        if(elem && typeof modVal !== 'undefined' && blocks[elemClass = this.__self._buildElemClass(elem)]) {
            this
                .findBlocksOn(elem, elemClass)
                .forEach(function(instance) {
                    this.__base.call(instance, modName, modVal);
                }, this);
            return this;
        }
        return this.__base(elem, modName, modVal);
    },

    /**
     * Returns and initializes (if necessary) the own block of current element
     * @returns {BEMDOM}
     */
    block : function() {
        return this._block || (this._block = this.findBlockOutside(this.__self._blockName));
    },

    /**
     * Executes handlers for setting modifiers
     * If element sets modifier to itself, it executes onElemSetMod handlers of the own block
     * @private
     * @param {String} prefix
     * @param {String} elemName Element name
     * @param {String} modName Modifier name
     * @param {String} modVal Modifier value
     * @param {Array} modFnParams Handler parameters
     */
    _callModFn : function(prefix, elemName, modName, modVal, modFnParams) {
        var result = this.__base.apply(this, arguments),
            selfElemName = this.__self._elemName;

        if(selfElemName) {
            this.__base.call(
                this.block(),
                prefix,
                elemName || selfElemName,
                modName,
                modVal,
                elemName? modFnParams : [this.domElem].concat(modFnParams)
            ) === false && (result = false);
        }
        return result;
    },

    /**
     * Filters results of findElem helper execution in strict mode
     * @param {jQuery} res DOM elements
     * @returns {jQuery} DOM elements
     */
    _filterFindElemResults : function(res) {
        var _self = this.__self,
            blockSelector = '.' + _self._blockName,
            domElem = _self._elemName? this.domElem.closest(blockSelector) : this.domElem;
        return res.filter(function() {
            return domElem.index($(this).closest(blockSelector)) > -1;
        });
    },

    /**
     * Lazy search (caches results) for the first instance of defined element and intializes it (if necessary)
     * @param {String|jQuery} elem Element
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {BEMDOM}
     */
    elemInstance : function() {
        return this._elemInstances(arguments, 'elem', 'findBlockOn');
    },

    /**
     * Lazy search (caches results) for instances of defined elements and intializes it (if necessary)
     * @param {String|jQuery} elem Element
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {BEMDOM[]}
     */
    elemInstances : function() {
        return this._elemInstances(arguments, 'elem', 'findBlocksOn');
    },

    /**
     * Finds the first instance of defined element and intializes it (if necessary)
     * @param {jQuery} [ctx=this.domElem] Element where search is being performed
     * @param {String|jQuery} elem Element
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @param {Boolean} [strictMode=false]
     * @returns {BEMDOM}
     */
    findElemInstance : function() {
        return this._elemInstances(arguments, 'findElem', 'findBlockOn');
    },

    /**
     * Finds instances of defined elements and intializes it (if necessary)
     * @param {jQuery} [ctx=this.domElem] Element where search is being performed
     * @param {String|jQuery} elem Element
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @param {Boolean} [strictMode=false]
     * @returns {BEMDOM[]}
     */
    findElemInstances : function() {
        return this._elemInstances(arguments, 'findElem', 'findBlocksOn');
    },

    _elemInstances : function(args, findElemMethod, findBlockMethod) {
        var elem = args[0],
            isString = typeof elem === 'string',
            elemClass;

        if(args.length === 1 && !isString) {
            elemClass = this.__self._buildElemClass(elem);
        } else {
            elemClass = buildClass(this.__self._blockName, args[isString? 0 : 1]);
            elem = this[findElemMethod].apply(this, args);
        }
        return this[findBlockMethod](elem, elemClass);
    },

    /**
     * Finds elements outside the context or current element
     * @param {jQuery} [ctx=this.domElem] context (current element by default)
     * @param {String} elemName Element name
     * @returns {jQuery} DOM elements
     */
    closestElem : function(ctx, elemName) {
        if(!elemName) {
            elemName = ctx;
            ctx = this.domElem;
        }
        return this.__base(ctx, elemName);
    },

    /**
     * Finds instance of defined element outside the context or current element
     * @param {jQuery} [ctx=this.domElem] context (current element by default)
     * @param {String} elemName Element name
     * @returns {BEMDOM}
     */
    closestElemInstance : function(ctx, elemName) {
        return this.findBlockOn(
            this.closestElem.apply(this, arguments),
            buildClass(this.__self._blockName, elemName || ctx));
    },

    /**
     * Finds instances of defined elements outside the context or current element
     * @param {jQuery} [ctx=this.domElem] context (current element by default)
     * @param {String} elemName Element name
     * @returns {BEMDOM[]}
     */
    closestElemInstances : function(ctx, elemName) {
        return this.findBlocksOn(
            this.closestElem.apply(this, arguments),
            buildClass(this.__self._blockName, elemName || ctx));
    }

}, /** @lends BEMDOM */{

    /**
     * Auto-declarator for elements
     * @protected
     * @param {Object} name Instance name
     * @param {Object} [props] Methods
     * @param {Object} [staticProps] Static methods
     * @param {Object} [_autoDecl] Auto-declaration flag
     * @returns {Function}
     */
    decl : function(name, props, staticProps, _autoDecl) {
        if(_autoDecl) {
            var names = name.split(ELEM_DELIM);
            return this.__base({ block : names[0], elem : names[1] }, props, staticProps);
        } else {
            return this.__base.apply(this, arguments);
        }
    },

    /**
     * Helper for live initialization for an own block's event
     * @protected
     * @param {String} event Event name
     * @param {Function} [callback] Handler to be called after successful initialization in the new element's context
     * @returns {Function} this
     */
    liveInitOnBlockEvent : function(event, callback) {
        return (typeof callback === 'string')?
            this.__base.apply(this, arguments) :
            this._liveInitOnOwnBlockEvent(event, callback);
    },

    _liveInitOnOwnBlockEvent : function(event, callback) {
        var name = this._elemName;
        blocks[this._blockName].on(event, function(e) {
            var args = arguments,
                elems = e.target.findElemInstances(name, true);

            callback && elems.forEach(function(elem) {
                callback.apply(elem, args);
            });
        });
        return this;
    },

    /**
     * Builds a CSS class corresponding to the element's instance with extraction it's name from the specified DOM element
     * @private
     * @param {jQuery} elem Element
     * @returns {String}
     */
    _buildElemClass : function(elem) {
        return buildClass(this._blockName, this._extractElemNameFrom(elem));
    },

    /**
     * Builds a CSS class corresponding to the block/element and modifier
     * @param {String} [elem] Element name
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {String}
     */
    buildClass : function(elem, modName, modVal) {
        return this._elemName && elem && (modVal || !modName)?
            buildClass(this._blockName, elem, modName, modVal) :
            buildClass(this._name, elem, modName, modVal);
    },

    /**
     * Builds a prefix for the CSS class of a DOM element or nested element of the block, based on modifier name
     * @private
     * @param {String} modName Modifier name
     * @param {jQuery|String} [elem] Element
     * @returns {String}
     */
    _buildModClassPrefix : function(modName, elem) {
        return (elem?
                   this._blockName + ELEM_DELIM + (typeof elem === 'string'? elem : this._extractElemNameFrom(elem)) :
                   this._name) +
               MOD_DELIM + modName;
    },

    /**
     * Builds a regular expression for extracting names of elements nested in a block
     * @private
     * @returns {RegExp}
     */
    _buildElemNameRE : function() {
        return new RegExp(this._blockName + ELEM_DELIM + '(' + NAME_PATTERN + ')(?:\\s|$)');
    }
}));

});

/* end: ../../common.blocks/i-bem/__dom/_elem-instances/i-bem__dom_elem-instances.js */
/* begin: ../../common.blocks/idle/idle.js */
/**
 * @module idle
 */

modules.define('idle', ['inherit', 'events', 'jquery'], function(provide, inherit, events, $) {

var IDLE_TIMEOUT = 3000,
    USER_EVENTS = 'mousemove keydown click',
    /**
     * @class Idle
     * @augments events:Emitter
     */
    Idle = inherit(events.Emitter, /** @lends Idle.prototype */{
        /**
         * @constructor
         */
        __constructor : function() {
            this._timer = null;
            this._isStarted = false;
            this._isIdle = false;
        },

        /**
         * Starts monitoring of idle state
         */
        start : function() {
            if(!this._isStarted) {
                this._isStarted = true;
                this._startTimer();
                $(document).on(USER_EVENTS, $.proxy(this._onUserAction, this));
            }
        },

        /**
         * Stops monitoring of idle state
         */
        stop : function() {
            if(this._isStarted) {
                this._isStarted = false;
                this._stopTimer();
                $(document).off(USER_EVENTS, this._onUserAction);
            }
        },

        /**
         * Returns whether state is idle
         * @returns {Boolean}
         */
        isIdle : function() {
            return this._isIdle;
        },

        _onUserAction : function() {
            if(this._isIdle) {
                this._isIdle = false;
                this.emit('wakeup');
            }

            this._stopTimer();
            this._startTimer();
        },

        _startTimer : function() {
            var _this = this;
            this._timer = setTimeout(
                function() {
                    _this._onTimeout();
                },
                IDLE_TIMEOUT);
        },

        _stopTimer : function() {
            this._timer && clearTimeout(this._timer);
        },

        _onTimeout : function() {
            this._isIdle = true;
            this.emit('idle');
        }
    });

provide(
    /**
     * @exports
     * @type Idle
     */
    new Idle());

});

/* end: ../../common.blocks/idle/idle.js */
/* begin: ../../common.blocks/idle/_start/idle_start_auto.js */
/**
 * Automatically starts idle module
 */

modules.require(['idle'], function(idle) {

idle.start();

});

/* end: ../../common.blocks/idle/_start/idle_start_auto.js */
/* begin: ../../common.blocks/jquery/__event/_type/jquery__event_type_pointerclick.js */
modules.define('jquery', ['next-tick'], function(provide, nextTick, $) {

var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
    event = $.event.special.pointerclick = {
        setup : function() {
            if(isIOS) {
                $(this)
                    .on('pointerdown', event.onPointerdown)
                    .on('pointerup', event.onPointerup)
                    .on('pointerleave pointercancel', event.onPointerleave);
            } else {
                $(this).on('click', event.handler);
            }
        },

        teardown : function() {
            if(isIOS) {
                $(this)
                    .off('pointerdown', event.onPointerdown)
                    .off('pointerup', event.onPointerup)
                    .off('pointerleave pointercancel', event.onPointerleave);
            } else {
                $(this).off('click', event.handler);
            }
        },

        handler : function(e) {
            if(!e.button) {
                var type = e.type;
                e.type = 'pointerclick';
                $.event.dispatch.apply(this, arguments);
                e.type = type;
            }
        },

        onPointerdown : function(e) {
            pointerdownEvent = e;
        },

        onPointerleave : function() {
            pointerdownEvent = null;
        },

        onPointerup : function(e) {
            if(!pointerdownEvent) return;

            if(!pointerDownUpInProgress) {
                nextTick(function() {
                    pointerDownUpInProgress = false;
                    pointerdownEvent = null;
                });
                pointerDownUpInProgress = true;
            }

            event.handler.apply(this, arguments);
        }
    },
    pointerDownUpInProgress = false,
    pointerdownEvent;

provide($);

});

/* end: ../../common.blocks/jquery/__event/_type/jquery__event_type_pointerclick.js */
/* begin: ../../common.blocks/jquery/__event/_type/jquery__event_type_pointernative.js */
;(function(global, factory) {

if(typeof modules === 'object' && modules.isDefined('jquery')) {
    modules.define('jquery', function(provide, $) {
        factory(this.global, $);
        provide($);
    });
} else if(typeof jQuery === 'function') {
    factory(global, jQuery);
}

}(this, function(window, $) {

var jqEvent = $.event;

// NOTE: Remove jQuery special fixes for pointerevents – we fix them ourself
delete jqEvent.special.pointerenter;
delete jqEvent.special.pointerleave;

if(window.PointerEvent) {
    // Have native PointerEvent support, nothing to do than
    return;
}

/*!
 * Most of source code is taken from PointerEvents Polyfill
 * written by Polymer Team (https://github.com/Polymer/PointerEvents)
 * and licensed under the BSD License.
 */

var doc = document,
    HAS_BITMAP_TYPE = window.MSPointerEvent && typeof window.MSPointerEvent.MSPOINTER_TYPE_MOUSE === 'number',
    undef;

/*!
 * Returns a snapshot of the event, with writable properties.
 *
 * @param {Event} event An event that contains properties to copy.
 * @returns {Object} An object containing shallow copies of `inEvent`'s
 *    properties.
 */
function cloneEvent(event) {
    var eventCopy = $.extend(new $.Event(), event);
    if(event.preventDefault) {
        eventCopy.preventDefault = function() {
            event.preventDefault();
        };
    }
    return eventCopy;
}

/*!
 * Dispatches the event to the target, taking event's bubbling into account.
 */
function dispatchEvent(event, target) {
    return event.bubbles?
        jqEvent.trigger(event, null, target) :
        jqEvent.dispatch.call(target, event);
}

var MOUSE_PROPS = {
        bubbles : false,
        cancelable : false,
        view : null,
        detail : null,
        screenX : 0,
        screenY : 0,
        clientX : 0,
        clientY : 0,
        ctrlKey : false,
        altKey : false,
        shiftKey : false,
        metaKey : false,
        button : 0,
        relatedTarget : null,
        pageX : 0,
        pageY : 0
    },
    mouseProps = Object.keys(MOUSE_PROPS),
    mousePropsLen = mouseProps.length,
    mouseDefaults = mouseProps.map(function(prop) { return MOUSE_PROPS[prop] });

/*!
 * Pointer event constructor
 *
 * @param {String} type
 * @param {Object} [params]
 * @returns {Event}
 * @constructor
 */
function PointerEvent(type, params) {
    params || (params = {});

    var e = $.Event(type);

    // define inherited MouseEvent properties
    for(var i = 0, p; i < mousePropsLen; i++) {
        p = mouseProps[i];
        e[p] = params[p] || mouseDefaults[i];
    }

    e.buttons = params.buttons || 0;

    // add x/y properties aliased to clientX/Y
    e.x = e.clientX;
    e.y = e.clientY;

    // Spec requires that pointers without pressure specified use 0.5 for down
    // state and 0 for up state.
    var pressure = 0;
    if(params.pressure) {
        pressure = params.pressure;
    } else {
        pressure = e.buttons? 0.5 : 0;
    }

    // define the properties of the PointerEvent interface
    e.pointerId = params.pointerId || 0;
    e.width = params.width || 0;
    e.height = params.height || 0;
    e.pressure = pressure;
    e.tiltX = params.tiltX || 0;
    e.tiltY = params.tiltY || 0;
    e.pointerType = params.pointerType || '';
    e.hwTimestamp = params.hwTimestamp || 0;
    e.isPrimary = params.isPrimary || false;

    // add some common jQuery properties
    e.which = typeof params.which === 'undefined'? 1 : params.which;

    return e;
}

function SparseArrayMap() {
    this.array = [];
    this.size = 0;
}

SparseArrayMap.prototype = {
    set : function(k, v) {
        if(v === undef) {
            return this['delete'](k);
        }
        if(!this.has(k)) {
            this.size++;
        }
        this.array[k] = v;
    },

    has : function(k) {
        return this.array[k] !== undef;
    },

    'delete' : function(k) {
        if(this.has(k)){
            delete this.array[k];
            this.size--;
        }
    },

    get : function(k) {
        return this.array[k];
    },

    clear : function() {
        this.array.length = 0;
        this.size = 0;
    },

    // return value, key, map
    forEach : function(callback, ctx) {
        return this.array.forEach(function(v, k) {
            callback.call(ctx, v, k, this);
        }, this);
    }
};

// jscs:disable requireMultipleVarDecl
var PointerMap = window.Map && window.Map.prototype.forEach? Map : SparseArrayMap,
    pointerMap = new PointerMap();

var dispatcher = {
    eventMap : {},
    eventSourceList : [],

    /*!
     * Add a new event source that will generate pointer events
     */
    registerSource : function(name, source) {
        var newEvents = source.events;
        if(newEvents) {
            newEvents.forEach(function(e) {
                source[e] && (this.eventMap[e] = function() { source[e].apply(source, arguments) });
            }, this);
            this.eventSourceList.push(source);
        }
    },

    register : function(element) {
        var len = this.eventSourceList.length;
        for(var i = 0, es; (i < len) && (es = this.eventSourceList[i]); i++) {
            // call eventsource register
            es.register.call(es, element);
        }
    },

    unregister : function(element) {
        var l = this.eventSourceList.length;
        for(var i = 0, es; (i < l) && (es = this.eventSourceList[i]); i++) {
            // call eventsource register
            es.unregister.call(es, element);
        }
    },

    down : function(event) {
        event.bubbles = true;
        this.fireEvent('pointerdown', event);
    },

    move : function(event) {
        event.bubbles = true;
        this.fireEvent('pointermove', event);
    },

    up : function(event) {
        event.bubbles = true;
        this.fireEvent('pointerup', event);
    },

    enter : function(event) {
        event.bubbles = false;
        this.fireEvent('pointerenter', event);
    },

    leave : function(event) {
        event.bubbles = false;
        this.fireEvent('pointerleave', event);
    },

    over : function(event) {
        event.bubbles = true;
        this.fireEvent('pointerover', event);
    },

    out : function(event) {
        event.bubbles = true;
        this.fireEvent('pointerout', event);
    },

    cancel : function(event) {
        event.bubbles = true;
        this.fireEvent('pointercancel', event);
    },

    leaveOut : function(event) {
        this.out(event);
        this.enterLeave(event, this.leave);
    },

    enterOver : function(event) {
        this.over(event);
        this.enterLeave(event, this.enter);
    },

    enterLeave : function(event, fn) {
        var target = event.target,
            relatedTarget = event.relatedTarget;

        if(!this.contains(target, relatedTarget)) {
            while(target && target !== relatedTarget) {
                event.target = target;
                fn.call(this, event);

                target = target.parentNode;
            }
        }
    },

    contains : function(target, relatedTarget) {
        return target === relatedTarget || $.contains(target, relatedTarget);
    },

    // LISTENER LOGIC
    eventHandler : function(e) {
        // This is used to prevent multiple dispatch of pointerevents from
        // platform events. This can happen when two elements in different scopes
        // are set up to create pointer events, which is relevant to Shadow DOM.
        if(e._handledByPE) {
            return;
        }

        var type = e.type, fn;
        (fn = this.eventMap && this.eventMap[type]) && fn(e);

        e._handledByPE = true;
    },

    /*!
     * Sets up event listeners
     */
    listen : function(target, events) {
        events.forEach(function(e) {
            this.addEvent(target, e);
        }, this);
    },

    /*!
     * Removes event listeners
     */
    unlisten : function(target, events) {
        events.forEach(function(e) {
            this.removeEvent(target, e);
        }, this);
    },

    addEvent : function(target, eventName) {
        $(target).on(eventName, boundHandler);
    },

    removeEvent : function(target, eventName) {
        $(target).off(eventName, boundHandler);
    },

    getTarget : function(event) {
        return event._target;
    },

    /*!
     * Creates a new Event of type `type`, based on the information in `event`
     */
    makeEvent : function(type, event) {
        var e = new PointerEvent(type, event);
        if(event.preventDefault) {
            e.preventDefault = event.preventDefault;
        }

        e._target = e._target || event.target;

        return e;
    },

    /*!
     * Dispatches the event to its target
     */
    dispatchEvent : function(event) {
        var target = this.getTarget(event);
        if(target) {
            if(!event.target) {
                event.target = target;
            }

            return dispatchEvent(event, target);
        }
    },

    /*!
     * Makes and dispatch an event in one call
     */
    fireEvent : function(type, event) {
        var e = this.makeEvent(type, event);
        return this.dispatchEvent(e);
    }
};

function boundHandler() {
    dispatcher.eventHandler.apply(dispatcher, arguments);
}

var CLICK_COUNT_TIMEOUT = 200,
    // Radius around touchend that swallows mouse events
    MOUSE_DEDUP_DIST = 25,
    MOUSE_POINTER_ID = 1,
    // This should be long enough to ignore compat mouse events made by touch
    TOUCH_DEDUP_TIMEOUT = 2500,
    // A distance for which touchmove should fire pointercancel event
    TOUCHMOVE_HYSTERESIS = 20;

// handler block for native mouse events
var mouseEvents = {
    POINTER_TYPE : 'mouse',
    events : [
        'mousedown',
        'mousemove',
        'mouseup',
        'mouseover',
        'mouseout'
    ],

    register : function(target) {
        dispatcher.listen(target, this.events);
    },

    unregister : function(target) {
        dispatcher.unlisten(target, this.events);
    },

    lastTouches : [],

    // collide with the global mouse listener
    isEventSimulatedFromTouch : function(event) {
        var lts = this.lastTouches,
            x = event.clientX,
            y = event.clientY;

        for(var i = 0, l = lts.length, t; i < l && (t = lts[i]); i++) {
            // simulated mouse events will be swallowed near a primary touchend
            var dx = Math.abs(x - t.x), dy = Math.abs(y - t.y);
            if(dx <= MOUSE_DEDUP_DIST && dy <= MOUSE_DEDUP_DIST) {
                return true;
            }
        }
    },

    prepareEvent : function(event) {
        var e = cloneEvent(event);
        e.pointerId = MOUSE_POINTER_ID;
        e.isPrimary = true;
        e.pointerType = this.POINTER_TYPE;
        return e;
    },

    mousedown : function(event) {
        if(!this.isEventSimulatedFromTouch(event)) {
            if(pointerMap.has(MOUSE_POINTER_ID)) {
                // http://crbug/149091
                this.cancel(event);
            }

            pointerMap.set(MOUSE_POINTER_ID, event);

            var e = this.prepareEvent(event);
            dispatcher.down(e);
        }
    },

    mousemove : function(event) {
        if(!this.isEventSimulatedFromTouch(event)) {
            var e = this.prepareEvent(event);
            dispatcher.move(e);
        }
    },

    mouseup : function(event) {
        if(!this.isEventSimulatedFromTouch(event)) {
            var p = pointerMap.get(MOUSE_POINTER_ID);
            if(p && p.button === event.button) {
                var e = this.prepareEvent(event);
                dispatcher.up(e);
                this.cleanupMouse();
            }
        }
    },

    mouseover : function(event) {
        if(!this.isEventSimulatedFromTouch(event)) {
            var e = this.prepareEvent(event);
            dispatcher.enterOver(e);
        }
    },

    mouseout : function(event) {
        if(!this.isEventSimulatedFromTouch(event)) {
            var e = this.prepareEvent(event);
            dispatcher.leaveOut(e);
        }
    },

    cancel : function(inEvent) {
        var e = this.prepareEvent(inEvent);
        dispatcher.cancel(e);
        this.cleanupMouse();
    },

    cleanupMouse : function() {
        pointerMap['delete'](MOUSE_POINTER_ID);
    }
};

var touchEvents = {
    events : [
        'touchstart',
        'touchmove',
        'touchend',
        'touchcancel'
    ],

    register : function(target) {
        dispatcher.listen(target, this.events);
    },

    unregister : function(target) {
        dispatcher.unlisten(target, this.events);
    },

    POINTER_TYPE : 'touch',
    clickCount : 0,
    resetId : null,
    firstTouch : null,

    isPrimaryTouch : function(touch) {
        return this.firstTouch === touch.identifier;
    },

    /*!
     * Sets primary touch if there no pointers, or the only pointer is the mouse
     */
    setPrimaryTouch : function(touch) {
        if(pointerMap.size === 0 ||
                (pointerMap.size === 1 && pointerMap.has(MOUSE_POINTER_ID))) {
            this.firstTouch = touch.identifier;
            this.firstXY = { X : touch.clientX, Y : touch.clientY };
            this.scrolling = null;

            this.cancelResetClickCount();
        }
    },

    removePrimaryPointer : function(pointer) {
        if(pointer.isPrimary) {
            this.firstTouch = null;
            // TODO(@narqo): It seems that, flushing `firstXY` flag explicitly in `touchmove` handler is enough.
            // Original code from polymer doing `this.firstXY = null` on every `removePrimaryPointer` call, but looks
            // like it is harmful in some of our usecases.
            this.resetClickCount();
        }
    },

    resetClickCount : function() {
        var _this = this;
        this.resetId = setTimeout(function() {
            _this.clickCount = 0;
            _this.resetId = null;
        }, CLICK_COUNT_TIMEOUT);
    },

    cancelResetClickCount : function() {
        this.resetId && clearTimeout(this.resetId);
    },

    typeToButtons : function(type) {
        return type === 'touchstart' || type === 'touchmove'? 1 : 0;
    },

    findTarget : function(event) {
        // Currently we don't interested in shadow dom handling
        return doc.elementFromPoint(event.clientX, event.clientY);
    },

    touchToPointer : function(touch) {
        var cte = this.currentTouchEvent,
            e = cloneEvent(touch);

        // Spec specifies that pointerId 1 is reserved for Mouse.
        // Touch identifiers can start at 0.
        // Add 2 to the touch identifier for compatibility.
        e.pointerId = touch.identifier + 2;
        e.target = this.findTarget(e);
        e.bubbles = true;
        e.cancelable = true;
        e.detail = this.clickCount;
        e.button = 0;
        e.buttons = this.typeToButtons(cte.type);
        e.width = touch.webkitRadiusX || touch.radiusX || 0;
        e.height = touch.webkitRadiusY || touch.radiusY || 0;
        e.pressure = touch.mozPressure || touch.webkitForce || touch.force || 0.5;
        e.isPrimary = this.isPrimaryTouch(touch);
        e.pointerType = this.POINTER_TYPE;

        // forward touch preventDefaults
        var _this = this;
        e.preventDefault = function() {
            _this.scrolling = false;
            _this.firstXY = null;
            cte.preventDefault();
        };

        return e;
    },

    processTouches : function(event, fn) {
        var tl = event.originalEvent.changedTouches;
        this.currentTouchEvent = event;
        for(var i = 0, t; i < tl.length; i++) {
            t = tl[i];
            fn.call(this, this.touchToPointer(t));
        }
    },

    shouldScroll : function(touchEvent) {
        // return "true" for things to be much easier
        return true;
    },

    findTouch : function(touches, pointerId) {
        for(var i = 0, l = touches.length, t; i < l && (t = touches[i]); i++) {
            if(t.identifier === pointerId) {
                return true;
            }
        }
    },

    /*!
     * In some instances, a touchstart can happen without a touchend.
     * This leaves the pointermap in a broken state.
     * Therefore, on every touchstart, we remove the touches
     * that did not fire a touchend event.
     *
     * To keep state globally consistent, we fire a pointercancel
     * for this "abandoned" touch
     */
    vacuumTouches : function(touchEvent) {
        var touches = touchEvent.touches;
        // `pointermap.size` should be less than length of touches here, as the touchstart has not
        // been processed yet.
        if(pointerMap.size >= touches.length) {
            var d = [];

            pointerMap.forEach(function(pointer, pointerId) {
                // Never remove pointerId == 1, which is mouse.
                // Touch identifiers are 2 smaller than their pointerId, which is the
                // index in pointermap.
                if(pointerId === MOUSE_POINTER_ID || this.findTouch(touches, pointerId - 2)) return;
                d.push(pointer.outEvent);
            }, this);

            d.forEach(this.cancelOut, this);
        }
    },

    /*!
     * Prevents synth mouse events from creating pointer events
     */
    dedupSynthMouse : function(touchEvent) {
        var lts = mouseEvents.lastTouches,
            t = touchEvent.changedTouches[0];

        // only the primary finger will synth mouse events
        if(this.isPrimaryTouch(t)) {
            // remember x/y of last touch
            var lt = { x : t.clientX, y : t.clientY };
            lts.push(lt);

            setTimeout(function() {
                var i = lts.indexOf(lt);
                i > -1 && lts.splice(i, 1);
            }, TOUCH_DEDUP_TIMEOUT);
        }
    },

    touchstart : function(event) {
        var touchEvent = event.originalEvent;

        this.vacuumTouches(touchEvent);
        this.setPrimaryTouch(touchEvent.changedTouches[0]);
        this.dedupSynthMouse(touchEvent);

        if(!this.scrolling) {
            this.clickCount++;
            this.processTouches(event, this.overDown);
        }
    },

    touchmove : function(event) {
        var touchEvent = event.originalEvent;
        if(!this.scrolling) {
            if(this.scrolling === null && this.shouldScroll(touchEvent)) {
                this.scrolling = true;
            } else {
                event.preventDefault();
                this.processTouches(event, this.moveOverOut);
            }
        } else if(this.firstXY) {
            var firstXY = this.firstXY,
                touch = touchEvent.changedTouches[0],
                dx = touch.clientX - firstXY.X,
                dy = touch.clientY - firstXY.Y,
                dd = Math.sqrt(dx * dx + dy * dy);
            if(dd >= TOUCHMOVE_HYSTERESIS) {
                this.touchcancel(event);
                this.scrolling = true;
                this.firstXY = null;
            }
        }
    },

    touchend : function(event) {
        var touchEvent = event.originalEvent;
        this.dedupSynthMouse(touchEvent);
        this.processTouches(event, this.upOut);
    },

    touchcancel : function(event) {
        this.processTouches(event, this.cancelOut);
    },

    overDown : function(pEvent) {
        var target = pEvent.target;
        pointerMap.set(pEvent.pointerId, {
            target : target,
            outTarget : target,
            outEvent : pEvent
        });
        dispatcher.over(pEvent);
        dispatcher.enter(pEvent);
        dispatcher.down(pEvent);
    },

    moveOverOut : function(pEvent) {
        var pointer = pointerMap.get(pEvent.pointerId);

        // a finger drifted off the screen, ignore it
        if(!pointer) {
            return;
        }

        dispatcher.move(pEvent);

        var outEvent = pointer.outEvent,
            outTarget = pointer.outTarget;

        if(outEvent && outTarget !== pEvent.target) {
            pEvent.relatedTarget = outTarget;
            outEvent.relatedTarget = pEvent.target;
            // recover from retargeting by shadow
            outEvent.target = outTarget;

            if(pEvent.target) {
                dispatcher.leaveOut(outEvent);
                dispatcher.enterOver(pEvent);
            } else {
                // clean up case when finger leaves the screen
                pEvent.target = outTarget;
                pEvent.relatedTarget = null;
                this.cancelOut(pEvent);
            }
        }

        pointer.outEvent = pEvent;
        pointer.outTarget = pEvent.target;
    },

    upOut : function(pEvent) {
        dispatcher.up(pEvent);
        dispatcher.out(pEvent);
        dispatcher.leave(pEvent);

        this.cleanUpPointer(pEvent);
    },

    cancelOut : function(pEvent) {
        dispatcher.cancel(pEvent);
        dispatcher.out(pEvent);
        dispatcher.leave(pEvent);
        this.cleanUpPointer(pEvent);
    },

    cleanUpPointer : function(pEvent) {
        pointerMap['delete'](pEvent.pointerId);
        this.removePrimaryPointer(pEvent);
    }
};

var msEvents = {
    events : [
        'MSPointerDown',
        'MSPointerMove',
        'MSPointerUp',
        'MSPointerOut',
        'MSPointerOver',
        'MSPointerCancel'
    ],

    register : function(target) {
        dispatcher.listen(target, this.events);
    },

    unregister : function(target) {
        dispatcher.unlisten(target, this.events);
    },

    POINTER_TYPES : [
        '',
        'unavailable',
        'touch',
        'pen',
        'mouse'
    ],

    prepareEvent : function(event) {
        var e = cloneEvent(event);
        HAS_BITMAP_TYPE && (e.pointerType = this.POINTER_TYPES[event.pointerType]);
        return e;
    },

    MSPointerDown : function(event) {
        pointerMap.set(event.pointerId, event);
        var e = this.prepareEvent(event);
        dispatcher.down(e);
    },

    MSPointerMove : function(event) {
        var e = this.prepareEvent(event);
        dispatcher.move(e);
    },

    MSPointerUp : function(event) {
        var e = this.prepareEvent(event);
        dispatcher.up(e);
        this.cleanup(event.pointerId);
    },

    MSPointerOut : function(event) {
        var e = this.prepareEvent(event);
        dispatcher.leaveOut(e);
    },

    MSPointerOver : function(event) {
        var e = this.prepareEvent(event);
        dispatcher.enterOver(e);
    },

    MSPointerCancel : function(event) {
        var e = this.prepareEvent(event);
        dispatcher.cancel(e);
        this.cleanup(event.pointerId);
    },

    cleanup : function(id) {
        pointerMap['delete'](id);
    }
};

var navigator = window.navigator;
if(navigator.msPointerEnabled) {
    dispatcher.registerSource('ms', msEvents);
} else {
    dispatcher.registerSource('mouse', mouseEvents);
    if(typeof window.ontouchstart !== 'undefined') {
        dispatcher.registerSource('touch', touchEvents);
    }
}

dispatcher.register(doc);

}));

/* end: ../../common.blocks/jquery/__event/_type/jquery__event_type_pointernative.js */
/* begin: ../../common.blocks/keyboard/__codes/keyboard__codes.js */
/**
 * @module keyboard__codes
 */
modules.define('keyboard__codes', function(provide) {

provide(/** @exports */{
    /** @type {Number} */
    BACKSPACE : 8,
    /** @type {Number} */
    TAB : 9,
    /** @type {Number} */
    ENTER : 13,
    /** @type {Number} */
    CAPS_LOCK : 20,
    /** @type {Number} */
    ESC : 27,
    /** @type {Number} */
    SPACE : 32,
    /** @type {Number} */
    PAGE_UP : 33,
    /** @type {Number} */
    PAGE_DOWN : 34,
    /** @type {Number} */
    END : 35,
    /** @type {Number} */
    HOME : 36,
    /** @type {Number} */
    LEFT : 37,
    /** @type {Number} */
    UP : 38,
    /** @type {Number} */
    RIGHT : 39,
    /** @type {Number} */
    DOWN : 40,
    /** @type {Number} */
    INSERT : 45,
    /** @type {Number} */
    DELETE : 46
});

});

/* end: ../../common.blocks/keyboard/__codes/keyboard__codes.js */
/* begin: ../../common.blocks/loader/_type/loader_type_bundle.js */
/**
 * @module loader_type_bundle
 * @description Load BEM bundle (JS+CSS) from external URL.
 */

modules.define('loader_type_bundle', function(provide) {

var LOADING_TIMEOUT = 30000,
    global = this.global,
    doc = document,
    head,
    bundles = {},

    handleError = function(bundleId) {
        var bundleDesc = bundles[bundleId];

        if(!bundleDesc) return;

        var fns = bundleDesc.errorFns,
            fn;

        clearTimeout(bundleDesc.timer);

        while(fn = fns.shift()) fn();
        delete bundles[bundleId];
    },

    appendCss = function(css) {
        var style = doc.createElement('style');
        style.type = 'text/css';
        head.appendChild(style); // ie needs to insert style before setting content
        style.styleSheet?
            style.styleSheet.cssText = css :
            style.appendChild(doc.createTextNode(css));
    },

    /**
     * Loads bundle
     * @exports
     * @param {String} id
     * @param {String} url
     * @param {Function} onSuccess
     * @param {Function} [onError]
     */
    load = function(id, url, onSuccess, onError) {
        var bundle = bundles[id];
        if(bundle) {
            if(bundle.successFns) { // bundle is being loaded
                bundle.successFns.push(onSuccess);
                onError && bundle.errorFns.push(onError);
            } else { // bundle was loaded before
                setTimeout(onSuccess, 0);
            }
            return;
        }

        var script = doc.createElement('script'),
            errorFn = function() {
                handleError(id);
            };

        script.type = 'text/javascript';
        script.charset = 'utf-8';
        script.src = url;
        script.onerror = errorFn; // for browsers that support
        setTimeout(function() {
            (head || (head = doc.getElementsByTagName('head')[0])).insertBefore(script, head.firstChild);
        }, 0);

        bundles[id] = {
            successFns : [onSuccess],
            errorFns : onError? [onError] : [],
            timer : setTimeout(errorFn, LOADING_TIMEOUT)
        };
    };

load._loaded = function(bundle) {
    var bundleDesc = bundles[bundle.id];

    if(!bundleDesc) return;

    clearTimeout(bundleDesc.timer);

    bundle.js && bundle.js.call(global);

    bundle.css && appendCss(bundle.css);

    if(bundle.hcss) {
        var styles = [],
            _ycssjs = window._ycssjs;

        bundle.hcss.forEach(function(hsh) {
            if(_ycssjs) {
                if(hsh[0] in _ycssjs) return;
                _ycssjs(hsh[0]);
            }

            styles.push(hsh[1]);
        });

        styles.length && appendCss(styles.join(''));
    }

    function onSuccess() {
        var fns = bundleDesc.successFns, fn;
        while(fn = fns.shift()) fn();
        delete bundleDesc.successFns;
    }

    modules.isDefined('i-bem__dom_init')?
        modules.require(['i-bem__dom_init'], onSuccess) :
        onSuccess();
};

provide(load);

});

/* end: ../../common.blocks/loader/_type/loader_type_bundle.js */
/* begin: ../../common.blocks/querystring/querystring.vanilla.js */
/**
 * @module querystring
 * @description A set of helpers to work with query strings
 */

modules.define('querystring', ['querystring__uri'], function(provide, uri) {

var hasOwnProperty = Object.prototype.hasOwnProperty;

function addParam(res, name, val) {
    /* jshint eqnull: true */
    res.push(encodeURIComponent(name) + '=' + (val == null? '' : encodeURIComponent(val)));
}

provide(/** @exports */{
    /**
     * Parse a query string to an object
     * @param {String} str
     * @returns {Object}
     */
    parse : function(str) {
        if(!str) {
            return {};
        }

        return str.split('&').reduce(
            function(res, pair) {
                if(!pair) {
                    return res;
                }

                var eq = pair.indexOf('='),
                    name, val;

                if(eq >= 0) {
                    name = pair.substr(0, eq);
                    val = pair.substr(eq + 1);
                } else {
                    name = pair;
                    val = '';
                }

                name = uri.decodeURIComponent(name);
                val = uri.decodeURIComponent(val);

                hasOwnProperty.call(res, name)?
                    Array.isArray(res[name])?
                        res[name].push(val) :
                        res[name] = [res[name], val] :
                    res[name] = val;

                return res;
            },
            {});
    },

    /**
     * Serialize an object to a query string
     * @param {Object} obj
     * @returns {String}
     */
    stringify : function(obj) {
        return Object.keys(obj)
            .reduce(
                function(res, name) {
                    var val = obj[name];
                    Array.isArray(val)?
                        val.forEach(function(val) {
                            addParam(res, name, val);
                        }) :
                        addParam(res, name, val);
                    return res;
                },
                [])
            .join('&');
    }
});

});

/* end: ../../common.blocks/querystring/querystring.vanilla.js */
/* begin: ../../common.blocks/querystring/__uri/querystring__uri.vanilla.js */
/**
 * @module querystring__uri
 * @description A set of helpers to work with URI
 */

modules.define('querystring__uri',  function(provide) {

// Equivalency table for cp1251 and utf8.
var map = { '%D0' : '%D0%A0', '%C0' : '%D0%90', '%C1' : '%D0%91', '%C2' : '%D0%92', '%C3' : '%D0%93', '%C4' : '%D0%94', '%C5' : '%D0%95', '%A8' : '%D0%81', '%C6' : '%D0%96', '%C7' : '%D0%97', '%C8' : '%D0%98', '%C9' : '%D0%99', '%CA' : '%D0%9A', '%CB' : '%D0%9B', '%CC' : '%D0%9C', '%CD' : '%D0%9D', '%CE' : '%D0%9E', '%CF' : '%D0%9F', '%D1' : '%D0%A1', '%D2' : '%D0%A2', '%D3' : '%D0%A3', '%D4' : '%D0%A4', '%D5' : '%D0%A5', '%D6' : '%D0%A6', '%D7' : '%D0%A7', '%D8' : '%D0%A8', '%D9' : '%D0%A9', '%DA' : '%D0%AA', '%DB' : '%D0%AB', '%DC' : '%D0%AC', '%DD' : '%D0%AD', '%DE' : '%D0%AE', '%DF' : '%D0%AF', '%E0' : '%D0%B0', '%E1' : '%D0%B1', '%E2' : '%D0%B2', '%E3' : '%D0%B3', '%E4' : '%D0%B4', '%E5' : '%D0%B5', '%B8' : '%D1%91', '%E6' : '%D0%B6', '%E7' : '%D0%B7', '%E8' : '%D0%B8', '%E9' : '%D0%B9', '%EA' : '%D0%BA', '%EB' : '%D0%BB', '%EC' : '%D0%BC', '%ED' : '%D0%BD', '%EE' : '%D0%BE', '%EF' : '%D0%BF', '%F0' : '%D1%80', '%F1' : '%D1%81', '%F2' : '%D1%82', '%F3' : '%D1%83', '%F4' : '%D1%84', '%F5' : '%D1%85', '%F6' : '%D1%86', '%F7' : '%D1%87', '%F8' : '%D1%88', '%F9' : '%D1%89', '%FA' : '%D1%8A', '%FB' : '%D1%8B', '%FC' : '%D1%8C', '%FD' : '%D1%8D', '%FE' : '%D1%8E', '%FF' : '%D1%8F' };

function convert(str) {
    // Symbol code in cp1251 (hex) : symbol code in utf8)
    return str.replace(
        /%.{2}/g,
        function($0) {
            return map[$0] || $0;
        });
}

function decode(fn,  str) {
    var decoded = '';

    // Try/catch block for getting the encoding of the source string.
    // Error is thrown if a non-UTF8 string is input.
    // If the string was not decoded, it is returned without changes.
    try {
        decoded = fn(str);
    } catch (e1) {
        try {
            decoded = fn(convert(str));
        } catch (e2) {
            decoded = str;
        }
    }

    return decoded;
}

provide(/** @exports */{
    /**
     * Decodes URI string
     * @param {String} str
     * @returns {String}
     */
    decodeURI : function(str) {
        return decode(decodeURI,  str);
    },

    /**
     * Decodes URI component string
     * @param {String} str
     * @returns {String}
     */
    decodeURIComponent : function(str) {
        return decode(decodeURIComponent,  str);
    }
});

});

/* end: ../../common.blocks/querystring/__uri/querystring__uri.vanilla.js */
/* begin: ../../common.blocks/strings/__escape/strings__escape.vanilla.js */
/**
 * @module strings__escape
 * @description A set of string escaping functions
 */

modules.define('strings__escape', function(provide) {

var symbols = {
        '"' : '&quot;',
        '\'' : '&apos;',
        '&' : '&amp;',
        '<' : '&lt;',
        '>' : '&gt;'
    },
    mapSymbol = function(s) {
        return symbols[s] || s;
    },
    buildEscape = function(regexp) {
        regexp = new RegExp(regexp, 'g');
        return function(str) {
            return ('' + str).replace(regexp, mapSymbol);
        };
    };

provide(/** @exports */{
    /**
     * Escape string to use in XML
     * @type Function
     * @param {String} str
     * @returns {String}
     */
    xml : buildEscape('[&<>]'),

    /**
     * Escape string to use in HTML
     * @type Function
     * @param {String} str
     * @returns {String}
     */
    html : buildEscape('[&<>]'),

    /**
     * Escape string to use in attributes
     * @type Function
     * @param {String} str
     * @returns {String}
     */
    attr : buildEscape('["\'&<>]')
});

});

/* end: ../../common.blocks/strings/__escape/strings__escape.vanilla.js */
/* begin: ../../common.blocks/tick/tick.vanilla.js */
/**
 * @module tick
 * @description Helpers for polling anything
 */

modules.define('tick', ['inherit', 'events'], function(provide, inherit, events) {

var TICK_INTERVAL = 50,
    global = this.global,

    /**
     * @class Tick
     * @augments events:Emitter
     */
    Tick = inherit(events.Emitter, /** @lends Tick.prototype */{
        /**
         * @constructor
         */
        __constructor : function() {
            this._timer = null;
            this._isStarted = false;
        },

        /**
         * Starts polling
         */
        start : function() {
            if(!this._isStarted) {
                this._isStarted = true;
                this._scheduleTick();
            }
        },

        /**
         * Stops polling
         */
        stop : function() {
            if(this._isStarted) {
                this._isStarted = false;
                global.clearTimeout(this._timer);
            }
        },

        _scheduleTick : function() {
            var _this = this;
            this._timer = global.setTimeout(
                function() {
                    _this._onTick();
                },
                TICK_INTERVAL);
        },

        _onTick : function() {
            this.emit('tick');

            this._isStarted && this._scheduleTick();
        }
    });

provide(
    /**
     * @exports
     * @type Tick
     */
    new Tick());

});

/* end: ../../common.blocks/tick/tick.vanilla.js */
/* begin: ../../common.blocks/tick/_start/tick_start_auto.vanilla.js */
/**
 * Automatically starts tick module
 */

modules.require(['tick'], function(tick) {

tick.start();

});

/* end: ../../common.blocks/tick/_start/tick_start_auto.vanilla.js */
/* begin: ../../common.blocks/vow/vow.vanilla.js */
/**
 * @module vow
 * @author Filatov Dmitry <dfilatov@yandex-team.ru>
 * @version 0.4.10
 * @license
 * Dual licensed under the MIT and GPL licenses:
 *   * http://www.opensource.org/licenses/mit-license.php
 *   * http://www.gnu.org/licenses/gpl.html
 */

(function(global) {

var undef,
    nextTick = (function() {
        var fns = [],
            enqueueFn = function(fn) {
                return fns.push(fn) === 1;
            },
            callFns = function() {
                var fnsToCall = fns, i = 0, len = fns.length;
                fns = [];
                while(i < len) {
                    fnsToCall[i++]();
                }
            };

        if(typeof setImmediate === 'function') { // ie10, nodejs >= 0.10
            return function(fn) {
                enqueueFn(fn) && setImmediate(callFns);
            };
        }

        if(typeof process === 'object' && process.nextTick) { // nodejs < 0.10
            return function(fn) {
                enqueueFn(fn) && process.nextTick(callFns);
            };
        }

        var MutationObserver = global.MutationObserver || global.WebKitMutationObserver; // modern browsers
        if(MutationObserver) {
            var num = 1,
                node = document.createTextNode('');

            new MutationObserver(callFns).observe(node, { characterData : true });

            return function(fn) {
                enqueueFn(fn) && (node.data = (num *= -1));
            };
        }

        if(global.postMessage) {
            var isPostMessageAsync = true;
            if(global.attachEvent) {
                var checkAsync = function() {
                        isPostMessageAsync = false;
                    };
                global.attachEvent('onmessage', checkAsync);
                global.postMessage('__checkAsync', '*');
                global.detachEvent('onmessage', checkAsync);
            }

            if(isPostMessageAsync) {
                var msg = '__promise' + +new Date,
                    onMessage = function(e) {
                        if(e.data === msg) {
                            e.stopPropagation && e.stopPropagation();
                            callFns();
                        }
                    };

                global.addEventListener?
                    global.addEventListener('message', onMessage, true) :
                    global.attachEvent('onmessage', onMessage);

                return function(fn) {
                    enqueueFn(fn) && global.postMessage(msg, '*');
                };
            }
        }

        var doc = global.document;
        if('onreadystatechange' in doc.createElement('script')) { // ie6-ie8
            var createScript = function() {
                    var script = doc.createElement('script');
                    script.onreadystatechange = function() {
                        script.parentNode.removeChild(script);
                        script = script.onreadystatechange = null;
                        callFns();
                };
                (doc.documentElement || doc.body).appendChild(script);
            };

            return function(fn) {
                enqueueFn(fn) && createScript();
            };
        }

        return function(fn) { // old browsers
            enqueueFn(fn) && setTimeout(callFns, 0);
        };
    })(),
    throwException = function(e) {
        nextTick(function() {
            throw e;
        });
    },
    isFunction = function(obj) {
        return typeof obj === 'function';
    },
    isObject = function(obj) {
        return obj !== null && typeof obj === 'object';
    },
    toStr = Object.prototype.toString,
    isArray = Array.isArray || function(obj) {
        return toStr.call(obj) === '[object Array]';
    },
    getArrayKeys = function(arr) {
        var res = [],
            i = 0, len = arr.length;
        while(i < len) {
            res.push(i++);
        }
        return res;
    },
    getObjectKeys = Object.keys || function(obj) {
        var res = [];
        for(var i in obj) {
            obj.hasOwnProperty(i) && res.push(i);
        }
        return res;
    },
    defineCustomErrorType = function(name) {
        var res = function(message) {
            this.name = name;
            this.message = message;
        };

        res.prototype = new Error();

        return res;
    },
    wrapOnFulfilled = function(onFulfilled, idx) {
        return function(val) {
            onFulfilled.call(this, val, idx);
        };
    };

/**
 * @class Deferred
 * @exports vow:Deferred
 * @description
 * The `Deferred` class is used to encapsulate newly-created promise object along with functions that resolve, reject or notify it.
 */

/**
 * @constructor
 * @description
 * You can use `vow.defer()` instead of using this constructor.
 *
 * `new vow.Deferred()` gives the same result as `vow.defer()`.
 */
var Deferred = function() {
    this._promise = new Promise();
};

Deferred.prototype = /** @lends Deferred.prototype */{
    /**
     * Returns the corresponding promise.
     *
     * @returns {vow:Promise}
     */
    promise : function() {
        return this._promise;
    },

    /**
     * Resolves the corresponding promise with the given `value`.
     *
     * @param {*} value
     *
     * @example
     * ```js
     * var defer = vow.defer(),
     *     promise = defer.promise();
     *
     * promise.then(function(value) {
     *     // value is "'success'" here
     * });
     *
     * defer.resolve('success');
     * ```
     */
    resolve : function(value) {
        this._promise.isResolved() || this._promise._resolve(value);
    },

    /**
     * Rejects the corresponding promise with the given `reason`.
     *
     * @param {*} reason
     *
     * @example
     * ```js
     * var defer = vow.defer(),
     *     promise = defer.promise();
     *
     * promise.fail(function(reason) {
     *     // reason is "'something is wrong'" here
     * });
     *
     * defer.reject('something is wrong');
     * ```
     */
    reject : function(reason) {
        if(this._promise.isResolved()) {
            return;
        }

        if(vow.isPromise(reason)) {
            reason = reason.then(function(val) {
                var defer = vow.defer();
                defer.reject(val);
                return defer.promise();
            });
            this._promise._resolve(reason);
        }
        else {
            this._promise._reject(reason);
        }
    },

    /**
     * Notifies the corresponding promise with the given `value`.
     *
     * @param {*} value
     *
     * @example
     * ```js
     * var defer = vow.defer(),
     *     promise = defer.promise();
     *
     * promise.progress(function(value) {
     *     // value is "'20%'", "'40%'" here
     * });
     *
     * defer.notify('20%');
     * defer.notify('40%');
     * ```
     */
    notify : function(value) {
        this._promise.isResolved() || this._promise._notify(value);
    }
};

var PROMISE_STATUS = {
    PENDING   : 0,
    RESOLVED  : 1,
    FULFILLED : 2,
    REJECTED  : 3
};

/**
 * @class Promise
 * @exports vow:Promise
 * @description
 * The `Promise` class is used when you want to give to the caller something to subscribe to,
 * but not the ability to resolve or reject the deferred.
 */

/**
 * @constructor
 * @param {Function} resolver See https://github.com/domenic/promises-unwrapping/blob/master/README.md#the-promise-constructor for details.
 * @description
 * You should use this constructor directly only if you are going to use `vow` as DOM Promises implementation.
 * In other case you should use `vow.defer()` and `defer.promise()` methods.
 * @example
 * ```js
 * function fetchJSON(url) {
 *     return new vow.Promise(function(resolve, reject, notify) {
 *         var xhr = new XMLHttpRequest();
 *         xhr.open('GET', url);
 *         xhr.responseType = 'json';
 *         xhr.send();
 *         xhr.onload = function() {
 *             if(xhr.response) {
 *                 resolve(xhr.response);
 *             }
 *             else {
 *                 reject(new TypeError());
 *             }
 *         };
 *     });
 * }
 * ```
 */
var Promise = function(resolver) {
    this._value = undef;
    this._status = PROMISE_STATUS.PENDING;

    this._fulfilledCallbacks = [];
    this._rejectedCallbacks = [];
    this._progressCallbacks = [];

    if(resolver) { // NOTE: see https://github.com/domenic/promises-unwrapping/blob/master/README.md
        var _this = this,
            resolverFnLen = resolver.length;

        resolver(
            function(val) {
                _this.isResolved() || _this._resolve(val);
            },
            resolverFnLen > 1?
                function(reason) {
                    _this.isResolved() || _this._reject(reason);
                } :
                undef,
            resolverFnLen > 2?
                function(val) {
                    _this.isResolved() || _this._notify(val);
                } :
                undef);
    }
};

Promise.prototype = /** @lends Promise.prototype */ {
    /**
     * Returns the value of the fulfilled promise or the reason in case of rejection.
     *
     * @returns {*}
     */
    valueOf : function() {
        return this._value;
    },

    /**
     * Returns `true` if the promise is resolved.
     *
     * @returns {Boolean}
     */
    isResolved : function() {
        return this._status !== PROMISE_STATUS.PENDING;
    },

    /**
     * Returns `true` if the promise is fulfilled.
     *
     * @returns {Boolean}
     */
    isFulfilled : function() {
        return this._status === PROMISE_STATUS.FULFILLED;
    },

    /**
     * Returns `true` if the promise is rejected.
     *
     * @returns {Boolean}
     */
    isRejected : function() {
        return this._status === PROMISE_STATUS.REJECTED;
    },

    /**
     * Adds reactions to the promise.
     *
     * @param {Function} [onFulfilled] Callback that will be invoked with a provided value after the promise has been fulfilled
     * @param {Function} [onRejected] Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Function} [onProgress] Callback that will be invoked with a provided value after the promise has been notified
     * @param {Object} [ctx] Context of the callbacks execution
     * @returns {vow:Promise} A new promise, see https://github.com/promises-aplus/promises-spec for details
     */
    then : function(onFulfilled, onRejected, onProgress, ctx) {
        var defer = new Deferred();
        this._addCallbacks(defer, onFulfilled, onRejected, onProgress, ctx);
        return defer.promise();
    },

    /**
     * Adds only a rejection reaction. This method is a shorthand for `promise.then(undefined, onRejected)`.
     *
     * @param {Function} onRejected Callback that will be called with a provided 'reason' as argument after the promise has been rejected
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    'catch' : function(onRejected, ctx) {
        return this.then(undef, onRejected, ctx);
    },

    /**
     * Adds only a rejection reaction. This method is a shorthand for `promise.then(null, onRejected)`. It's also an alias for `catch`.
     *
     * @param {Function} onRejected Callback to be called with the value after promise has been rejected
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    fail : function(onRejected, ctx) {
        return this.then(undef, onRejected, ctx);
    },

    /**
     * Adds a resolving reaction (for both fulfillment and rejection).
     *
     * @param {Function} onResolved Callback that will be invoked with the promise as an argument, after the promise has been resolved.
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    always : function(onResolved, ctx) {
        var _this = this,
            cb = function() {
                return onResolved.call(this, _this);
            };

        return this.then(cb, cb, ctx);
    },

    /**
     * Adds a progress reaction.
     *
     * @param {Function} onProgress Callback that will be called with a provided value when the promise has been notified
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    progress : function(onProgress, ctx) {
        return this.then(undef, undef, onProgress, ctx);
    },

    /**
     * Like `promise.then`, but "spreads" the array into a variadic value handler.
     * It is useful with the `vow.all` and the `vow.allResolved` methods.
     *
     * @param {Function} [onFulfilled] Callback that will be invoked with a provided value after the promise has been fulfilled
     * @param {Function} [onRejected] Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Object} [ctx] Context of the callbacks execution
     * @returns {vow:Promise}
     *
     * @example
     * ```js
     * var defer1 = vow.defer(),
     *     defer2 = vow.defer();
     *
     * vow.all([defer1.promise(), defer2.promise()]).spread(function(arg1, arg2) {
     *     // arg1 is "1", arg2 is "'two'" here
     * });
     *
     * defer1.resolve(1);
     * defer2.resolve('two');
     * ```
     */
    spread : function(onFulfilled, onRejected, ctx) {
        return this.then(
            function(val) {
                return onFulfilled.apply(this, val);
            },
            onRejected,
            ctx);
    },

    /**
     * Like `then`, but terminates a chain of promises.
     * If the promise has been rejected, this method throws it's "reason" as an exception in a future turn of the event loop.
     *
     * @param {Function} [onFulfilled] Callback that will be invoked with a provided value after the promise has been fulfilled
     * @param {Function} [onRejected] Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Function} [onProgress] Callback that will be invoked with a provided value after the promise has been notified
     * @param {Object} [ctx] Context of the callbacks execution
     *
     * @example
     * ```js
     * var defer = vow.defer();
     * defer.reject(Error('Internal error'));
     * defer.promise().done(); // exception to be thrown
     * ```
     */
    done : function(onFulfilled, onRejected, onProgress, ctx) {
        this
            .then(onFulfilled, onRejected, onProgress, ctx)
            .fail(throwException);
    },

    /**
     * Returns a new promise that will be fulfilled in `delay` milliseconds if the promise is fulfilled,
     * or immediately rejected if the promise is rejected.
     *
     * @param {Number} delay
     * @returns {vow:Promise}
     */
    delay : function(delay) {
        var timer,
            promise = this.then(function(val) {
                var defer = new Deferred();
                timer = setTimeout(
                    function() {
                        defer.resolve(val);
                    },
                    delay);

                return defer.promise();
            });

        promise.always(function() {
            clearTimeout(timer);
        });

        return promise;
    },

    /**
     * Returns a new promise that will be rejected in `timeout` milliseconds
     * if the promise is not resolved beforehand.
     *
     * @param {Number} timeout
     * @returns {vow:Promise}
     *
     * @example
     * ```js
     * var defer = vow.defer(),
     *     promiseWithTimeout1 = defer.promise().timeout(50),
     *     promiseWithTimeout2 = defer.promise().timeout(200);
     *
     * setTimeout(
     *     function() {
     *         defer.resolve('ok');
     *     },
     *     100);
     *
     * promiseWithTimeout1.fail(function(reason) {
     *     // promiseWithTimeout to be rejected in 50ms
     * });
     *
     * promiseWithTimeout2.then(function(value) {
     *     // promiseWithTimeout to be fulfilled with "'ok'" value
     * });
     * ```
     */
    timeout : function(timeout) {
        var defer = new Deferred(),
            timer = setTimeout(
                function() {
                    defer.reject(new vow.TimedOutError('timed out'));
                },
                timeout);

        this.then(
            function(val) {
                defer.resolve(val);
            },
            function(reason) {
                defer.reject(reason);
            });

        defer.promise().always(function() {
            clearTimeout(timer);
        });

        return defer.promise();
    },

    _vow : true,

    _resolve : function(val) {
        if(this._status > PROMISE_STATUS.RESOLVED) {
            return;
        }

        if(val === this) {
            this._reject(TypeError('Can\'t resolve promise with itself'));
            return;
        }

        this._status = PROMISE_STATUS.RESOLVED;

        if(val && !!val._vow) { // shortpath for vow.Promise
            val.isFulfilled()?
                this._fulfill(val.valueOf()) :
                val.isRejected()?
                    this._reject(val.valueOf()) :
                    val.then(
                        this._fulfill,
                        this._reject,
                        this._notify,
                        this);
            return;
        }

        if(isObject(val) || isFunction(val)) {
            var then;
            try {
                then = val.then;
            }
            catch(e) {
                this._reject(e);
                return;
            }

            if(isFunction(then)) {
                var _this = this,
                    isResolved = false;

                try {
                    then.call(
                        val,
                        function(val) {
                            if(isResolved) {
                                return;
                            }

                            isResolved = true;
                            _this._resolve(val);
                        },
                        function(err) {
                            if(isResolved) {
                                return;
                            }

                            isResolved = true;
                            _this._reject(err);
                        },
                        function(val) {
                            _this._notify(val);
                        });
                }
                catch(e) {
                    isResolved || this._reject(e);
                }

                return;
            }
        }

        this._fulfill(val);
    },

    _fulfill : function(val) {
        if(this._status > PROMISE_STATUS.RESOLVED) {
            return;
        }

        this._status = PROMISE_STATUS.FULFILLED;
        this._value = val;

        this._callCallbacks(this._fulfilledCallbacks, val);
        this._fulfilledCallbacks = this._rejectedCallbacks = this._progressCallbacks = undef;
    },

    _reject : function(reason) {
        if(this._status > PROMISE_STATUS.RESOLVED) {
            return;
        }

        this._status = PROMISE_STATUS.REJECTED;
        this._value = reason;

        this._callCallbacks(this._rejectedCallbacks, reason);
        this._fulfilledCallbacks = this._rejectedCallbacks = this._progressCallbacks = undef;
    },

    _notify : function(val) {
        this._callCallbacks(this._progressCallbacks, val);
    },

    _addCallbacks : function(defer, onFulfilled, onRejected, onProgress, ctx) {
        if(onRejected && !isFunction(onRejected)) {
            ctx = onRejected;
            onRejected = undef;
        }
        else if(onProgress && !isFunction(onProgress)) {
            ctx = onProgress;
            onProgress = undef;
        }

        var cb;

        if(!this.isRejected()) {
            cb = { defer : defer, fn : isFunction(onFulfilled)? onFulfilled : undef, ctx : ctx };
            this.isFulfilled()?
                this._callCallbacks([cb], this._value) :
                this._fulfilledCallbacks.push(cb);
        }

        if(!this.isFulfilled()) {
            cb = { defer : defer, fn : onRejected, ctx : ctx };
            this.isRejected()?
                this._callCallbacks([cb], this._value) :
                this._rejectedCallbacks.push(cb);
        }

        if(this._status <= PROMISE_STATUS.RESOLVED) {
            this._progressCallbacks.push({ defer : defer, fn : onProgress, ctx : ctx });
        }
    },

    _callCallbacks : function(callbacks, arg) {
        var len = callbacks.length;
        if(!len) {
            return;
        }

        var isResolved = this.isResolved(),
            isFulfilled = this.isFulfilled();

        nextTick(function() {
            var i = 0, cb, defer, fn;
            while(i < len) {
                cb = callbacks[i++];
                defer = cb.defer;
                fn = cb.fn;

                if(fn) {
                    var ctx = cb.ctx,
                        res;
                    try {
                        res = ctx? fn.call(ctx, arg) : fn(arg);
                    }
                    catch(e) {
                        defer.reject(e);
                        continue;
                    }

                    isResolved?
                        defer.resolve(res) :
                        defer.notify(res);
                }
                else {
                    isResolved?
                        isFulfilled?
                            defer.resolve(arg) :
                            defer.reject(arg) :
                        defer.notify(arg);
                }
            }
        });
    }
};

/** @lends Promise */
var staticMethods = {
    /**
     * Coerces the given `value` to a promise, or returns the `value` if it's already a promise.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    cast : function(value) {
        return vow.cast(value);
    },

    /**
     * Returns a promise, that will be fulfilled only after all the items in `iterable` are fulfilled.
     * If any of the `iterable` items gets rejected, then the returned promise will be rejected.
     *
     * @param {Array|Object} iterable
     * @returns {vow:Promise}
     */
    all : function(iterable) {
        return vow.all(iterable);
    },

    /**
     * Returns a promise, that will be fulfilled only when any of the items in `iterable` are fulfilled.
     * If any of the `iterable` items gets rejected, then the returned promise will be rejected.
     *
     * @param {Array} iterable
     * @returns {vow:Promise}
     */
    race : function(iterable) {
        return vow.anyResolved(iterable);
    },

    /**
     * Returns a promise that has already been resolved with the given `value`.
     * If `value` is a promise, the returned promise will have `value`'s state.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    resolve : function(value) {
        return vow.resolve(value);
    },

    /**
     * Returns a promise that has already been rejected with the given `reason`.
     *
     * @param {*} reason
     * @returns {vow:Promise}
     */
    reject : function(reason) {
        return vow.reject(reason);
    }
};

for(var prop in staticMethods) {
    staticMethods.hasOwnProperty(prop) &&
        (Promise[prop] = staticMethods[prop]);
}

var vow = /** @exports vow */ {
    Deferred : Deferred,

    Promise : Promise,

    /**
     * Creates a new deferred. This method is a factory method for `vow:Deferred` class.
     * It's equivalent to `new vow.Deferred()`.
     *
     * @returns {vow:Deferred}
     */
    defer : function() {
        return new Deferred();
    },

    /**
     * Static equivalent to `promise.then`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Function} [onFulfilled] Callback that will be invoked with a provided value after the promise has been fulfilled
     * @param {Function} [onRejected] Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Function} [onProgress] Callback that will be invoked with a provided value after the promise has been notified
     * @param {Object} [ctx] Context of the callbacks execution
     * @returns {vow:Promise}
     */
    when : function(value, onFulfilled, onRejected, onProgress, ctx) {
        return vow.cast(value).then(onFulfilled, onRejected, onProgress, ctx);
    },

    /**
     * Static equivalent to `promise.fail`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Function} onRejected Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    fail : function(value, onRejected, ctx) {
        return vow.when(value, undef, onRejected, ctx);
    },

    /**
     * Static equivalent to `promise.always`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Function} onResolved Callback that will be invoked with the promise as an argument, after the promise has been resolved.
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    always : function(value, onResolved, ctx) {
        return vow.when(value).always(onResolved, ctx);
    },

    /**
     * Static equivalent to `promise.progress`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Function} onProgress Callback that will be invoked with a provided value after the promise has been notified
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    progress : function(value, onProgress, ctx) {
        return vow.when(value).progress(onProgress, ctx);
    },

    /**
     * Static equivalent to `promise.spread`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Function} [onFulfilled] Callback that will be invoked with a provided value after the promise has been fulfilled
     * @param {Function} [onRejected] Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Object} [ctx] Context of the callbacks execution
     * @returns {vow:Promise}
     */
    spread : function(value, onFulfilled, onRejected, ctx) {
        return vow.when(value).spread(onFulfilled, onRejected, ctx);
    },

    /**
     * Static equivalent to `promise.done`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Function} [onFulfilled] Callback that will be invoked with a provided value after the promise has been fulfilled
     * @param {Function} [onRejected] Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Function} [onProgress] Callback that will be invoked with a provided value after the promise has been notified
     * @param {Object} [ctx] Context of the callbacks execution
     */
    done : function(value, onFulfilled, onRejected, onProgress, ctx) {
        vow.when(value).done(onFulfilled, onRejected, onProgress, ctx);
    },

    /**
     * Checks whether the given `value` is a promise-like object
     *
     * @param {*} value
     * @returns {Boolean}
     *
     * @example
     * ```js
     * vow.isPromise('something'); // returns false
     * vow.isPromise(vow.defer().promise()); // returns true
     * vow.isPromise({ then : function() { }); // returns true
     * ```
     */
    isPromise : function(value) {
        return isObject(value) && isFunction(value.then);
    },

    /**
     * Coerces the given `value` to a promise, or returns the `value` if it's already a promise.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    cast : function(value) {
        return value && !!value._vow?
            value :
            vow.resolve(value);
    },

    /**
     * Static equivalent to `promise.valueOf`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @returns {*}
     */
    valueOf : function(value) {
        return value && isFunction(value.valueOf)? value.valueOf() : value;
    },

    /**
     * Static equivalent to `promise.isFulfilled`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @returns {Boolean}
     */
    isFulfilled : function(value) {
        return value && isFunction(value.isFulfilled)? value.isFulfilled() : true;
    },

    /**
     * Static equivalent to `promise.isRejected`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @returns {Boolean}
     */
    isRejected : function(value) {
        return value && isFunction(value.isRejected)? value.isRejected() : false;
    },

    /**
     * Static equivalent to `promise.isResolved`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @returns {Boolean}
     */
    isResolved : function(value) {
        return value && isFunction(value.isResolved)? value.isResolved() : true;
    },

    /**
     * Returns a promise that has already been resolved with the given `value`.
     * If `value` is a promise, the returned promise will have `value`'s state.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    resolve : function(value) {
        var res = vow.defer();
        res.resolve(value);
        return res.promise();
    },

    /**
     * Returns a promise that has already been fulfilled with the given `value`.
     * If `value` is a promise, the returned promise will be fulfilled with the fulfill/rejection value of `value`.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    fulfill : function(value) {
        var defer = vow.defer(),
            promise = defer.promise();

        defer.resolve(value);

        return promise.isFulfilled()?
            promise :
            promise.then(null, function(reason) {
                return reason;
            });
    },

    /**
     * Returns a promise that has already been rejected with the given `reason`.
     * If `reason` is a promise, the returned promise will be rejected with the fulfill/rejection value of `reason`.
     *
     * @param {*} reason
     * @returns {vow:Promise}
     */
    reject : function(reason) {
        var defer = vow.defer();
        defer.reject(reason);
        return defer.promise();
    },

    /**
     * Invokes the given function `fn` with arguments `args`
     *
     * @param {Function} fn
     * @param {...*} [args]
     * @returns {vow:Promise}
     *
     * @example
     * ```js
     * var promise1 = vow.invoke(function(value) {
     *         return value;
     *     }, 'ok'),
     *     promise2 = vow.invoke(function() {
     *         throw Error();
     *     });
     *
     * promise1.isFulfilled(); // true
     * promise1.valueOf(); // 'ok'
     * promise2.isRejected(); // true
     * promise2.valueOf(); // instance of Error
     * ```
     */
    invoke : function(fn, args) {
        var len = Math.max(arguments.length - 1, 0),
            callArgs;
        if(len) { // optimization for V8
            callArgs = Array(len);
            var i = 0;
            while(i < len) {
                callArgs[i++] = arguments[i];
            }
        }

        try {
            return vow.resolve(callArgs?
                fn.apply(global, callArgs) :
                fn.call(global));
        }
        catch(e) {
            return vow.reject(e);
        }
    },

    /**
     * Returns a promise, that will be fulfilled only after all the items in `iterable` are fulfilled.
     * If any of the `iterable` items gets rejected, the promise will be rejected.
     *
     * @param {Array|Object} iterable
     * @returns {vow:Promise}
     *
     * @example
     * with array:
     * ```js
     * var defer1 = vow.defer(),
     *     defer2 = vow.defer();
     *
     * vow.all([defer1.promise(), defer2.promise(), 3])
     *     .then(function(value) {
     *          // value is "[1, 2, 3]" here
     *     });
     *
     * defer1.resolve(1);
     * defer2.resolve(2);
     * ```
     *
     * @example
     * with object:
     * ```js
     * var defer1 = vow.defer(),
     *     defer2 = vow.defer();
     *
     * vow.all({ p1 : defer1.promise(), p2 : defer2.promise(), p3 : 3 })
     *     .then(function(value) {
     *          // value is "{ p1 : 1, p2 : 2, p3 : 3 }" here
     *     });
     *
     * defer1.resolve(1);
     * defer2.resolve(2);
     * ```
     */
    all : function(iterable) {
        var defer = new Deferred(),
            isPromisesArray = isArray(iterable),
            keys = isPromisesArray?
                getArrayKeys(iterable) :
                getObjectKeys(iterable),
            len = keys.length,
            res = isPromisesArray? [] : {};

        if(!len) {
            defer.resolve(res);
            return defer.promise();
        }

        var i = len;
        vow._forEach(
            iterable,
            function(value, idx) {
                res[keys[idx]] = value;
                if(!--i) {
                    defer.resolve(res);
                }
            },
            defer.reject,
            defer.notify,
            defer,
            keys);

        return defer.promise();
    },

    /**
     * Returns a promise, that will be fulfilled only after all the items in `iterable` are resolved.
     *
     * @param {Array|Object} iterable
     * @returns {vow:Promise}
     *
     * @example
     * ```js
     * var defer1 = vow.defer(),
     *     defer2 = vow.defer();
     *
     * vow.allResolved([defer1.promise(), defer2.promise()]).spread(function(promise1, promise2) {
     *     promise1.isRejected(); // returns true
     *     promise1.valueOf(); // returns "'error'"
     *     promise2.isFulfilled(); // returns true
     *     promise2.valueOf(); // returns "'ok'"
     * });
     *
     * defer1.reject('error');
     * defer2.resolve('ok');
     * ```
     */
    allResolved : function(iterable) {
        var defer = new Deferred(),
            isPromisesArray = isArray(iterable),
            keys = isPromisesArray?
                getArrayKeys(iterable) :
                getObjectKeys(iterable),
            i = keys.length,
            res = isPromisesArray? [] : {};

        if(!i) {
            defer.resolve(res);
            return defer.promise();
        }

        var onResolved = function() {
                --i || defer.resolve(iterable);
            };

        vow._forEach(
            iterable,
            onResolved,
            onResolved,
            defer.notify,
            defer,
            keys);

        return defer.promise();
    },

    allPatiently : function(iterable) {
        return vow.allResolved(iterable).then(function() {
            var isPromisesArray = isArray(iterable),
                keys = isPromisesArray?
                    getArrayKeys(iterable) :
                    getObjectKeys(iterable),
                rejectedPromises, fulfilledPromises,
                len = keys.length, i = 0, key, promise;

            if(!len) {
                return isPromisesArray? [] : {};
            }

            while(i < len) {
                key = keys[i++];
                promise = iterable[key];
                if(vow.isRejected(promise)) {
                    rejectedPromises || (rejectedPromises = isPromisesArray? [] : {});
                    isPromisesArray?
                        rejectedPromises.push(promise.valueOf()) :
                        rejectedPromises[key] = promise.valueOf();
                }
                else if(!rejectedPromises) {
                    (fulfilledPromises || (fulfilledPromises = isPromisesArray? [] : {}))[key] = vow.valueOf(promise);
                }
            }

            if(rejectedPromises) {
                throw rejectedPromises;
            }

            return fulfilledPromises;
        });
    },

    /**
     * Returns a promise, that will be fulfilled if any of the items in `iterable` is fulfilled.
     * If all of the `iterable` items get rejected, the promise will be rejected (with the reason of the first rejected item).
     *
     * @param {Array} iterable
     * @returns {vow:Promise}
     */
    any : function(iterable) {
        var defer = new Deferred(),
            len = iterable.length;

        if(!len) {
            defer.reject(Error());
            return defer.promise();
        }

        var i = 0, reason;
        vow._forEach(
            iterable,
            defer.resolve,
            function(e) {
                i || (reason = e);
                ++i === len && defer.reject(reason);
            },
            defer.notify,
            defer);

        return defer.promise();
    },

    /**
     * Returns a promise, that will be fulfilled only when any of the items in `iterable` is fulfilled.
     * If any of the `iterable` items gets rejected, the promise will be rejected.
     *
     * @param {Array} iterable
     * @returns {vow:Promise}
     */
    anyResolved : function(iterable) {
        var defer = new Deferred(),
            len = iterable.length;

        if(!len) {
            defer.reject(Error());
            return defer.promise();
        }

        vow._forEach(
            iterable,
            defer.resolve,
            defer.reject,
            defer.notify,
            defer);

        return defer.promise();
    },

    /**
     * Static equivalent to `promise.delay`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Number} delay
     * @returns {vow:Promise}
     */
    delay : function(value, delay) {
        return vow.resolve(value).delay(delay);
    },

    /**
     * Static equivalent to `promise.timeout`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Number} timeout
     * @returns {vow:Promise}
     */
    timeout : function(value, timeout) {
        return vow.resolve(value).timeout(timeout);
    },

    _forEach : function(promises, onFulfilled, onRejected, onProgress, ctx, keys) {
        var len = keys? keys.length : promises.length,
            i = 0;

        while(i < len) {
            vow.when(
                promises[keys? keys[i] : i],
                wrapOnFulfilled(onFulfilled, i),
                onRejected,
                onProgress,
                ctx);
            ++i;
        }
    },

    TimedOutError : defineCustomErrorType('TimedOut')
};

var defineAsGlobal = true;
if(typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = vow;
    defineAsGlobal = false;
}

if(typeof modules === 'object' && isFunction(modules.define)) {
    modules.define('vow', function(provide) {
        provide(vow);
    });
    defineAsGlobal = false;
}

if(typeof define === 'function') {
    define(function(require, exports, module) {
        module.exports = vow;
    });
    defineAsGlobal = false;
}

defineAsGlobal && (global.vow = vow);

})(this);

/* end: ../../common.blocks/vow/vow.vanilla.js */
/* begin: ../../desktop.blocks/jquery/__event/_type/jquery__event_type_winresize.js */
/**
 * @module jquery
 */

modules.define('jquery', ['ua'], function(provide, ua, $) {

// IE8 and below, https://msdn.microsoft.com/en-us/library/ie/ms536959%28v=vs.85%29.aspx
if(ua.msie && document.documentMode < 9) {
    var win = window,
        $win = $(window),
        winWidth = $win.width(),
        winHeight = $win.height();

    ($.event.special.resize || ($.event.special.resize = {})).preDispatch = function(e) {
        if(e.target === win) {
            var curWinWidth = $win.width(),
                curWinHeight = $win.height();

            if(curWinWidth === winWidth && curWinHeight === winHeight) {
                return false;
            } else {
                winWidth = curWinWidth;
                winHeight = curWinHeight;
            }
        }
    };
}

provide($);

});

/* end: ../../desktop.blocks/jquery/__event/_type/jquery__event_type_winresize.js */
/* begin: ../../common.blocks/loader/_type/loader_type_js.js */
/**
 * @module loader_type_js
 * @description Load JS from external URL.
 */

modules.define('loader_type_js', function(provide) {

var loading = {},
    loaded = {},
    head = document.getElementsByTagName('head')[0],
    runCallbacks = function(path, type) {
        var cbs = loading[path], cb, i = 0;
        delete loading[path];
        while(cb = cbs[i++]) {
            cb[type] && cb[type]();
        }
    },
    onSuccess = function(path) {
        loaded[path] = true;
        runCallbacks(path, 'success');
    },
    onError = function(path) {
        runCallbacks(path, 'error');
    };

provide(
    /**
     * @exports
     * @param {String} path resource link
     * @param {Function} [success] to be called if the script succeeds
     * @param {Function} [error] to be called if the script fails
     */
    function(path, success, error) {
        if(loaded[path]) {
            success && success();
            return;
        }

        if(loading[path]) {
            loading[path].push({ success : success, error : error });
            return;
        }

        loading[path] = [{ success : success, error : error }];

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.charset = 'utf-8';
        script.src = (location.protocol === 'file:' && !path.indexOf('//')? 'http:' : '') + path;

        if('onload' in script) {
            script.onload = function() {
                script.onload = script.onerror = null;
                onSuccess(path);
            };

            script.onerror = function() {
                script.onload = script.onerror = null;
                onError(path);
            };
        } else {
            script.onreadystatechange = function() {
                var readyState = this.readyState;
                if(readyState === 'loaded' || readyState === 'complete') {
                    script.onreadystatechange = null;
                    onSuccess(path);
                }
            };
        }

        head.insertBefore(script, head.lastChild);
    }
);

});

/* end: ../../common.blocks/loader/_type/loader_type_js.js */
/* begin: ../../common.blocks/i-bem/__collection/i-bem__collection.js */
/**
 * @module i-bem__collection
 */

modules.define('i-bem__collection', ['inherit', 'objects'], function(provide, inherit, objects) {

/**
 * @class BEMCollection
 * @description Base class for collections. Create collection of similar objects.
 * @abstract
 * @augments Array
 * @exports
 */

provide(inherit(null, /** @lends BEMCollection */{
    /**
     * Get method names that will be implemented in collection
     * @returns {Array}
     */
    getMethods : function() {
        return ['on', 'onFirst', 'un', 'trigger',
            'setMod', 'toggleMod', 'delMod',
            'afterCurrentEvent', 'destruct'];
    },

    /**
     * Get base prototype for collection
     * @returns {Object}
     */
    getBase : function() {
        return {
            applyMethod : function(method, args) {
                this.forEach(function(context) {
                    context[method] && context[method].apply(context, args);
                });
                return this;
            },

            callMethod : function() {
                var args = this.slice.call(arguments);
                return this.applyMethod(args.shift(), args);
            }
        };
    },

    /**
     * Create collection instance
     * @param {Array} a list of similar objects
     * @returns {Object}
     */
    create : function(a) {
        var decl = this.getBase();

        this.getMethods()
            .forEach(function(method) {
                if(!decl[method]) {
                    decl[method] = function() {
                        return this.applyMethod(method, arguments);
                    };
                }
            });

        /**
         * "Inherit" Array using direct extend.
         * See http://perfectionkills.com/how-ecmascript-5-still-does-not-allow-to-subclass-an-array/.
         */
        this.create = function(arr) {
            arr || (arr = []);
            arr.__self = this;
            return objects.extend(arr, decl);
        };

        return this.create(a);
    }
}));

});

/* end: ../../common.blocks/i-bem/__collection/i-bem__collection.js */
/* begin: ../../common.blocks/i-bem/__dom/_collection/i-bem__dom_collection_yes.js */
/**
 * @module i-bem__dom
 * @description Overrides BEM.DOM.findBlocks* methods that they return i-bem__collection_type_dom
 */

modules.define('i-bem__dom', ['i-bem__collection_type_dom'], function(provide, Collection, BEMDOM) {

provide(
    /**
     * @class BEMDOM
     * @augments BEMDOM
     * @exports
     */
    BEMDOM.decl('i-bem__dom', (function() {
        var decl = {},
            wrapMethod = function() {
                return Collection.create(this.__base.apply(this, arguments));
            };

        ['findBlocksInside', 'findBlocksOutside', 'findBlocksOn']
            .forEach(function(method) {
                decl[method] = wrapMethod;
            });

        return decl;
    }()))
);

});

/* end: ../../common.blocks/i-bem/__dom/_collection/i-bem__dom_collection_yes.js */
/* begin: ../../common.blocks/jquery/__event/_type/jquery__event_type_pointerpressrelease.js */
modules.define('jquery', function(provide, $) {

$.each({
    pointerpress : 'pointerdown',
    pointerrelease : 'pointerup pointercancel'
}, function(fix, origEvent) {
    function eventHandler(e) {
        if(e.which === 1) {
            var fixedEvent = cloneEvent(e);
            fixedEvent.type = fix;
            fixedEvent.originalEvent = e;
            return $.event.dispatch.call(this, fixedEvent);
        }
    }

    $.event.special[fix] = {
        setup : function() {
            $(this).on(origEvent, eventHandler);
            return false;
        },
        teardown : function() {
            $(this).off(origEvent, eventHandler);
            return false;
        }
    };
});

function cloneEvent(event) {
    var eventCopy = $.extend(new $.Event(), event);
    if(event.preventDefault) {
        eventCopy.preventDefault = function() {
            event.preventDefault();
        };
    }
    return eventCopy;
}

provide($);

});

/* end: ../../common.blocks/jquery/__event/_type/jquery__event_type_pointerpressrelease.js */
/* begin: ../../common.blocks/i-bem/__collection/_type/i-bem__collection_type_dom.js */
/**
 * @module i-bem__collection_type_dom
 */

modules.define(
    'i-bem__collection_type_dom',
    ['inherit', 'i-bem__collection'],
    function(provide, inherit, Collection) {

/**
 * @class BEMDOMCollection
 * @description Collection of BEM.DOM blocks. Implementation of BEM.DOM methods for array of blocks.
 * @augments i-bem__collection
 * @exports
 */

provide(inherit(Collection, null, /** @lends BEMDOMCollection */{
    /**
     * Get methods that will be implemented in BEMDOMCollection
     * @override
     * @returns {Array}
     */
    getMethods : function() {
        return this.__base().concat(['bindTo', 'bindToDoc', 'bindToDomElem', 'bindToWin',
            'unbindFrom', 'unbindFromDoc', 'unbindFromDomElem', 'unbindFromWin',
            'dropElemCache']);
    }
}));

});

/* end: ../../common.blocks/i-bem/__collection/_type/i-bem__collection_type_dom.js */


(function (global) {
    var __i18n__ = ((function () {
            var data;

            /**
             * @exports
             * @param {String} keyset
             * @param {String} key
             * @param {Object} [params]
             * @returns {String}
             */
            function i18n(keyset, key, params) {
                if(!data) throw Error('i18n need to be filled with data');
                var val = data[keyset] && data[keyset][key];
                return typeof val === 'undefined'?
                keyset + ':' + key :
                    typeof val === 'string'?
                        val :
                        val.call(i18n, params, i18n);
            }

            i18n.decl = function(i18nData) {
                if(!data) {
                    data = i18nData;
                    return this;
                }

                for(var ks in i18nData) {
                    var dataKs = data[ks] || (data[ks] = {}),
                        i18nDataKs = i18nData[ks];

                    for(var k in i18nDataKs)
                        dataKs[k] = i18nDataKs[k];
                }

                return this;
            };

            return i18n;
        })()).decl({}),
        defineAsGlobal = true;


    // YModules
    if (typeof modules === "object") {
        modules.define("i18n", function (provide) {
            provide(__i18n__);
        });

    }

    if (defineAsGlobal) {

        (global.BEM || (global.BEM = {})).I18N = __i18n__;
    }
})(typeof window !== "undefined" ? window : global);