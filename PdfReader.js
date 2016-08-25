const _ = require('lodash')
const xml2js = require('xml2js')
const spawn = require('child_process').spawn
const PythonShell = require('python-shell')

let PdfReader = {}
module.exports = PdfReader

// pdf2txt.py -t text -L 0.5 -A tmp/cardapio3.pdf
PdfReader.read = function read(file, next) {
  let output = ''

  let pdf2txt = spawn('pdf2txt.py', [
    '-t', 'xml',
    '-L', '0.1',
    '-M', '1.0',
    '-A',
    file
  ])

  pdf2txt.stdout.on('data', (data) => {
    output += data
  })

  pdf2txt.on('close', (code) => {
    if (code !== 0) {
      return next && next(`Failed to parse pdf to xml. exit code: ${code}`)
    }

    xml2js.parseString(output, (err, pdf) => {
      if(err)
        return next && next(err);

      pdf.pages.page = _.map(pdf.pages.page, PdfReader.postProcessPage);
      next && next(null, pdf.pages);
    })
    // console.log('closed', code)
  })
}

PdfReader.postProcessBbox = (node) => {
  // Convert bbox from string to separated parsed numbers
  let bbox = _.map(node.$.bbox.split(','), n => _.toNumber(n));

  node.$.x = bbox[0];
  node.$.y = bbox[1];
  node.$.w = bbox[2] - bbox[0];
  node.$.h = bbox[3] - bbox[1];
  node.$.center = {
    x: (bbox[0] + bbox[2]) / 2,
    y: (bbox[1] + bbox[3]) / 2,
  }
}

PdfReader.postProcessPage = (page) => {
  // Iterate trought all rects
  for(let k in page.rect)
    PdfReader.postProcessBbox(page.rect[k])

  // Iterate trought all textboxes
  for(let k in page.textbox){
    let txts = [];
    let textbox = page.textbox[k]

    // Process bbox
    PdfReader.postProcessBbox(textbox)

    // Iterate inside each line of textbox
    for(let l in textbox.textline){
      let textline = textbox.textline[l]

      // Join all bits of text together
      let txt = _.reduce(textline.text, (t, node) => {
        // Append if it's a string
        if (_.isString(node)) {
          return t
        }

        // Append node._ to string or adds a space if not found
        return t + ('_' in node ? node._ : ' ')
      }, '')

      // Add line to lines array
      txts.push(txt)
    }

    // Append the array to textbox object
    textbox.$.txt = txts.join('\n')
    // textbox.$.txts = txts
  }

  return page;
}

// PdfReader.read('tmp/cardapio2.pdf', (err, data) => {
//   // console.log(JSON.stringify(data, null, 1))
//   console.log(PdfReader.postProcessTextbox(data.pages.page[0]))
//   console.log('Err:', err)
// });
