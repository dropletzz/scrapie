const axios = require('axios');
const cheerio = require('cheerio');
const async = require('async');
const fs = require('fs');
const util = require('util');

const BASE_URL = 'http://keygenmusic.net/';
const MAX_CONCURRENT_REQUESTS = 1;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const writeFile = util.promisify(fs.writeFile);

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
  const res = await axios.get(BASE_URL + href);
	const $ = cheerio.load(res.data);
	$.html();
	const linkList = $('table.teamtable > tbody > tr > td.ttleft > a');
  pagesCount = pagesCount + 1;
  console.log(pagesCount);
  return Array.from(linkList.map((_, a) => a.attribs.href));
}

let songCount = 0;
let errors = [];
const saveSong = async href => {
  const fileName = href.split('/').slice(-1)[0];
  try {
    const res = await axios.get(BASE_URL + href);
    songCount = songCount + 1;
    console.log(songCount);
    await writeFile('scraped_data/songs/compressed/' + fileName, res.data);
  } catch (e) {
    errors.push(href);
    console.log("error downloading", href);
  }
  await wait(100);
}

// main
(async () => {
  const homepageHTML = await getHomepage();
  const $ = cheerio.load(homepageHTML);
  $.html();

  const menu = $('.menucontainer > ul')[0];
  const artists = $(menu).children('li');
  let hrefs = Array.from(
    artists.map((_, a) => a.children[0].attribs.href)
  );
  // hrefs = [ hrefs[1], hrefs[2], hrefs[3] ];
  // hrefs = [ hrefs[0] ];

  console.log("getting song links...")
  let songHrefs = (await async.mapLimit(
    hrefs, MAX_CONCURRENT_REQUESTS, getSongsHrefs
  )).flat();
  console.log("...gotten", songHrefs.length, "links")

  console.log("downloading songs...");
  try {
    await async.eachLimit(songHrefs, MAX_CONCURRENT_REQUESTS, saveSong);
  } catch (e) {
    console.log(e);
  }
  console.log("...done!");

  console.log("errors: ", errors)

  // async.mapLimit(hrefs, MAX_CONCURRENT_REQUESTS, countSongs)
  // .then(res => {
  //   console.log(res.reduce((a,b)=>a+b, 0));
  // })
  // .catch(console.log);
})();
