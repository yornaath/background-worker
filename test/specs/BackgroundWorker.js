var BackgroundWorker = require( '../../' )


describe( 'BackgroundWorker', function() {

  describe( 'WebWorker', function() {

    TestSharedAPI()

  })

  describe( 'Iframe', function() {

    before(function() {
      BackgroundWorker._oriHasWorkerSupport = BackgroundWorker.hasWorkerSuppor
      BackgroundWorker.hasWorkerSupport = function(){ return false }
    })

    after(function() {
      BackgroundWorker.hasWorkerSupport = BackgroundWorker._oriHasWorkerSupport
    })

    TestSharedAPI()

  })

})

function TestSharedAPI(){

  describe( 'BackgroundWorker#run', function(){

    it('should run predefined functions', function( done ){
      var worker

      worker = new BackgroundWorker()

      worker.define('add', function( a, b ){ return a + b })
      worker.define('sub', function( a, b ){ return a - b })

      Promise.all([
        worker.run('add', [1, 2]),
        worker.run('sub', [5, 4])
        ]).then(function( results ) {
          expect(results[0]).to.equal( 3 )
          expect(results[1]).to.equal( 1 )
          done()
        })
      })

      it('should run first argument as default function if first argument is a function to constructor', function( done ) {
        var worker

        worker = new BackgroundWorker(function() {
          return "default"
        })

        worker.define('other', function(){
          return "other"
        })

        worker.run().then(function( result ) {
          expect( result ).to.equal( "default" )
          worker.run('other').then(function( result ) {
            expect( result ).to.equal( "other" )
            done()
          })
        })

      })

    })

    describe('BackgroundWorker#terminate', function() {

      it('should not throw exception of trying to run a terminated worker', function() {
        var worker

        worker = new BackgroundWorker()

        worker.terminate()

        expect(function(){
          worker.run()
        }).to.throwException(function (e) {
          expect(e.message.toLowerCase().match('terminated')).to.be.ok()
        });
      })

    })

    describe( 'Exceptions', function() {

      it('should throw correct typeof exception', function( done ) {
        var worker

        worker = new BackgroundWorker()

        worker.define('TypeError', function(){ throw new TypeError() })
        worker.define('SyntaxError', function(){ throw new SyntaxError() })

        worker.run('SyntaxError').catch(function( error ) {
          expect( error ).to.be.a(SyntaxError)
          worker.run('TypeError').catch(function( error ) {
            expect( error ).to.be.a(TypeError)
            done()
          })
        })

      })

    })

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
