var responses = require("./intent_responses.js")
exports.handler = function(event, context, callback){
    var intent = event.currentIntent.name;
    var candidate_responses = responses[intent] || responses['default']
    var return_value = candidate_responses[Math.floor(Math.random() * candidate_responses.length)];

    var action = {
        "dialogAction": {
            "type": "Close",
            "fulfillmentState": "Fulfilled",
            "message":{
                "contentType": "PlainText",
                "content": return_value
            },
        }
    }
            callback(null, action)
}

//exports.handler({currentIntent: {name:"Where_are_stop_numbers"}}, {}, (err, r) => console.log(r))