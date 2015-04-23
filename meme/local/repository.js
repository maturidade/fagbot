"use strict";

var fs = require("fs");
var path = require("path");

var Meme = require("../meme");

module.exports = class MemeRepository {
  constructor(storageDir) {
    this.storageDir = storageDir;
  }

  listMemes() {
    return new Promise((resolve, reject) => {
      fs.readdir(this.storageDir, (error, files) => {
        if (error) return reject(error);

        resolve(files.filter(file => !file.startsWith(".")).map(file => this.buildMeme(file)));
      });
    });
  }

  findMeme(name) {
    return this.listMemes().then(memes => {
      var meme = memes.find(meme => meme.name == name);

      if (meme) {
        return meme;
      } else {
        return Promise.reject(new Error("Meme not found"));
      }
    });
  }

  buildMeme(file) {
    var name = path.basename(file, path.extname(file));
    var absolutePath = path.resolve(this.storageDir, file);
    return new Meme(name, () => fs.createReadStream(absolutePath));
  }
}
