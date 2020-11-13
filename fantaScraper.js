// The Chromium based scraper helper
const puppeteer = require('puppeteer');
// webPage
var fantacalcioPageCalendar = "https://leghe.fantacalcio.it/robocup/calendario";
// Map <teamName, array>, where array collects ordered entries of every match
let teamResults = new Map();

let teamIds = new Set();
// Store the calendar, so we dont need to recompute it
let teamCalendar = new Map();
// teamLeaderboard to update (team_name, points)
let teamLeaderboard = new Map();
// all possible permutations
let permutations = [];


function scrapeWebPage (url) {
    return new Promise(async (resolve, reject) => {
        try {
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.goto(url);
            let urls = await page.evaluate(() => {
                let results = [];
                Array.from(document.querySelectorAll('li')).some(li => {
                  // Get Turn
                  let data_turn_index = li.getAttribute('data-turn-index');
                  if(data_turn_index != null) {
                    // Extract info for team home
                    let teamHomeDiv = li.querySelector('div.team-home');
                    let team_home =  teamHomeDiv.querySelector('h5.team-name').innerText;
                    let team_home_id = teamHomeDiv.getAttribute('id');
                    let team_home_score = teamHomeDiv.querySelector('div.team-score').innerText;
                    // clear score string by spaces and \n
                    team_home_score = team_home_score.replace(/[^A-Z0-9]/ig, "");
                    let team_home_fpt = teamHomeDiv.querySelector('div.team-fpt').innerText;

                    // Extract info for team away
                    let teamAwayDiv = li.querySelector('div.team-away');
                    let team_away =  teamAwayDiv.querySelector('h5.team-name').innerText;
                    let team_away_id = teamAwayDiv.getAttribute('id');
                    let team_away_score = teamAwayDiv.querySelector('div.team-score').innerText;
                    // clear score string by spaces and \n
                    team_away_score = team_away_score.replace(/[^A-Z0-9]/ig, "");
                    let team_away_fpt = teamAwayDiv.querySelector('div.team-fpt').innerText;

                    results.push({
                      data_turn_index: data_turn_index,
                      team_home_id: team_home_id,
                      team_home: team_home,
                      team_home_score: team_home_score,
                      team_home_fpt: team_home_fpt,
                      team_away_id: team_away_id,
                      team_away: team_away,
                      team_away_score: team_away_score,
                      team_away_fpt: team_away_fpt,
                    });
                  }
                });
                return results;
            });
            browser.close();
            return resolve(urls);
        } catch (e) {
            return reject(e);
        }
    })
}

// Compute all permutations of a given array
function perm(xs) {
  let ret = [];

  for (let i = 0; i < xs.length; i = i + 1) {
    let rest = perm(xs.slice(0, i).concat(xs.slice(i + 1)));

    if(!rest.length) {
      ret.push([xs[i]])
    } else {
      for(let j = 0; j < rest.length; j = j + 1) {
        ret.push([xs[i]].concat(rest[j]))
      }
    }
  }
  return ret;
}


// Add entry to the teamResults map
function addTeamResult(entry) {
  let entryId = entry.team;
  let array_value = {turn: entry.data_turn_index,
                     id: entry.team_id,
                     team: entry.team,
                     score: entry.team_score,
                     fpt: entry.team_fpt,
                   };

  if(teamResults.has(entryId)) {
    teamResults.get(entryId).push(array_value);
  } else {
    let array = new Array();
    array.push(array_value);
    teamResults.set(entryId, array);
  }
}

// add Match to Calendar, we'll keep this calendar permuting the teams
function addMatchToCalendar(entry) {
  let turn_id = entry.data_turn_index;
  let array_value = {team_home_id: entry.team_home_id,
                     team_away_id: entry.team_away_id};
   if(teamCalendar.has(turn_id)) {
     teamCalendar.get(turn_id).push(array_value);
   } else {
     let array = new Array();
     array.push(array_value);
     teamCalendar.set(turn_id, array);
   }
}

