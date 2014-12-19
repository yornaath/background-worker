"use strict";

var child_process     = require( 'child_process' ),
    isNode            = require( 'detect-node' )


module.exports = BackgroundWorker

/*
 * @class BackgroundWorker
 * @author Jørn Andre Tangen @gorillatron
*/
function BackgroundWorker( spec ) {

  spec = spec ? spec : {}

  this.importScripts = spec.importScripts || []
  this.definitions = spec.definitions || []
  this.domain =  spec.domain || !isNode ? (location.protocol + "//" + location.host) : null

  this._spec = spec
  this._worker = null
  this._iframe = null
  this._messageId = 0
  this._messagehandlers = {}
  this._state = BackgroundWorker.CREATED

  if( typeof spec === 'function' ) {
    this.define('default', spec )
  }
}

/*
 * Check WebWorker support
 * @static
 * @returns {boolean}
*/
BackgroundWorker.hasWorkerSupport = function() {
  return (typeof window.Worker !== 'undefined' && typeof window.Blob !== 'undefined') && (typeof window.URL.createObjectURL == 'function')
}

/*
* Check support for passing complex structures. Value is memoized
* @static
* @returns {boolean}
*/
BackgroundWorker.hasStructuredCloneSupport = memoize(function() {
  try {
    window.postMessage( document.createElement("a"),"*" )
    return true
  } catch( exception ) {
    return exception.DATA_CLONE_ERR ? false : true;
  }
})

/*
* State Created
* @static
*/
BackgroundWorker.CREATED = {}

/*
* State Running
* @static
*/
BackgroundWorker.RUNNING = {}

/*
* State Idle
* @static
*/
BackgroundWorker.IDLE = {}

/*
* State Terminated
* @static
*/
BackgroundWorker.TERMINATED = {}

/*
 * Define a command on the worker
 * @public
 * @function
*/
BackgroundWorker.prototype.define = function( key, val ) {
  this.definitions.push({ key: key, val: val })
}

/*
 * Run a given function defined in the BackgroundWorker
 * @public
 * @function
 * @param {string} command - command to run
 * @param {array} args - arguemnts to apply to command
 * @returns {Promise}
*/
BackgroundWorker.prototype.run = function( command, args ) {
  var self, messageId, message, handler, task, worker

  self = this

  if( typeof command !== 'string' ) {
    command = 'default'
    args = Array.prototype.slice.call( self )
  }

  if( self._state === BackgroundWorker.TERMINATED ) {
    throw new Error( 'Cannot call run on a Terminated BackgroundWorker' )
  }

  if( !self._isStarted ) {
    start( self )
  }

  stateChange( self, BackgroundWorker.RUNNING )

  messageId = getUniqueMessageId( self )
  message = { command: command, args: args, messageId: messageId }

  handler = {}

  task = new Promise(function(resolve, reject) {
    function setIdleThen(cb) {
      return function(){
        stateChange( self, BackgroundWorker.IDLE )
        cb.apply( self, arguments )
      }
    }
    handler.resolve = setIdleThen( resolve )
    handler.reject = setIdleThen( reject )
  })

  self._messagehandlers[ messageId ] = handler

  postMessage( self, message, self.domain )

  return task
}

/*
* Terminate the worker
* @public
* @function
*/
BackgroundWorker.prototype.terminate = function() {
  var self

  self = this

  if( isNode ) {
    if( self._childProcess ) self._childProcess.kill()
  }
  else if( BackgroundWorker.hasWorkerSupport() ) {
    if( self._worker )
      self._worker.terminate()
  }
  else if( self._iframe ){
    self._iframe.remove()
  }

  stateChange( self, BackgroundWorker.TERMINATED )
}

/*
* Start the worker. Should not be called by the user.
* @public
* @function
*/
BackgroundWorker.prototype._start = function() {
  return start( this )
}

/*
* Global reference
* @private
*/

var global = typeof global !== 'undefined' ? global :
             typeof window !== 'undefined' ? window : this

