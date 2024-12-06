const quotes = [
    "Chickens are quite often the only smart things in your home.",
    "You are all the things that are wrong with you.",
    "You're responsible for your own happiness, you stupid piece of s***.",
    "You know, it’s funny; when you look at someone through rose-colored glasses, all the red flags just look like flags.",
    "Every day it gets a little easier. But you gotta do it every day—that’s the hard part.",
    "That's too much, man.",
    "It’s never too late to be the person you want to be.",
    "Closure is a made-up thing by Steven Spielberg to sell movie tickets.",
    "Fool me once, shame on you. Fool me twice, shame on me. Fool me three times, shame on you again. Fool me four times... what am I doing wrong?",
    "Don't stop dancing until the curtain falls.",
    "Time's arrow marches forward.",
    "Do, or do not. There is no try.",
    "It’s not who I am underneath, but what I do that defines me.",
    "Life is like a box of chocolates. You never know what you’re gonna get.",
    "Why do we fall? So we can learn to pick ourselves up.",
    "Carpe diem. Seize the day, boys. Make your lives extraordinary.",
    "All we have to decide is what to do with the time that is given to us.",
    "Hope is a good thing, maybe the best of things, and no good thing ever dies.",
    "Great men are not born great, they grow great.",
    "You can’t live your life for other people. You’ve got to do what’s right for you, even if it hurts some people you love.",
    "To infinity and beyond!",
    "Don’t let anyone ever make you feel like you don’t deserve what you want.",
    "Our lives are defined by opportunities, even the ones we miss.",
    "It’s supposed to be hard. If it wasn’t hard, everyone would do it. The hard is what makes it great.",
    "Just keep swimming.",
    "After all, tomorrow is another day.",
    "Oh yes, the past can hurt. But you can either run from it, or learn from it.",
    "Every man dies, not every man really lives.",
    "Do what you have to do so you can do what you want to do.",
    "Happiness can be found even in the darkest of times, if one only remembers to turn on the light.",
    "It is not our abilities that show what we truly are. It is our choices."
];

function displayRandomQuote() {
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById("quote").textContent = randomQuote;
}
