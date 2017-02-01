// A minimal UI for Sudoku, an A/B experiment lab for 6.831.

// This file intentionally exposes its names to global scope to
// simplify testing, so you can directly manipulate the state, for
// example, by
//    setcurnumber(3)
// or 
//    state=currentstate(); state.answer[0]=3+1; commitstate(state);

// For a quick user experience, we use a 2x2x2x2-sized sudoku game.
Sudoku.init(2);

var PRODUCTION_MODE = false;   // Enables context menus.
var USE_LOCAL_STORAGE = true;  // Enables saving state to localStorage.
var SHOW_TIMER = 1;            // Enables timer.
var SYMMETRIC_PUZZLES = false; // Allows asymmetric puzzles.

// This app uses url-based state to support deep linking.  That means
// almost all the application state is stored in the URL, which allows
// the user to bookmark the page to save and share the screen they see.
// It also allows browser's "back" button to work for undo.
//
// The url, therefore, is the main global state variable:
//
//   state = currentstate(); will read the current state from the URL.
//   commitstate(state); will save state to the URL (and localStorage),
//
// If you remember (e.g., log) the URL string, you will be able to
// recreate most of the game state by linking back to it.
//
// The only UI state which is not saved in the hash are the variables
// below having to do with transient visual effects such as selection,
// focus, and the visible timer.

var starttime = (new Date).getTime();  // t=0 for the visible timer.
var runningtime = false;               // true if the timer is running.
var visiblefocus = null;               // location of a blue focus rect.
var curnumber = null;                  // currently selected number.


/////////////////////////////////////////////////////////////////////////////
// Page and Game Set-up
/////////////////////////////////////////////////////////////////////////////

// The main entry point: runs when the page is finished loading.
$(function() {
  var sinit;
  // Generate static HTML such as the number palette.
  setup_screen();
  if (window.location.hash && (sinit = currentstate()).seed) {
    // If the URL contains game state, adjust the time and log an event.
    starttime = (new Date).getTime() - sinit.elapsed;
    $(document).trigger('log', ['linkgame', {seed: sinit.seed}]);
    saveseed(sinit.seed);
  } else {
    // For a bare URL, modify the url to have a game (generated or loaded).
    setupgame(0);
  }
  // Render the current state of the game based on the URL.
  redraw();
  // Re-render whenever the URL hash changes.
  $(window).bind('hashchange', function() {
    redraw();
  });
  // Set the selected number to the 'eraser'.
  setcurnumber(0);
});

// This function generates or loads (from localStorage) puzzle #X,
// and makes it the current puzzle.
function setupgame(seed) {
  // If no seed is given, remember the last seed or take the default 1.
  if (!seed) { seed = loadseed(); }
  // Log an event for the new game.
  $(document).trigger('log', ['setupgame', {seed: seed}]);
  // Remember this is the last seed played.
  saveseed(seed);
  // If there is already a saved game for this seed, load it.
  if (loadgame(storagename(seed))) { return; }
  // Otherwise generate one: make it quickly, and make it symmetric.
  var quick = false;
  var puzzle = Sudoku.makepuzzle(seed, quick, SYMMETRIC_PUZZLES);
  // Remember the moment this game was created as gentime.
  var gentime = (new Date).getTime();
  // Commit the game state to the URL.
  commitstate({
    puzzle: puzzle,
    seed: seed,
    answer: [],
    work: [],
    elapsed: 0,
    timer: SHOW_TIMER,
    gentime: gentime,
  });
}


/////////////////////////////////////////////////////////////////////////////
// URL hash state management
/////////////////////////////////////////////////////////////////////////////

// Retrieve current state from URL.
function currentstate() {
  return decodeboardstate(gethashdata());
}

