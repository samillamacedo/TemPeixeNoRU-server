const _ = require('lodash')
const path = require('path')
const async = require('async')
const chalk = require('chalk')

const StringUtil = require('./StringUtil')

const MONTHS = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
}

// Verifies if a given text is a Month header,
// and returns the month number if it's a month header
let getMonthFromHeader = (txt) => {
  if(!txt)
    return false

  let string = txt.$.txt.toLowerCase().trim()

  // Checks if it has 'Cardápio' in its content
  if(string.search(/card.pio\s/g) < 0)
    return false

  // Checks if it is BOLD
  let hasBold = false
  for(let c in txt.textline[0].text){
    if(txt.textline[0].text[c].$.font.indexOf('Bold') < 0)
      continue;

    hasBold = true;
    break;
  }

  if(!hasBold)
    return false

  // Checks if contains a month
  let month = StringUtil.simplify(string.split(/[\s\/]+/gi)[1])

  // Check if it has the 2nd element
  if(!month)
    return false

  // Check if the month is contained in the MONTHS mapping
  if(month in MONTHS)
    return MONTHS[month]

  return false
}

// Looks for a text that has both 'CARDÁPIO' text and a MONTH after it
exports.parse = (pdf) => {

  let page = pdf.page[0];
  let textboxes = pdf.page[0].textbox;

  // Find out the month header
  let monthText = _.find(textboxes, getMonthFromHeader)
  let month = getMonthFromHeader(monthText)

  if(!month){
    // Defaults to the current month
    console.error(chalk.red('Could not find month from PDF. Using current one'))
    let today = new Date()
    month = today.getMonth() + 1
  }

  console.log(chalk.red('Month:'), month)

  return month
}