function evaluateMatch(match) {
  let teamHome = match.home;
  let teamAway = match.away;
  homeScore = match.home_score;
  awayScore = match.away_score;

  if(homeScore === awayScore) {
    teamLeaderboard.set(teamHome, teamLeaderboard.get(teamHome) + 1);
    teamLeaderboard.set(teamAway, teamLeaderboard.get(teamAway) + 1);
  } else if (homeScore > awayScore) {
    teamLeaderboard.set(teamHome, teamLeaderboard.get(teamHome) + 3);
  } else {
    teamLeaderboard.set(teamAway, teamLeaderboard.get(teamAway) + 3)  ;
  }
}

function simulatePermutation(permutation) {
  // map Ids to current permutation
  let currentMap = new Map();
  const idsIterator = teamIds[Symbol.iterator]();
  i = 0;
  for (const item of idsIterator) {
    currentMap.set(item, permutation[i]);
    ++i;
  }

  const calendarDayIterator = teamCalendar[Symbol.iterator]();
  for(const matchDay of calendarDayIterator) {
    let turnId = matchDay[0];
    let matches = matchDay[1];
    for(i = 0; i < matches.length; ++i) {
      let currentMatch = matches[i];
      let teamHomeName = currentMap.get(currentMatch.team_home_id);
      let teamAwayName = currentMap.get(currentMatch.team_away_id);
      let teamHomeScore = teamResults.get(teamHomeName)[turnId].score;
      let teamAwayScore = teamResults.get(teamAwayName)[turnId].score;
      evaluateMatch({home: teamHomeName, away: teamAwayName, home_score: teamHomeScore, away_score: teamAwayScore});
    }
  }
}

// print Leaderboard in order, otherwise M.Ferro romp o cazz :*
function printLeaderBoard() {
  console.log("\nLeaderboard");

  teamLeaderboard[Symbol.iterator] = function* () {
      yield* [...this.entries()].sort((a, b) => b[1] - a[1]);
  }

  position = 1;
  for (let [key, value] of teamLeaderboard) {     // get data sorted
      console.log(position + ' ' + key + ' => ' + value);
      position++;
  }
}

// Extract Team Results
function extractTeamResults(data) {
  // Debug output
  console.log('Scraped data entries');
  console.log(data.length);

  for(i = 0; i < data.length; ++i) {
    let entry = data[i];
    if(entry.team_home_score.length) {
      addTeamResult({data_turn_index: entry.data_turn_index,
                    team_id: entry.team_home_id,
                    team: entry.team_home,
                    team_score: entry.team_home_score,
                    team_fpt: entry.team_home_fpt,
                  });
      addTeamResult({data_turn_index: entry.data_turn_index,
                    team_id: entry.team_away_id,
                    team: entry.team_away,
                    team_score: entry.team_away_score,
                    team_fpt: entry.team_away_fpt,
                  });
      addMatchToCalendar({data_turn_index: entry.data_turn_index,
                          team_home_id: entry.team_home_id,
                          team_away_id: entry.team_away_id,
                        });
      teamIds.add(entry.team_home_id);
      teamIds.add(entry.team_away_id);
    }
  }
  // Debug output to check how many teams and entries we stored
  console.log('\nTeams: ');
  teams_array = new Array();

  const iterator = teamResults[Symbol.iterator]();
  for (const item of iterator) {
    console.log(item[0]);
    teams_array.push(item[0]);
    teamLeaderboard.set(item[0], 0);
  }


  // we expect for 8 teams 40320 combinations
  permutations = perm(teams_array);

  console.log('\nNum Permutations');
  console.log(permutations.length);

  for(p = 0; p < permutations.length; ++p) {
      // console.log(p);
     simulatePermutation(permutations[p]);
  }

  // normalize Leaderboard
  const leaderboardIterator = teamLeaderboard[Symbol.iterator]();
  for (const item of leaderboardIterator) {
    teamLeaderboard.set(item[0], item[1] / permutations.length);
  }

  printLeaderBoard();

}

// Js black magic. Call the scrapeWebPage async function and 'then' send result to computePermutations
scrapeWebPage(fantacalcioPageCalendar).then(res => extractTeamResults(res)).catch(console.error);