// Save state in URL and localstorage.
function commitstate(state) {
  var now = (new Date).getTime();
  if (state.gentime > starttime) {
    starttime = state.gentime;
  }
  // automatically update elapsed time unless already solved
  if (!victorious(state) || !victorious(currentstate())) {
    state.elapsed = (now - starttime);
  }
  sethashdata(encodeboardstate(state));
  savestate(storagename(state.seed), state);
}

// Parses a url-parameter-style string after the current URL hash parts.
function gethashdata() {
  var result = {};
  window.location.hash.substr(1).split("&").forEach(function (pair) {
    if (pair === "") return;
    var parts = pair.split("=");
    result[parts[0]] =
          parts[1] && decodeURIComponent(parts[1].replace(/\+/g, " "));
  });
  return result;
}

// Sets a url-parameter-style string as the hash part of a url.
function sethashdata(data) {
  window.location.hash = $.param(data);
}


/////////////////////////////////////////////////////////////////////////////
// Transient UI: popups, focus, selection, timer
/////////////////////////////////////////////////////////////////////////////

// Move the focus rectangle.
function setvisiblefocus(kf) {
  if (visiblefocus !== null) {
    $(visiblefocus).find('div.sudoku-border').toggleClass('focus', false);
  }
  visiblefocus = kf;
  if (visiblefocus !== null) {
    $(visiblefocus).find('div.sudoku-border').toggleClass('focus', true);
  }
}

// Set the currently-selected number.  Zero is the eraser.
function setcurnumber(num) {
  $('td.numberkey-cell').toggleClass('selected', false);
  $('#nk' + num).toggleClass('selected', true);
  curnumber = num;
}

// Dismiss popup messages.
function hidepopups() {
  $('div.sudoku-popup').css('display', 'none');
}

// Unhide the popup with a given id.
function showpopup(id) {
  var velt = $(id);
  var telt = $('table.sudoku');
  var position = telt.offset();
  position.left += (telt.outerWidth() - velt.outerWidth()) / 2;
  position.top += (telt.outerHeight() - velt.outerHeight()) / 3;
  velt.css({
    display: 'block',
    left: position.left,
    top: position.top
  });
}

// Format timer text.
function formatelapsed(elapsed) {
  if (!(elapsed >= 0)) { return '-'; }
  var seconds = Math.floor(elapsed / 1000);
  var minutes = Math.floor(seconds / 60);
  var hours = Math.floor(minutes / 60);
  seconds -= minutes * 60;
  minutes -= hours * 60;
  var formatted = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  if (hours > 0) {
    formattted = hours + ':' + (minutes < 10 ? '0' : '') + formatted;
  }
  return formatted;
}

// The countdown timer redraws itself using this function.
function updatetime() {
  if (runningtime && $('.timer').is(':visible')) {
    $('.timer').text(formatelapsed((new Date).getTime() - starttime));
    setTimeout(updatetime,
        1001 - (((new Date).getTime() - starttime) % 1000));
  } else {
    runningtime = false;
  }
}


/////////////////////////////////////////////////////////////////////////////
// Number palette interactions
/////////////////////////////////////////////////////////////////////////////

// We always use "on" so we can bind events to elements which do not exist
// at the beginning of the program when we are setting up binding.
//
// Read http://api.jquery.com/on/#direct-and-delegated-events
// to understand why we are doing this.

// Clicks outside other regions set the number palette to 'eraser'.
$(document).on('click', function(ev) {
  if (!$(ev.target).is('a,input')) {
    setcurnumber(0);
  }
  hidepopups();
});

// Clicks in the number palette.
$(document).on('click', 'td.numberkey-cell', function(ev) {
  var num = parseInt($(this).attr('id').substr(2));
  setcurnumber(num);
  ev.stopPropagation();
});


/////////////////////////////////////////////////////////////////////////////
// Suoku board interactions
/////////////////////////////////////////////////////////////////////////////

// Mouse entering a sudoku cell sets visible focus.
$(document).on('mouseenter', 'td.sudoku-cell', function(ev) {
  $(this).find('div.sudoku-border').toggleClass('focus', true);
  setvisiblefocus(this);
  ev.stopPropagation();
});

