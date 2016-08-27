const _ = require('lodash')
const http = require('http')
const schedule = require('node-schedule')

const sync = require('./sync')
const Pusher = require('./Pusher')
const StringUtil = require('./StringUtil')

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
server.listen(serverPort, (err) => {
  console.log(`Server is UP: ${serverIPAddress}:${serverPort}`)
})

// Week names
const WEEK_NAMES = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
]

// Utility to find meals (returns first one)
function findMeal(menu, group){
  let meal = _.find(menu.meals, {group: group})
  if(!meal)
    return null

  return meal.items[0].name
}

// Schedule lunch notifications
var lunch = schedule.scheduleJob('0 0 4 * * *', function(){
  buildAndPush('Almoço')
});

var dinner = schedule.scheduleJob('0 0 17 * * *', function(){
  buildAndPush('Jantar')
});

// Builds up message from cardapio and pushes to users
function buildAndPush(meal){
  let now = new Date()
  let day = now.getDay()
  let dayName = WEEK_NAMES[day]

  console.log(`Notify ${meal}: ${dayName}`);

  // Find menu in cardapio
  let menu = _.find(cardapioData.menu, {day: dayName})
  if(!menu){
    console.log('Menu was empty. Not notifying...')
    return
  }

  // Find meals
  let meat = findMeal(menu, `Carne (${meal})`)
  let extra = findMeal(menu, 'Guarnição')
  let vegetarian = findMeal(menu, 'Vegetariano')

  // Skip if doesn't have meat (means it is not open)
  if(!meat) {
    console.log('Meat is empty. Looks like its closed')
    return
  }

  // Prepare texts
  let hasFish = StringUtil.simplify(meat).indexOf('peixe') >= 0
  let txtMeat = `${meat} e ${extra}`
  let titleMeat = (hasFish ? 'Sim, tem peixe no RU!' : 'Sem peixe, mas tem')

  let txtVegetarian = `${vegetarian} e ${extra}`
  let titleVegetarian =`${meal} de ${dayName}`

  // Push notification
  Pusher.push(['lunch', 'vegetarian'], titleVegetarian, txtVegetarian)
  Pusher.push(['lunch', 'meat'], titleMeat, txtVegetarian)
  Pusher.push(['teste'], titleMeat, txtVegetarian)
}

// Create a timer to fetch the cardapio every hour
setInterval(syncCardapio, 60 * 1000 * 60 * SYNC_HOURS)
syncCardapio()

// Auto ping to keep server alive every 5 minutes
setInterval(function() {
    http.get("http://tempeixenoru.herokuapp.com");
}, 300000)
