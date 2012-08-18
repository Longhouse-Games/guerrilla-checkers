var express = require('express')

var port = 4000;
if (process.argv && process.argv[2])
{
  port = process.argv[2];
}
var app = express.createServer(
  express.logger()
);


app.all('/*', function(req, res, next) {
  res.send('received');
});
app.listen(port);
console.log('server listening on: ' + port);