// Mouse leaving a sudoku cell sets visible focus.
$(document).on('mouseleave', 'td.sudoku-cell', function(ev) {
  $(this).find('div.sudoku-border').toggleClass('focus', false);
  setvisiblefocus(null);
  ev.stopPropagation();
});

if (PRODUCTION_MODE) {
  // Defeats right-click context menu.
  $(document).on('contextmenu', function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
  });
}

// Defeats normal sudoku-cell click-handling on mouseup.
$(document).on('click', 'td.sudoku-cell', function(ev) {
  ev.stopPropagation();
});

// Handle sudoku cell clicks on mousedown.
$(document).on('mousedown', 'td.sudoku-cell', function(ev) {
  ev.preventDefault();
  hidepopups();
  var pos = parseInt($(this).attr('id').substr(2));
  var state = currentstate();
  // Ignore the click if the square is given in the puzzle.
  if (state.puzzle[pos] !== null) return;
  // Internally we store "1" as "0".
  var num = curnumber - 1;
  if (num == -1) {
    // Erase this square.
    state.answer[pos] = null;
    state.work[pos] = 0;
  } else if (isalt(ev)) {
    // Undiscoverable: write small numbers if ctrl is pressed.
    state.answer[pos] = null;
    state.work[pos] ^= (1 << num);
  } else {
    // Set the number
    state.answer[pos] = num;
    state.work[pos] = 0;
    // Update elapsed time immediately, to avoid flicker upon victory.
    if (victorious(state)) {
      var now = (new Date).getTime();
      if (state.gentime > starttime) {
        starttime = state.gentime;
      }
      state.elapsed = (now - starttime);
      $(document).trigger('log', ['victory', {elapsed: state.elapsed}]);
    }
  }
  // Immeidate redraw of just the keyed cell.
  redraw(state, pos);
  // Commit state after a timeout
  setTimeout(function() {
    commitstate(state);
  }, 0);
});

// Detects if a modifier key is pressed.
function isalt(ev) {
  return (ev.which == 3) || (ev.ctrlKey) || (ev.shiftKey);
}


/////////////////////////////////////////////////////////////////////////////
// Next/Previous game handling
/////////////////////////////////////////////////////////////////////////////

// Increments or decrements the seed, then sets up that game.
function flippage(skip) {
  var state = currentstate();
  var seed = parseInt(state.seed);
  if (seed >= 1 && seed <= 1e9) {
    savestate(storagename(seed), state);
  }
  seed += skip;
  if (!(seed >= 1 && seed <= 1e9)) {
    seed = 1;
  }
  setupgame(seed);
}

// Handles the next button.
$(document).on('click', '#nextbutton', function(ev) {
  flippage(1);
});

// Handles the previous button.
$(document).on('click', '#prevbutton', function(ev) {
  flippage(-1);
});

/////////////////////////////////////////////////////////////////////////////
// Clear/Check game handling
/////////////////////////////////////////////////////////////////////////////

// Clear the answers.
$(document).on('click', '#clearbutton', function(ev) {
  hidepopups();
  var state = currentstate();
  var cleared = {puzzle: state.puzzle, seed: state.seed, timer: state.timer,
                 answer:[], work:[], gentime: (new Date).getTime()};
  commitstate(cleared);
});

// Releasing the "check" button.
$(document).on('mouseup mouseleave touchend', '#checkbutton', function() {
  if ($('#victory').css('display') != 'none') {
    return;
  }
  hidepopups();
  var state = currentstate();
  redraw(state);
});

