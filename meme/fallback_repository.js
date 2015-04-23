module.exports = class FallbackMemeRepository {
  constructor(...repositories) {
    this.repositories = repositories;
  }

  listMemes() {
    return Promise.all(this.repositories.map(repo => repo.listMemes()))
      .then((memes) => memes.reduce((all, group) => all.concat(group)))
  }

  findMeme(meme) {
    return this.repositories.reduce(
      (promise, repo) => promise.catch(error => repo.findMeme(meme)),
      Promise.reject(new Error("Meme not found"))
    );
  }
}
