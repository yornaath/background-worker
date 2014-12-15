var BackgroundWorker = require( '../../' )
var expect           = require( 'expect.js' )
var sharedAPI        = require( './sharedAPI' )


describe( 'BackgroundWorker', function() {

  describe( 'WebWorker', function() {

    sharedAPI()
    testImportScripts()

  })

  describe( 'Iframe', function() {

    before(function() {
      BackgroundWorker._oriHasWorkerSupport = BackgroundWorker.hasWorkerSuppor
      BackgroundWorker.hasWorkerSupport = function(){ return false }
    })

    after(function() {
      BackgroundWorker.hasWorkerSupport = BackgroundWorker._oriHasWorkerSupport
    })

    sharedAPI()
    testImportScripts()

  })

})

function testImportScripts () {
  it('should import scripts', function( done ) {
    var worker

    worker = new BackgroundWorker({
      importScripts: [location.protocol + "//" + location.host + "/base/test/assets/import.js"],
    })

    worker.define('func', function(){ return importedFunc() }.toString())

    worker.run('func').then(function( res ) {
      expect(res).to.equal('imported')
      done()
    })
  })
}