// Depressing the "check" button.
$(document).on('mousedown touchstart', '#checkbutton', function(ev) {
  hidepopups();
  var state = currentstate();
  var sofar = boardsofar(state);
  // Check for conflicts.
  var conflicts = SudokuHint.conflicts(sofar);
  if (conflicts.length == 0) {
    // We are all good so far - and maybe have a win.
    showpopup(countfilled(sofar) == Sudoku.S ? '#victory' : '#ok');
  } else {
    // Oops - there is some mistake.
    showpopup('#errors');
  }
  ev.stopPropagation();
});

// Defeat normal click handliing for the "check" button.
$(document).on('click', '#checkbutton', function(ev) {
  if ($('#victory').css('display') != 'none') {
    ev.stopPropagation();
  }
});


/////////////////////////////////////////////////////////////////////////////
// Win conditions
/////////////////////////////////////////////////////////////////////////////

// Returns an array with one entry per puzzle square, containing
// null for any unfilled square, and a number from 0-(N-1) for any
// square that was filled by the user or given as part of the puzzle.
function boardsofar(state) {
  var sofar = state.puzzle.slice();
  for (var j = 0; j < Sudoku.S; j++) {
    if (state.answer[j] !== null) sofar[j] = state.answer[j];
  }
  return sofar;
}

// Counts the number of squares that have been filled in, total.
function countfilled(board) {
  var count = 0;
  for (var j = 0; j < Sudoku.S; j++) {
    if (board[j] !== null) count += 1;
  }
  return count;
}

// Checks for victory.
function victorious(state) {
  var sofar = boardsofar(state);
  if (countfilled(sofar) != Sudoku.S) return false;
  if (SudokuHint.conflicts(sofar).length != 0) return false;
  return true;
}


/////////////////////////////////////////////////////////////////////////////
// Render game state
/////////////////////////////////////////////////////////////////////////////

// Redraws the sudoku board.  If 'pos' is passed, only that square is drawn.
function redraw(s, pos) {
  var state = s ? s : currentstate();
  var startpos = 0;
  var endpos = Sudoku.S;
  if (typeof pos != 'undefined') { startpos = pos; endpos = pos + 1; }
  var puzzle = state.puzzle;
  var answer = state.answer;
  var work = state.work;
  var victory = victorious(state);
  var timer = ('timer' in state && state.timer);
  var seed = state.seed;

  // Set the title of the puzzle.
  var title = seed ? ('Puzzle #' + seed) : 'Custom Puzzle';
  $('#grade').html(title);
  // Show appropriate victory UI.
  if (victory) {
    runningtime = false;
    $('.timer').text(formatelapsed(state.elapsed));
  } else {
    $('#victory').css('display', 'none');
  }
  // Render timer UI
  $('.progress').css('display', victory ? 'none' : 'inline');
  $('.finished').css('display', victory ? 'inline' : 'none');
  $('.timescore').css('visibility', timer ? 'visible' : '');
  $('.timescore .timer').css('display', timer ? 'inline' : 'none');
  if (!victory) {
    $('.timer').text(formatelapsed((new Date).getTime() - starttime));
  }
  // If the timer should be running but it is not, get it going.
  if (timer && !victory && !runningtime) {
    runningtime = true;
    updatetime();
  }
  // Run through the sudoku board and render each square.
  for (var j = startpos; j < endpos; j++) {
    if (puzzle[j] !== null) {
      // Render a given-number in bold.
      $("#sn" + j).attr('class', 'sudoku-given').html(puzzle[j] + 1);
    } else {
      if (answer[j] !== null || work[j] == 0) {
        // Render an answered-number in pencil.
        $("#sn" + j).attr('class', 'sudoku-answer').html(
            answer[j] === null ? '&nbsp;' : handglyph(answer[j] + 1));
      } else {
        // Render a grid of mini-numbers, work in progress.
        var text = '<table class="sudoku-work-table">';
        for (var n = 0; n < Sudoku.N; n++) {
          if (n % Sudoku.B == 0) { text += '<tr>'; }
          text += '<td><div>' +
          ((work[j] & (1 << n)) ? handglyph(n + 1) : '&nbsp;') +
          '</div></td>';
          if (n % Sudoku.B == Sudoku.B - 1) { text += '</tr>'; }
        }
        text += '</table>'
        $("#sn" + j).attr('class', 'sudoku-work').html(text);
      }
    }
  }
}


