const _ = require('lodash')
const path = require('path')
const async = require('async')
const chalk = require('chalk')

const StringUtil = require('./StringUtil')

let REGEX_OBSERVATION = /(.+):(.+)\./ig

// Check if matches an observation
let isObservation = (txt) => {
  return (('$' in txt ? txt.$.txt : txt).search(REGEX_OBSERVATION) >= 0)
}

// Read tokens and keep track of the Bold/notBold characters. Breaks
// everytime it in change from non-bold to bold
let readObservations = (text) => {
  let rawLines = text.$.txt.split('\n')
  let observations = [];
  let lines = []

  // Merge line breaks
  for(let l in rawLines){
    if(rawLines[l].indexOf(':') >= 0){
      // A new token has been found. Push to a new line
      lines.push(rawLines[l])
    }else if(lines.length > 0) {
      // Append to last item
      lines[lines.length - 1] += rawLines[l]
    }
  }

  // Tokenize (Split on `:`)
  for(let l in lines){
    let line = lines[l]
    let splited = line.split(':')

    let observation = {
      simpleTitle: StringUtil.simplify(splited[0]),

      title: StringUtil.normalize(splited[0]),
      text: StringUtil.normalize(splited[1]),
    }

    // Skip this observation if it has no text
    if(!observation.title || !observation.text)
      continue;

    // Add observation to arraylist
    observations.push(observation)
  }

  return observations
}

exports.parse = (pdf) => {

  let page = pdf.page[0];
  let textboxes = pdf.page[0].textbox;

  let observations = textboxes
  // Filter ones that have at least one observation
  observations = _.filter(observations, isObservation)
  // Explode string int more observations
  observations = _.flatMap(observations, readObservations)

  return observations
}
