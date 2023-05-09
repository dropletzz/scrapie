const fs = require('fs');
const util = require('util');
const stream = require('stream');

const axios = require('axios'); // make http requests
const cheerio = require('cheerio'); // parse and scrape downloaded html pages
const async = require('async');

const BASE_URL = 'https://web.archive.org/web/20221209060129/http://keygenmusic.net/';
const MAX_CONCURRENT_REQUESTS = 3;
const TIME_TO_WAIT_AFTER_REQUEST = 30; // ms

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const writeFile = util.promisify(fs.writeFile);
const finishedStreaming = util.promisify(stream.finished);

const getHomepage = async () => {
  const res = await axios.get(BASE_URL);
  return res.data;
}

const countSongs = async href => {
  const res = await axios.get(BASE_URL + href);
	const $ = cheerio.load(res.data);
	$.html();
	const table = $('table.teamtable')[0];
	const tr = table.children[0].children;
	return (tr.length - 1) / 2;
}

let pagesCount = 0;
const getSongsHrefs = async href => {
  try {
    const res = await axios.get(BASE_URL + href);
    const $ = cheerio.load(res.data);
    $.html();
    const linkList = $('table.teamtable > tbody > tr > td.ttleft > a');
    pagesCount = pagesCount + 1;
    console.log(pagesCount);
    return Array.from(linkList.map((_, a) => a.attribs.href));
  } catch (e) {
    console.log("error downloading page: ", href);
  }
  return []
}

let songCount = 0;
let errors = [];
const saveSong = async href => {
  const fileName = href.split('/').slice(-1)[0];
  const url = BASE_URL + href;
  const outputPath = 'scraped_data/songs/' + fileName;

  const writer = fs.createWriteStream(outputPath);

  try {
    const res = await axios.get(url, {
      method: 'GET',
      responseType: 'stream',
    });

    res.data.pipe(writer);
    await finishedStreaming(writer);
    songCount = songCount + 1;
    console.log(songCount);
  } catch (e) {
    errors.push(href);
    console.log("error downloading", href);
  }
}

const getSongsHrefsAndWait = async href =>
  getSongsHrefs(href).then(wait(TIME_TO_WAIT_AFTER_REQUEST));

const saveSongAndWait = async href =>
  saveSong(href).then(wait(TIME_TO_WAIT_AFTER_REQUEST));

const scrape = async () => {
  const homepageHTML = await getHomepage();
  const $ = cheerio.load(homepageHTML);
  $.html();

  const menu = $('.menucontainer > ul')[0];
  const artists = $(menu).children('li');
  let hrefs = Array.from(
    artists.map((_, a) => a.children[0].attribs.href)
  );
  // hrefs = [ hrefs[1], hrefs[2], hrefs[3] ];

  // Count how many songs would be downloaded
  // async.mapLimit(hrefs, MAX_CONCURRENT_REQUESTS, countSongs)
  // .then(res => res.reduce((a,b)=>a+b, 0))
  // .then(console.log)
  // .catch(console.log);
  // return 0;

  console.log("getting song links...")
  let songHrefs = (await async.mapLimit(
    hrefs, MAX_CONCURRENT_REQUESTS, getSongsHrefsAndWait
  )).flat();
  console.log("...gotten", songHrefs.length, "links")

  console.log("downloading songs...");
  try {
    await async.eachLimit(songHrefs, MAX_CONCURRENT_REQUESTS, saveSongAndWait);
  } catch (e) {
    console.log(e);
  }
  console.log("...done!");
  console.log("errors: ", errors);
}

// main
(async () => {
  // TEST
  // try {
    // await saveSong('music/2000ad/2000AD-CreaturesToTheRescue+3trn.7z');
  // } catch (e) { console.log(e) }

  // return 0;
  await scrape();
})();