/*
* Start the worker
* @private
* @function
* @param {BackgroundWorker} self
*/
function start( self ) {
  if( self._isStarted ) {
    throw new Error( 'cannot start allready started BackgroundWorker' )
  }

  self._isStarted = true

  if( isNode ) {
    setupChildProcess( self )
  }
  else if( BackgroundWorker.hasWorkerSupport() ) {
    setupWebWorker( self )
  }
  else {
    setupIframe( self )
  }

  stateChange( self, BackgroundWorker.IDLE )

  return self
}

/*
* PostMessage to the underlying Worker implementation
* @private
* @function
*/
function postMessage( self, message, domain ) {
  if( isNode ) {
    self._childProcess.send( message )
  }
  else if( BackgroundWorker.hasWorkerSupport() ) {
    self._worker.postMessage( message )
  }
  else {
    self._iframe.contentWindow.postMessage( message, domain )
  }
}

/*
* Setup a Worker
* @private
* @function
* @param {BackgroundWorker} self
*/
function setupWebWorker( self ) {
  self.blob = new Blob([
    getWorkerSourcecode( self )
  ], { type: "text/javascript" })

  self._worker = new Worker( window.URL.createObjectURL(self.blob) )

  self._worker.onmessage = function( event ) {
    return workerOnMessageHandler( self, event )
  }
  self._worker.onerror = function( event )  {
    return workerOnErrorHandler( self, event )
  }
}

/*
* Setup a Process
* @private
* @function
* @param {BackgroundWorker} self
*/
function setupChildProcess( self ) {
  self._childProcess = child_process.fork( __dirname + '/nodeworker.js' )
  for( var i = 0; i < self.definitions.length; i++ ) {
    if( typeof self.definitions[i].val === 'function' ) {
      self.definitions[i].val = self.definitions[i].val.toString()
    }
    self._childProcess.send({ command: 'define', args: [self.definitions[i]], messageId: getUniqueMessageId(self) })
  }
  self._childProcess.on( 'message', function( message ) {
    childProcessOnMessageHandler( self, message )
  })
}


/*
* Setup a Iframe
* @private
* @function
*/
function setupIframe( self ) {
  var script, src

  self._iframe = document.createElement( 'iframe' )

  script = document.createElement( 'script' )

  if( !self._iframe.style ) self._iframe.style = {}
  self._iframe.style.display = 'none';

  src = ""

  src += "var domain = '" + self.domain + "';\n"
  src += "var importScripts = " + JSON.stringify(self.importScripts) + ";\n"
  src += "var definitions = {};\n"


  for( var i = 0; i < self.definitions.length; i++ ) {
    src += " definitions['" + self.definitions[i].key + "'] = " + self.definitions[i].val + ";\n"
  }

  src += ";(" + function(){

    function loadScripts( callback ) {
      var alloaded = false

      function next() {
        var src = importScripts.shift()
        if(alloaded || !src) {
          alloaded = true
          return callback()
        }
        var script = document.createElement('script')
        script.onload = function() {
          next()
        }
        document.body.appendChild( script )
        script.src = src
      }
      next()
    }


    self.onmessage = function( event ) {
      var data = event.data
      loadScripts(function() {
        try {
          var result = definitions[data.command].apply(this, data.args);
          var out = { messageId: data.messageId, result: result };
          postMessage( out, domain );
        }
        catch( exception ) {
          var message = { messageId: data.messageId, exception: { type: exception.name, message: exception.message } };
          postMessage( message, domain );
        }
      })
    }


  }.toString() + ")();\n"

  script.innerHTML = src

  window.document.body.appendChild( self._iframe )

  self._iframe.contentWindow.addEventListener( 'message', function( event ){ return iframeOnMessageHandler( self, event ) } )

  self._iframe.contentDocument.body.appendChild( script )

}

/*
* Get a uniqie messageid to identify a worker message transaction
* @private
* @function
* @returns {int}
*/
function getUniqueMessageId( self ) {
  return self._messageId++
}

