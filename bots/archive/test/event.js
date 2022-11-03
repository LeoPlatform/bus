try {
    module.exports = require(`../../../../config/leo-bus/${process.env.NODE_ENV}-leo-archive-event.js`)
} catch (err) {
    console.log(err);
}