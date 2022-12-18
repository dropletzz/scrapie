const axios = require('axios');
const cheerio = require('cheerio');
const async = require('async');

const BASE_URL = 'http://keygenmusic.net/';
const MAX_CONCURRENT_REQUESTS = 10;

const countSongs = async href => {
  const res = await axios.get(BASE_URL + href);
	const $ = cheerio.load(res.data);
	$.html();
	const table = $('table.teamtable')[0];
	const tr = table.children[0].children;
	return (tr.length - 1) / 2;
}

const getHomepage = async () => {
  const res = await axios.get(BASE_URL);
  return res.data;
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
  hrefs = [ hrefs[1], hrefs[2], hrefs[3] ];

  async.mapLimit(hrefs, MAX_CONCURRENT_REQUESTS, countSongs)
  .then(res => {
    console.log("OK");
    console.log(res.reduce((a,b)=>a+b, 0));
  })
  .catch(console.log);
})();
