const http = require('http')
const sync = require('./sync')
const SYNC_HOURS = 1

// Server Configurations
let env = process.env
const serverPort = env.OPENSHIFT_NODEJS_PORT || env.PORT || 8080
const serverIPAddress = env.OPENSHIFT_NODEJS_IP || '127.0.0.1'

// Global cardapio data
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
  if(cardapioError || !cardapioData){
    response.writeHead(500, {})
    response.end(cardapioError ? cardapioError : 'Cardapio not synced.')
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

// Lift server
server.listen(serverPort, serverIPAddress, (err) => {
  console.log(`Server is UP: ${serverIPAddress}:${serverPort}`)
})

// Create a timer to fetch the cardapio every hour
setInterval(syncCardapio, 60 * 1000 * 60 * SYNC_HOURS)
syncCardapio()

// Auto ping to keep server alive every 5 minutes
setInterval(function() {
    http.get("http://tempeixenoru.herokuapp.com");
}, 300000)
