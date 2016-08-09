const http = require('http')

var dadosMock = require('./database-mock');

const server = http.createServer((request, response) => {
  if(request.url != '/api/v1/cardapio.json'){
    response.writeHead(404, {
      'Content-Type': 'text/html; charset=utf-8',
    })

    response.end('Página não encontrada')
  }

  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
  })

  response.end(JSON.stringify(dadosMock))
})

server.listen(process.env.PORT || 2800)

console.log('Server is listening')
