
const http = require('http')
const server = http.createServer((request, response) => {
  response.writeHead(200, {
    'Content-Type': 'text/html',
  })

  response.write('Hello World2')
  response.end()

})

server.listen(process.env.PORT || 2800)

console.log('Server is listening')
