background-worker ![](https://api.travis-ci.org/gorillatron/background-worker.svg)
=========

### Usage
```javascript
var BackgroundWorker = require( 'background-worker' )

var worker = new BackgroundWorker()

worker.define( 'add', ( a, b ) ->  a + b )

worker.run( 'add', [1, 2] ).then((res) -> {
  res === 3
})
.finally( () -> worker.terminate() )
```

Execute tasks on web Workers without seperate files.

*Partially made, with <3 at:*

[![Foo](http://wtw.no/gfx/wtw-logo2.png)](https://github.com/wtw-software/)
