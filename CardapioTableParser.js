const _ = require('lodash')
const path = require('path')
const async = require('async')
const chalk = require('chalk')

let findCabecalhos = (texts) => {
  var pesquisas = {
    dia: /Prepara..o/g,
    seg: /^SEG/g,
    ter: /^TER/g,
    qua: /^QUA/g,
    qui: /^QUI/g,
    sex: /^SEX/g,
    sab: /^SAB/g,
    saladas: /Salad/g,
    guarnicao: /Guarni/g,
    carneJanta: /Carne\s+\(Janta/g,
    carneAlmoco: /Carne\s+\(Almo/g,
    vegetariano: /Opção sem carne/g,
  }

  let found = {}

  for (let k in texts){
    let text = texts[k].$.txt

    for (let i in pesquisas){
      let pesquisa = pesquisas[i]

      if (text.search(pesquisa) >= 0)
        found[i] = texts[k]
    }
  }

  return found
}

// Finds the maximum distance between the closest headers
let maximumMinimumHeaderDistance = (texts, XorY) => {
  let max = 0
  for(let c1 in texts){
    let x1 = texts[c1].$.center[XorY]
    let localMin = Infinity

    for(let c2 in texts){
      let x2 = texts[c2].$.center[XorY]
      let dist = Math.abs(x2 - x1)

      // Skip distance between itself if its the same block of text
      if(texts[c1].$.id == texts[c2].$.id) {
        continue
      }

      // Save minimum distance
      localMin = Math.min(localMin, dist)
    }

    // Set max to maximum value
    max = Math.max(max, localMin)
  }

  return max
}

// Given a collection of text objects, and headers,
// snap to closest horizontal/vertical headers and
// pushes data to the cell's object array.
//
// texts:
//    textbox list
//
// headers:
//    list of headers in the following format:
//    {
//      rows: {
//        rowA: {textbox object, with center set},
//        rowB: {...},
//        rowC: {...},
//      },
//      cols: {
//        colA: {textbox object, with center set},
//        colB: {...},
//        colC: {...},
//      }
//    }
//
// return: (array of [columns][rows])
//    [
//        ['Col1Row1', 'Col1Row2', ..., 'Col1RowN'],
//        ['Col2Row1', 'Col2Row2', ..., 'Col2RowN'],
//        [...],
//        ['ColNRow1', 'ColNRow2', ..., 'ColNRowN'],
//    ]
//
let parseTable = (pdf, headers) => {
  let rows = _.keys(headers.rows).length
  let cols = _.keys(headers.cols).length
  let table = {};

  let texts = pdf.textbox
  let rects = pdf.rect

  // Initialize table array
  for(let c in headers.cols){
    let obj = {}
    for(let k in headers.rows)
      obj[k] = null

    table[c] = obj
  }

  // Create a mapping table for the rows (using it's id's)
  // example:
  //    A header array like:
  // [
  //    {$: {id: 987}},
  //    {$: {id: 555}},
  // ]
  //    Becomes a mapping to it's original index:
  // {
  //    555: 1,
  //    987: 0,
  // }
  let mappings = { cols: {}, rows: {} }
  for(let k in mappings)
    for(let c in headers[k])
      mappings[k][headers[k][c].$.id] = c

  // Find (maximum) minimum distance between headers/columns
  // In order to have a threshold to discover if a text is
  // 'outside' the table.
  let minX = maximumMinimumHeaderDistance(headers.cols, 'x') / 2

  // let minY = maximumMinimumHeaderDistance(headers.rows, 'y') / 2
  // We cannot use the same strategy to vertical headers, as
  // they can be wrongly vertically aligned. That, could cause
  // a header to be close to the previous one, and missunderstand
  // the text to another row.
  // The way it's done, is by finding (good) HORIZONTAL lines, and
  // setting minimum and maximum thresholds.
  // By "good", we mean: PERFECT horizontal lines, with a length of
  // at least minX.

  // First, iterate trough rects and find horizontal lines
  let lines = {}
  for(let l in rects){
    let rect = rects[l]

    // Check if it's horizontal
    if(rect.$.h < 3 && rect.$.w > 30){
      lines[rect.$.y] = rect.$.y
    }
  }
  lines = _.values(lines)

  // Now, we find out top and bottom line limits
  for(let r in headers.rows){
    let row = headers.rows[r]
    let centerY = row.$.y

    // Find top most value
    row.$.limitTop = _.minBy(lines, lineY => {
      return (centerY < lineY ? Infinity : centerY - lineY)
    })

    row.$.limitBot = _.minBy(lines, lineY => {
      return (centerY > lineY ? Infinity : lineY - centerY)
    })
  }

  // Utility function to find out what's the closest column header
  let closestColumnHeader = (text, testHeaders, threshold) => {
    let minDistance = Infinity
    let bestHeader = null
    for(let t in testHeaders){
      let testHeader = testHeaders[t]
      let dist = Math.abs(testHeader.$.center.x - text.$.center.x)
      let sameId = testHeader.$.id == text.$.id

      // Check if distance is smaller and also it's not the same text block
      if(dist < threshold && dist < minDistance && !sameId){
        minDistance = dist
        bestHeader = testHeader
      }
    }
    return bestHeader
  }

  // Utility function to find out what's the closest row header
  let closestRowHeader = (text, testHeaders) => {
    for(let t in testHeaders){
      let testHeader = testHeaders[t]
      let sameId = testHeader.$.id == text.$.id
      let testY = text.$.center.y
      let yMax = testHeader.$.limitBot
      let yMin = testHeader.$.limitTop

      // Check if distance is smaller and also it's not the same text block
      if(testY >= yMin && testY <= yMax && !sameId){
        return testHeader
      }
    }
    return null
  }

  // Iterate through all texts and find out in witch "quadrant"
  // it fits better (Proximity with x/y)
  for(let t in texts){
    let text = texts[t]

    let closestCol = closestColumnHeader(text, headers.cols, minX)
    let closestRow = closestRowHeader(text, headers.rows)

    // Skip texts that do matches both row and column
    if(closestCol === null || closestRow === null)
      continue;

    // Place content into table array
    let indexCol = mappings.cols[closestCol.$.id]
    let indexRow = mappings.rows[closestRow.$.id]

    // Initialize cell's array if not yet
    if(!_.isArray(table[indexCol][indexRow]))
      table[indexCol][indexRow] = []

    // Push textblock to cell
    table[indexCol][indexRow].push(text)
  }

  // Process cells to single text
  // (Order them and then merge)
  for(let c in table){
    for(let r in table[c]){
      let cell = table[c][r]

      // No data found. Set as null
      if(!cell) {
        table[c][r] = null
        continue
      }

      // Order texts into Y then X
      cell = _.sortBy(cell, ['$.y', '$.x']).reverse()

      // Join text and set to table
      table[c][r] = _.map(cell, '$.txt').join(' ')
    }
  }

  return table
}

exports.parse = (pdf) => {

  let page = pdf.page[0];
  let textboxes = pdf.page[0].textbox;
  let headerTexts = findCabecalhos(textboxes)

  let headers = {
    rows: {
      'dia':  headerTexts.dia,
      'carneAlmoco':  headerTexts.carneAlmoco,
      'carneJanta':  headerTexts.carneJanta,
      'vegetariano':  headerTexts.vegetariano,
      'guarnicao':  headerTexts.guarnicao,
      'saladas':  headerTexts.saladas,
    },

    cols: {
      'seg': headerTexts.seg,
      'ter': headerTexts.ter,
      'qua': headerTexts.qua,
      'qui': headerTexts.qui,
      'sex': headerTexts.sex,
      'sab': headerTexts.sab,
    }
  }

  let table = parseTable(page, headers)

  return table;
}
