var BackgroundWorker = require( '../../' )
var Promise          = require( 'bluebird' )
var expect           = require( 'expect.js' )

module.exports = function sharedAPI(){

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
        Promise.all([
          worker.run('add', [1, 2]),
          worker.run('sub', [5, 4])
          ]).then(function( results ) {
            expect(results[0]).to.equal( 3 )
            expect(results[1]).to.equal( 1 )
            done()
          })
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

  describe( 'States', function() {

    it('Should be BackgroundWorker.CREATED for newly created workers', function() {
      var worker = new BackgroundWorker()
      expect( worker._state ).to.eql( BackgroundWorker.CREATED )
    })

    it('Should be BackgroundWorker.TERMINATED for workers terminated', function() {
      var worker = new BackgroundWorker()
      worker.terminate()
      expect( worker._state ).to.eql( BackgroundWorker.TERMINATED )
    })

    it('Should be BackgroundWorker.IDLE for started workers', function() {
      var worker = new BackgroundWorker()
      worker._start()
      expect( worker._state ).to.eql( BackgroundWorker.CREATED )
      worker.terminate()
    })

    it('Should be BackgroundWorker.RUNNING for workers executing work', function( done ) {
      var worker = new BackgroundWorker()
      worker.define( 'fn', "function(){ return 'wat' }" )
      expect( worker._state ).to.eql( BackgroundWorker.CREATED )
      worker.run('fn').then(function(){ done() })
      expect( worker._state ).to.eql( BackgroundWorker.RUNNING )
    })

    it('Should be BackgroundWorker.IDLE for after done working', function( done ) {
      var worker = new BackgroundWorker()
      worker.define( 'fn', "function(){ return 'wat' }" )
      expect( worker._state ).to.eql( BackgroundWorker.CREATED )
      worker.run('fn').then(function() {
        expect( worker._state ).to.eql( BackgroundWorker.IDLE )
        done()
      })
      expect( worker._state ).to.eql( BackgroundWorker.RUNNING )
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

}
