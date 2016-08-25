const http = require('http')

const sync = require('./sync')

const SYNC_HOURS = 1

let cardapioData = null
let cardapioError = null

const server = http.createServer((request, response) => {
  if(request.url != '/api/v1/cardapio.json'){
    response.writeHead(404, {
      'Content-Type': 'text/html; charset=utf-8',
    })

    response.end('Página não encontrada')
  }

  // If in error state...
  if(cardapioError){
    response.writeHead(500, {})
    response.end(cardapioError)
    return;
  }

  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
  })

  response.end(JSON.stringify(cardapioData))
})

// Fetches the cardapio and saves to cardapioData
function syncCardapio(){
  console.log('Sync data...')
  let startTime = Date.now()
  sync.fetch((err, data) => {
    if(err){
      cardapioError = err;
      cardapioData = null;

      console.error('Failed to sync cardapio: ', err)
      console.log('Attempting a new sync in 1 minute...')
      setTimeout(syncCardapio, 60 * 1000)
    }else{
      cardapioError = null;
      cardapioData = data;
      console.log('Sync success!', (Date.now() - startTime), 'ms')
    }
  })
}

// Create a timer to fetch the cardapio every hour
setInterval(syncCardapio, 60 * 1000 * 60 * SYNC_HOURS)
syncCardapio()

server.listen(process.env.PORT || 2800)
console.log('Server is listening')
