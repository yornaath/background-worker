var BackgroundWorker = require( '../../' )


describe( 'BackgroundWorker', function() {

  describe( 'BackgroundWorker#start', function() {

    it( 'should throw exepction if tried to start when allready started', function() {
      var worker

      worker = new BackgroundWorker()

      worker.start()

      expect(function(){ worker.start() })
        .to.throwException()
    })

  })

  describe( 'Exceptions', function() {

    it('should throw correct typeof exception', function( done ) {
      var worker

      worker = new BackgroundWorker()

      worker.define('TypeError', function(){ throw new TypeError() })
      worker.define('SyntaxError', function(){ throw new SyntaxError() })

      worker.start()

      worker.run('SyntaxError').catch(function( error ) {
        expect( error ).to.be.a(SyntaxError)
        worker.run('TypeError').catch(function( error ) {
          expect( error ).to.be.a(TypeError)
          done()
        })
      })

    })

  })

  describe( 'Running in Iframe', function( done ) {

    before(function() {
      BackgroundWorker._oriHasWorkerSupport = BackgroundWorker.hasWorkerSuppor
      BackgroundWorker.hasWorkerSupport = function(){ return false }
    })

    after(function() {
      BackgroundWorker.hasWorkerSupport = BackgroundWorker._oriHasWorkerSupport
    })

    it('Should run', function( done ) {
      var worker

      worker = new BackgroundWorker()

      worker.define('job', function(){ return 'ran' }.toString())

      worker.start()

      worker.run('job').then(function( res ) {
        expect(res).to.equal('ran')
        done()
      })

    })

    it('should import scripts', function( done ) {
      var worker

      worker = new BackgroundWorker({
        importScripts: [location.protocol + "//" + location.host + "/base/test/assets/import.js"],
      })

      worker.define('func', function(){ return importedFunc() }.toString())

      worker.start()

      worker.run('func').then(function( res ) {
        expect(res).to.equal('imported')
        done()
      })
    })

  })

})