/////////////////////////////////////////////////////////////////////////////
// localStorage handling
/////////////////////////////////////////////////////////////////////////////

// The localStorage key used for this game.
function storagename(seed) {
  return 'sudokupage_' + seed;
}

// Tries to load a saved game from a localStorage key, then commits
// the state to the URL (triggering a re-render). False if not found.
function loadgame(name) {
  var state = loadstate(name);
  if (!state) return false;
  if (!state.puzzle || !state.puzzle.length) return false;
  if ('elapsed' in state) {
    starttime = (new Date).getTime() - state.elapsed;
  }
  commitstate(state);
  return true;
}

// Loads JSON data from localStorage, or null if not found.
function loadstate(name) {
  if (!USE_LOCAL_STORAGE ||
      !('localStorage' in window) || !('JSON' in window) ||
      !(name in window.localStorage)) {
    return null;
  }
  var data = localStorage[name];
  var state = JSON.parse(data);
  return state;
}

// Saves the passed data to a localStorage key as JSON.
function savestate(name, state) {
  if (!USE_LOCAL_STORAGE ||
      !('localStorage' in window) || !('JSON' in window)) {
    return;
  }
  localStorage[name] = JSON.stringify(state);
}

// Remembers the last saved seed.
function loadseed() {
  return loadstate('sudokuseed') || 1;
}

// Saves the seed being played.
function saveseed(seed) {
  savestate('sudokuseed', seed);
}



/////////////////////////////////////////////////////////////////////////////
// State serialization
/////////////////////////////////////////////////////////////////////////////

// Encodes the game state as a set of scalars.
function encodeboardstate(state) {
  var result = {
    puzzle: encodepuzzle(state.puzzle)
  }
  if ('answer' in state) { result.answer = encodepuzzle(state.answer); }
  if ('work' in state) { result.work = arraytobase64(state.work); }
  if ('seed' in state) { result.seed = state.seed; }
  if ('gentime' in state) { result.gentime = state.gentime; }
  if ('elapsed' in state) { result.elapsed = state.elapsed; }
  if ('timer' in state) { result.timer = state.timer; }
  result.size = Sudoku.B;
  return result;
}

// Loads game state from a set of scalars.
function decodeboardstate(data) {
  if ('size' in data) {
    // Do not load state from an incompatible size.
    if (Sudoku.B != data.size) {
      data = {}
    }
  }
  var puzzle = decodepuzzle('puzzle' in data ? data.puzzle : '');
  var answer = decodepuzzle('answer' in data ? data.answer : '');
  var work = base64toarray('work' in data ? data.work : '');
  var result = {
    puzzle: puzzle,
    answer: answer,
    work: work
  };
  if ('seed' in data) { result.seed = data.seed; }
  if ('gentime' in data) { result.gentime = data.gentime; }
  if ('elapsed' in data) { result.elapsed = data.elapsed; }
  if ('timer' in data) { result.timer = parseInt(data.timer); }
  return result;
}


/////////////////////////////////////////////////////////////////////////////
// Simple string serialization for number arrays
/////////////////////////////////////////////////////////////////////////////

// Encodes an sparse array of small integers as a short string.
function encodepuzzle(puzzle) {
  if (!puzzle) return '';
  var result = [];
  for (var j = 0; j < puzzle.length; j++) {
    result.push(puzzle[j] === null ? 0 : puzzle[j] + 1);
  }
  return result.join('');
}

