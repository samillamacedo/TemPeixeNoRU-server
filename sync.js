const _ = require('lodash')
const fs = require('fs')
const http = require('http')
const path = require('path')
const chalk = require('chalk')
const stringScore = require('string_score')

const PdfReader = require('./PdfReader')
const StringUtil = require('./StringUtil')

const CardapioMonthParser = require('./CardapioMonthParser')
const CardapioTableParser = require('./CardapioTableParser')
const CardapioObservationParser = require('./CardapioObservationParser')

const URL_CARDAPIO = 'http://proap.ufabc.edu.br/images/PDF/Cardapio.pdf'

let downloadCardapio = (fileName, cb) => {
  let file = fs.createWriteStream(fileName);
  let request = http.get(URL_CARDAPIO, function (response) {
    response.pipe(file);
    file.on('finish', function (){
      file.close(cb)
    })
  });

  request.on('error', function (err){
    fs.unlink(fileName)
    cb && cb(err.message)
  })
}

// Given a simple text like 'Agridoce/ Abobrinha ralada/ Cenoura cozida'
// and a list of observations like:
// [{title: 'Agridoce', text: ...}, {title: 'Cenoura cozida', text: ...}]
// returns a collectionlike:
// [
//    {name: Agridoce, info: ...}
//    {name: ..., info: ...}
// ]
let processMealItems = (text, observations) => {
  // Split text into tokens
  let tokens = text.split('/')
  tokens = _.map(tokens, StringUtil.normalize)

  // Map tokens and compute it's simplified string
  tokens = _.map(tokens, (token) => {
    return {
      text: token,
      simplified: StringUtil.simplify(token),
    }
  })

  // Check if there is real content
  tokens = _.filter(tokens, s => !!s.simplified)

  // Find closest observation for each item
  let meals = _.map(tokens, (meal) => {

    // Find (possible) info in observations
    let info = closestObservationMatch(meal.simplified, observations)

    return {
      name: meal.text,
      info: (info ? info.text : null)
    }
  })

  return meals
}

// Given a text and a list of observations, find out
// if there is a match and returns that text match
let closestObservationMatch = (text, observations) => {
  return _.find(observations, obs => {
    if(obs.simpleTitle.score(text, 0.5) > 0.7)
      return true

    return false
  })
}


let fileName = 'tmp/cardapio.pdf';

// Fetches the cardapio from the UFABC url, and parses it.
exports.fetch = (next) => {
  downloadCardapio(fileName, (err) => {
    if (err) {
      return next && next(err);
    }

    // fileName = 'tests/cardapio6.pdf'

    PdfReader.read(path.join(__dirname, fileName), (err, pdf) => {
      if (err) {
        return next && next(err);
      }

      try{

        // Get tabled data
        let table = CardapioTableParser.parse(pdf)

        // Get observations from the end of the menu
        let observations = CardapioObservationParser.parse(pdf)

        // Get (starting) month from cardapio
        let month = CardapioMonthParser.parse(pdf)

        // Sanitize all strings in table
        table = _.mapValues(table, day => {
          return _.mapValues(day, str => StringUtil.normalize(str))
        })

        // Build final cardapio (this is the final JSON)
        let json = {
          lastUpdate: new Date(),
          menu: []
        }

        // Reverse-Mapping from header names
        let WeekDays = {
          seg: 'Segunda',
          ter: 'Terça',
          qua: 'Quarta',
          qui: 'Quinta',
          sex: 'Sexta',
          sab: 'Sábado',
          dom: 'Domingo',
        }

        // Reverse-Mapping from meal names
        let MealNames = {
          saladas: 'Saladas',
          guarnicao: 'Guarnição',
          carneJanta: 'Carne (Jantar)',
          carneAlmoco: 'Carne (Almoço)',
          vegetariano: 'Vegetariano',
        }

        // Auxiliary variable used to detect month changes
        let lastDay = 0
        let monthOffset = 0

        // Iterate trough all days (columns)
        for(let day in table){
          let column = table[day]
          let menu = {}

          // Set weekday
          menu.day = WeekDays[day]

          // Compute month day
          let monthDay = parseInt(column.dia)
          if(lastDay > monthDay){
            // "pretend" to add a month
            monthOffset = 1
          }
          lastDay = monthDay

          // Process month
          let date = ''
          date += StringUtil.prepend(column.dia, 2, '0')
          date += '/'
          date += StringUtil.prepend(month + monthOffset, 2, '0')
          menu.date = date

          // Process meals (Groups)
          menu.meals = []
          for(let group in column){
            // Skip keys that are not present in MealNames
            if(!(group in MealNames))
            continue;

            let txt = column[group]
            let meal = {
              group: MealNames[group],
              items: processMealItems(txt, observations),
            }

            // Push group only if meal exists
            if(meal.items)
            menu.meals.push(meal)
          }

          json.menu.push(menu)
        }

        // Callback with parsed cardapio
        return next && next(null, json);
      }catch(e){
        // An error occurred.
        return next && next(e)
      }
    })
  })
}
