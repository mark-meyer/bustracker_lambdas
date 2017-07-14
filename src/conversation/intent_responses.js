// Try to keep responses under 160 characters so Twilio doesn't need to send concatonated responses, which cost more
/*
    This module provides a mapping of intent to response for aws lex chat bot.
*/
module.exports = {
    "Where_are_stop_numbers": [
        "Stop numbers are printed on the bus stop signs. You can also send me the nearest cross streets or address and I'll send you stops that are within a mile."
        ],
    "hello":[
        "Hi! To get started, send me a bus stop number.",
        "Hello There! If you want to know when the next bus is coming, send me a stop number.",
        "Uvlulluataq! If you want to know when the bus is coming, send me a stop number.", //Iñupiaq
        "Waqaa!, Send me a bus stop number and I'll tell you when the bus is coming."
        ],
    "How_does_this_work":[
        "Send a bus stop number and I'll send the ETA of the next bus. If you don't know the stop number tell me where you are and I'll try to find the nearest stops."
        ],
    "When_is_the_bus":[
        "I can tell you when the next bus will come, but I need a stop number. Stop numbers are printed on the bus stop signs. You can also send me a location."
    ],
    "goodbye":[
        "Adiós!",
        "Ukudigada! (That's goodbye in Aleut)",
        "Until next time",
        "Näkemiin! (That's how they say goodbye in Finland)",
        ],
    "thanks":[
        "You're welcome.",
        "No problem, thanks for using the bus tracker.",
        "No problem, always here if you need anything else."
        ],
    "default":["I'm sorry, I didn't quite undertand that"]

}
