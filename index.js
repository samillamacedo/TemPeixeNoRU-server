const http = require('http')

var dadosMock = require('./database-mock');

const server = http.createServer((request, response) => {
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
  })

  response.write(JSON.stringify(dadosMock))
  response.end()
})

server.listen(process.env.PORT || 2800)

console.log('Server is listening')
