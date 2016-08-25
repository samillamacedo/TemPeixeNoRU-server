const diacritics = require('diacritics')
const string_score = require('string_score')

const CHARS_NORMAL     = /[a-zA-Z\ ]/g
const CHARS_NOT_NORMAL = /[^a-zA-Z\ ]/g
const MULTIPLE_SPACES  = /\s\s+/g

exports.normalize = (str) => {
  str = str.trim()
  str = str.replace(/\n/g, ' ')
  str = str.replace(/\*/g, '')
  str = str.replace(MULTIPLE_SPACES, ' ')
  return str
}

exports.simplify = (str) => {
  str = exports.normalize(str)
  str = str.toLowerCase()
  str = diacritics.remove(str)
  str = str.replace(CHARS_NOT_NORMAL, '')
  return str
}

exports.looksLike = (strA, strB) => {
  return strA.score(strB, 0.5)
}

exports.prepend = (str, length, filler) => {
  str = str + ''
  return (filler).repeat(Math.max(length - str.length, 0)) + (str)
}