/*
* Change state of BackgroundWorker and trigger event if it differs from old
* @private
* @function
*/
function stateChange( self, newstate ) {
  var oldstate

  oldstate = self._state
  self._state = newstate

  if( oldstate !== newstate ) {
    // self.emit( 'statechange:' + newstate )
    // self.emit( 'statechange', newstate )
    return true
  }

  return false
}

/*
 * Handle worker messages
 * @public
 * @function
 * @event
 * @param {BackgroundWorker} self
 * @param {Object} message
*/
function workerOnMessageHandler( self, event ) {
  var data, messagehandler

  data = event.data

  messagehandler = self._messagehandlers[ data.messageId ]

  if( data.exception ) {
    return messagehandler.reject( createExceptionFromMessage( self, data.exception ) )
  }

  messagehandler.resolve( data.result )
}

/*
* Handle worker messages
* @public
* @function
* @event
* @param {BackgroundWorker} self
* @param {Object} message
*/
function childProcessOnMessageHandler( self, message ) {
  var data, messagehandler

  data = message
  messagehandler = self._messagehandlers[ data.messageId ]

  if( data.exception ) {
    return messagehandler.reject( createExceptionFromMessage( self, data.exception ) )
  }

  messagehandler.resolve( data.result )
}

/*
 * Handle iframe messages
 * @public
 * @function
 * @event
 * @param {BackgroundWorker} self
 * @param {Object} message
*/
 function iframeOnMessageHandler( self, event ) {
  var data, messagehandler

  data = event.data

  if(data.command) return null

  messagehandler = self._messagehandlers[ data.messageId ]

  if( data.exception )
    return messagehandler.reject( createExceptionFromMessage( self, data.exception ) )

  messagehandler.resolve( data.result )

}


/*
 * Create a exception by an obect describing it
 * @private
 * @function
 * @param {object} exception
 * @param {string} exception.type
 * @param {string} exception.message
 * @returns {Error}
*/
function createExceptionFromMessage( self, exception ) {
  var type, message

  try {
    if( isNode ) {
      type = eval( exception.type )
    }
    else {
      type = typeof global[exception.type] == 'function' ? global[exception.type] : Error
    }
  }
  catch( exception ) {
    type = Error
  }

  message = exception.message

  return new type( message )
}

/*
* Memoize a function
* @private
* @function
*/
function memoize( fn ) {
  var _placeholder = {}
  var cache = _placeholder
  return function() {
    if( cache !== _placeholder ) {
      return cache
    }
    cache = fn.apply( null, arguments )
    return cache
  }
}

/*
 * Handle worker error
 * @private
 * @function
 * @event
*/
 function workerOnErrorHandler( self, event ) {
  var message, error, errorType, errorMessage

  event.preventDefault()

  message = event.message
  error = message.match(/Uncaught\s([a-zA-Z]+)\:(.*)/)

  try {
    errorType = typeof global[error[1]] == 'function' ? global[error[1]] : Error
    errorMessage = typeof global[error[1]] == 'function' ? error[2] : message
  }
  catch( exception ) {
    errorType = Error
    errorMessage = message
  }

  error = new errorType( errorMessage )

  self.emit( 'exception', error )
}

/*
 * Get the sourcecode for this worker
 * @private
 * @function
 * @returns {string}
*/
function getWorkerSourcecode( self ) {
  var src

  src = ""

  if( self.importScripts.length ) {
    src += "importScripts( '" + self.importScripts.join("','") + "' );\n"
  }

  src += " var definitions = {};"

  for( var i = 0; i < self.definitions.length; i++ ) {
    src += " definitions['" + self.definitions[i].key + "'] = " + self.definitions[i].val + ";\n"
  }

  src += "self.onmessage = function( event ) { " +
           "try {" +
              "var data = event.data;" +
              "var result = definitions[data.command].apply(this, data.args);" +
              "var out = { messageId: data.messageId, result: result };" +
              "this.postMessage( out );" +
           "}" +
           "catch( exception ) {" +
             "var message = { messageId: data.messageId, exception: { type: exception.name, message: exception.message } };" +
             "this.postMessage(message);" +
           "}" +
         "};"

  return src
}