// Decodes an array that was encoded by encodepuzzle.
function decodepuzzle(str) {
  var puzzle = [];
  var c = 0;
  for (var j = 0; j < str.length; j++) {
    var num = str.charCodeAt(j) - '0'.charCodeAt(0);
    puzzle.push(num == 0 ? null : (num - 1));
  }
  for (; j < Sudoku.S; j++) {
    puzzle.push(null);
  }
  return puzzle;
}

// Encodes a nubmer less that 4096 in base64.
function shorttobase64(int18) {
  return base64chars[(int18 >> 6) & 63] +
         base64chars[int18 & 63];
}

// Decodes a nubmer less that 4096 in base64.
function base64toshort(base64, index) {
  return (base64chars.indexOf(base64.charAt(index)) << 6) +
          base64chars.indexOf(base64.charAt(index + 1));
}

// Encodes an array of numbers less than 4096 in base64, skipping end zeros.
function arraytobase64(numbers) {
  var result = [];
  for (var end = numbers.length; end > 0; end--) {
    if (numbers[end - 1]) break;
  }
  for (var j = 0; j < end; j++) {
    result.push(shorttobase64(numbers[j]));
  }
  return result.join('');
}

// Decodes an array of numbers less than 4096 in base64, padding end zeros.
function base64toarray(base64) {
  var result = [];
  for (var j = 0; j + 1 < base64.length; j += 2) {
    result.push(base64toshort(base64, j));
  }
  for (j /= 2; j < Sudoku.S; j++) {
    result.push(0);
  }
  return result;
}

// Constant to set up for use by encoders above.
var base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                  "abcdefghijklmnopqrstuvwxyz" +
                  "0123456789" +
                  "-_";

/////////////////////////////////////////////////////////////////////////////
// Static HTML construction.
/////////////////////////////////////////////////////////////////////////////

// Generates HTML for an NxN Sudoku table.
function boardhtml() {
  var text = "<table class=sudoku id=grid cellpadding=1px>\n";
  text += "<tr><td colspan=13 class=sudoku-border>" +
          "<img class=sudoku-border></td></tr>\n";
  for (var y = 0; y < Sudoku.N; y++) {
    text += "<tr>"
    text += "<td class=sudoku-border></td>"
    for (var x = 0; x < Sudoku.N; x++) {
      var c = y * Sudoku.N + x;
      text += "<td class=sudoku-cell id=sc" + c + ">" +
              "<div class=sudoku-border>" +
              "<div class=sudoku-number id=sn" + c + ">" +
              "&nbsp;</div></div>";
      if (x % Sudoku.B == Sudoku.B - 1) text += "<td class=sudoku-border></td>";
    }
    text += "</tr>\n";
    if (y % Sudoku.B == Sudoku.B - 1) {
      text += "<tr><td colspan=13 class=sudoku-border>" +
              "<img class=sudoku-border></td></tr>\n";
    }
  }
  text += "<tr><td colspan=" + Sudoku.N + " id=caption></td></tr>\n";
  text += "</table>\n";
  return text;
}

// Makes a handwritten number, handling a glyph substitution.
function handglyph(text) {
  // The "1" doesn't look as one-like as the capital-I in Handlee.
  if ('' + text === '1') { return 'I'; }
  return text;
}

// Generates HTML for the number palette from 1 to N, plus an eraser.
function numberkeyhtml() {
  var result = '<table class=numberkey>';
  for (var j = 1; j <= Sudoku.N; ++j) {
    result += '<tr><td class=numberkey-cell id=nk' + j + '>' +
        '<div class="sudoku-answer nk' + j + '">' +
          handglyph(j) + '</div></td></tr>';
  }
  result += '<tr><td class=numberkey-cell id=nk0>' +
        '<div class="eraser nk0">' +
        '&#xf12d;</div></td></tr>';
  result += '</table>';
  return result;
}

// Pours generated HTML into the HTML page.
function setup_screen() {
  $('#centerlayout').prepend(boardhtml());
  $('#leftlayout').prepend(numberkeyhtml());
}


