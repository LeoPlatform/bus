try {
    module.exports = require(`../../../../config/leo-bus/${process.env.NODE_ENV}-leo-stream-table-processor-event.js`)
} catch (err) {
    console.log(err);
}