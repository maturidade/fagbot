"use strict";

if (process.env.NODE_ENV != "production") require("dotenv").load({ silent: true });

var APP_URL = process.env.APP_URL;
var BOT_TOKEN = process.env.BOT_TOKEN;
var SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
var CONDUIT_USER = process.env.CONDUIT_USER;
var CONDUIT_CERTIFICATE = process.env.CONDUIT_CERTIFICATE;
var CONDUIT_API_URL = process.env.CONDUIT_API_URL;

var path = require("path");

var express = require("express");
var urljoin = require("url-join");
var request = require("request");
var cowsay = require("cowsay");
var log = console.log;

var LocalMemeRepository = require("./meme/local/repository");
var PhabricatorMemeRepository = require("./meme/phabricator/repository");
var FallbackMemeRepository = require("./meme/fallback_repository");

var MemeRepository = require("./meme/phabricator/repository");
var VoteRepository = require("./vote/repository");
var Bot = require("./slack/bot");
var Conduit = require("./phabricator/conduit");

var conduit = new Conduit(CONDUIT_USER, CONDUIT_CERTIFICATE, CONDUIT_API_URL);
var localMemes = new LocalMemeRepository(path.resolve(__dirname, "memes"));
var phabricatorMemes = new MemeRepository(conduit);
var memeRepository = new FallbackMemeRepository(localMemes, phabricatorMemes);

var voteRepository = new VoteRepository();
var bot = new Bot(BOT_TOKEN);

// Pool upvote
// ex: +sauce
bot.when(/^\+(.+)$/, (message, subject) => {
  log("Upvote", subject, message.user);
  voteRepository.upVote(subject, message.user);
});

// Pool downvote
// ex: -cry
bot.when(/^\-(.+)$/, (message, subject) => {
  log("Downvote", subject, message.user);
  voteRepository.downVote(subject, message.user);
});

// Pool leaderboard
// ex: ?cats
bot.when(/^\?(.+)$/, (message, subject) => {
  log("Leaderboard for", subject);

  voteRepository.votesForSubject(subject).then(votes => {
    log(subject, votes.up.length, votes.down.length);
    bot.postMessage(subject + " tem " + votes.up.length + " votos a favor e " + votes.down.length + " contra.", message.channel);
  }, () => {
    log(subject, " not found");
    bot.postMessage("Ninguém votou na enquete \"" + subject + "\" ainda...", message.channel);
  });
});

// Meme!!11!
// ex: sashakiss
bot.when(/^([^\s]+)$/, (message, meme) => {
  memeRepository.findMeme(meme).then(meme => {
    log("Meme", meme, "in a jorney for the lulz");
    bot.postMeme(meme, message.channel);
  }, () => log("Meme " + meme + " not found"));
});

var app = express();

// Slack slash command /meme
app.get("/meme", (req, res) => {
  memeRepository.listMemes().then(memes => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write(memes.join("\n"));
    res.end();
  });
});

// Slack slash command /cowsay
app.get("/cowsay", (req, res) => {
  var options = req.query.text.match(/-f\s*(\w*)\s*(.*)/);
  var toSay = {
      text: req.query.text
    };
  if (options != null) {
    toSay = {
      f: options[1],
      text: options[2]
    };
  }
  request({
    uri: SLACK_WEBHOOK_URL,
    method: "POST",
    json: {
      text: "```\n" + cowsay.say(toSay) + "\nby - " + req.query.user_name + "```",
      channel: "#" + req.query.channel_name,
      username: "cow",
      icon_emoji: ":cow:"
    }
  });

  res.status(204).end();
});

var memePath = "/meme/:name";

app.get(memePath, (req, res) => {
  memeRepository.findMeme(req.params.name).then(meme => {
    meme.getImage().pipe(res);
  }, () => {
    res.status(404).end();
  });
});

// Let's teach the bot how to retrieve a meme
bot.memeUrl = function(meme) {
  return urljoin(APP_URL, memePath).replace(":name", meme);
}

var server = app.listen(process.env.PORT || 3000, () => {
  log("Server listening port", server.address().port);

  log("Time to wake up the engines")
  bot.start(name => log("Bot " + name + " up and running"));
});
