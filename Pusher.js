const _ = require('lodash')
const FCM = require('fcm-node');

let fcm = new FCM(process.env.FIREBASE_MESSAGE_KEY);

exports.push = (matchTopics, title, text) => {
  let condition = _.map(matchTopics, t => `'${t}' in topics`).join(' && ')

  let message = {
    condition: condition,
    collapse_key: 'meal',
    time_to_live: 60 * 60 * 8,
    notification: {
        title: title,
        body: text,
        priority: 'high',
        sound: 'default',
        color: '#fee445',
        tag: 'meal',
    }
  }
  console.log('Pushing message...')
  fcm.send(message, (err, response) => {
    if (err) {
        console.error('Failed to send notification', err);
    } else {
        console.log('Notification sent!', response);
    }
  });
}
