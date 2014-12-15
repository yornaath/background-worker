
var definitions = {
  define: function( definition ){
    eval("definitions['" +definition.key+ "'] = " + definition.val)
  }
}

process.on( 'message', function( event ) {
  try {
    var data = event
    var result = definitions[data.command].apply(this, data.args);
    var out = { messageId: data.messageId, result: result };
    if( data.command !== 'define' ) {
      process.send( out )
    }
  }
  catch( exception ) {
    var message = { messageId: data.messageId, exception: { type: exception.name, message: exception.message } };
    process.send( message )
  }
})
