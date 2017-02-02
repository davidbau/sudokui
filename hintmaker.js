// A sudoku hint engine, for MIT 6.831.
//
// A framework for implementing various nonbacktracking sudoku deductions.
//
// This code is mostly unused by the example Sudoku app, but could be
// used as a resource if you want to build a hinting interface to help
// users.

var SudokuHint = {};

(function(lib) {

var debugging_enabled = false;

// Run via:
//
// hint = SudokuHint.hint(puzzle, answer, work)
// hint = Sudoku.hint(currentstate())
//
// Returns a hint (if any) with the following fields:
//   hint: 'a string code for the kind of hint'
//   level: the difficulty of the hint
//   exclude: a bitmask of alternatives no longer allowed
//   reduced: array of locations (0-N^2-1) which are constrained by the hint
//   support: array of locations (0-N^2-1) which are evidence of the hint

function hint(puzzle, answer, work) {
  if ('puzzle' in puzzle && 'answer' in puzzle && 'work' in puzzle) {
    work = puzzle.work;
    answer = puzzle.answer;
    puzzle = puzzle.puzzle;
  }
  var result = rawhints(puzzle, answer, work, false);
  if (!result.hints.length) return null;

  // Sort the easiest and most helpful hints first.
  result.hints.sort(hintsort);
  result.hints[0].level = result.level;
  dumphints(result);

  // Return the best hint.
  return result.hints[0];
}

// A raw version of SudokuHint.hint that returns an array of hints,
// after trying a series of deduction algorithms.

function rawhints(puzzle, answer, work, nomistakes) {
  var sofar = boardsofar(puzzle, answer);
  var unz = unzeroedwork(puzzle, answer, work);
  var fzw = work.slice(); // fillzeroeswork(puzzle, answer, work);
  var result = [];
  var level = 0;
  var fb = Sudoku.figurebits(sofar);
  while (true) {
    if (!nomistakes) {
      result = result.concat(conflicts(sofar));
      if (result.length) break;
      result = result.concat(mistakes(puzzle, answer, unz));
      if (result.length) break;
    }
    level = 1;
    result = result.concat(singleposdirect(sofar, fb));
    result = result.concat(singlenumdirect(sofar, fb, unz));
    if (result.length) break;
    level = 2;
    result = result.concat(singlepos(sofar, fb, unz));
    result = result.concat(singlenum(sofar, fzw));
    if (result.length) break;
    level = 3;
    result = result.concat(pointing(sofar, unz, fzw));
    result = result.concat(claiming(sofar, unz, fzw));
    if (result.length) break;
    level = 4;
    // TODO: you could fill in many other deduction strategies here.
    break;
  }
  return {
    level: level,
    hints: result
  };
}

// Utility for printout of hints.

function dumphints(h) {
  if (debugging_enabled) {
    console.log("Level", h.level, "options", h.hints.length,
                "eg", JSON.stringify(h.hints[0]));
  }
}

// Checks for immeidate conflicts: identical numbers in the same
// row, column, or block of the board. Notice that this is not the
// same as checking for numbers that will be wrong in the long run.
// Checking for guesses that will turn out to be wrong is done by
// the function mistakes(), below.

function conflicts(board) {
  var marked = Sudoku.emptyboard();
  for (var axis = 0; axis < 3; axis++) {
    for (var x = 0; x < Sudoku.N; x++) {
      var counts = zero_counts(Sudoku.N);
      for (var y = 0; y < Sudoku.N; y++) {
        var pos = Sudoku.posfor(x, y, axis);
        if (board[pos] !== null) {
          counts[board[pos]] += 1;
        }
      }
      for (var y = 0; y < Sudoku.N; y++) {
        var pos = Sudoku.posfor(x, y, axis);
        if (board[pos] !== null && counts[board[pos]] > 1) {
          marked[pos] = true;
        }
      }
    }
  }
  var errors = [];
  for (var j = 0; j < Sudoku.S; j++) {
    if (marked[j]) errors.push(j);
  }
  if (errors.length == 0) { return []; }
  return [{
    exclude: 0,
    reduced: [],
    support: [],
    hint: 'conflicts',
    size: 0,
    errors: errors
  }];
}

// Checks for mistakes: numbers which we know to be incorrect if the
// board is completely solved.

function mistakes(board, answer, work) {
  var solution = Sudoku.solution(board);
  var errors = [];
  for (var j = 0; j < Sudoku.S; j++) {
    if (board[j] !== null) continue;
    if ((work[j] != 0 && !(work[j] & (1 << solution[j]))) ||
        (answer[j] !== null && answer[j] != solution[j])) {
      errors.push(j);
    }
  }
  if (errors.length == 0) { return []; }
  return [{
    exclude: 0,
    reduced: [],
    support: [],
    hint: 'mistakes',
    size: 0,
    errors: errors
  }];
}

// Returns an array of all the given and filled-in numbers so far,
// given two input arrays: puzzle is the array of initially given numbers,
// answer is the array of user-supplied answers.

function boardsofar(puzzle, answer) {
  var sofar = puzzle.slice();
  for (var j = 0; j < Sudoku.S; j++) {
    if (answer[j] !== null) sofar[j] = answer[j];
  }
  return sofar;
}

// Assume that if a number isn't marked at all within a block,
// the player thinks that the number could be anywhere in the block.

function unzeroedwork(puzzle, answer, work) {
  var result = work.slice();
  var solution = Sudoku.solution(puzzle);
  var sofar = boardsofar(puzzle, answer);
  for (var block = 0; block < Sudoku.N; block++) {
    var marked = 0;
    for (var y = 0; y < Sudoku.N; y++) {
      var pos = Sudoku.posfor(block, y, 2);
      if (sofar[pos] !== null) {
        marked |= (1 << sofar[pos]);
      } else {
        marked |= work[pos];
      }
    }
    var unmarked = Sudoku.M ^ marked;
    if (unmarked != 0) {
      for (var y = 0; y < Sudoku.N; y++) {
        var pos = Sudoku.posfor(block, y, 2);
        if (sofar[pos] === null) {
          result[pos] |= unmarked;
          // benefit of the doubt: assume the player thinks the correct
          // solution is one of the options in an empty square.
          if (work[pos] == 0 && solution !== null) {
            result[pos] |= (1 << solution[pos]);
          }
        }
      }
    }
  }
  return result;
}

// Converts an unmarked bitmask to a bitmask representing all bits.

function unzero(bits) {
  if (bits == 0) return Sudoku.M;
  return bits;
}

// Wherever the work array is empty, fill in the full all-ones bitmask.

function fillzeroeswork(puzzle, answer, work) {
  var result = work.slice();
  var sofar = boardsofar(puzzle, answer);
  for (var j = 0; j < Sudoku.S; j++) {
    if (result[j] == 0 && sofar[j] === null) {
      result[j] = Sudoku.M;
    }
  }
  return result;
}

// Makes a new array of n zeros.

function zero_counts(n) {
  var counts = [];
  for (var j = 0; j < n; j++) {
    counts.push(0);
  }
  return counts;
}

// Find out why the given numbers cannot go at the given list of positions.
// board is an array representing the board.
// poslist is an array of positions (each to N^2) to explain.
// nums is a bitmask (up to 2^N-1) of the numbers that are excluded.
// Returns an array of positions which support the information.

function whyexclude(board, poslist, nums) {
  var support = [];
  var marked = Sudoku.emptyboard();
  for (var axis = 0; axis < 3; axis++) {
    for (var j = 0; j < poslist.length; j++) {
      var pos = poslist[j];
      var x = Sudoku.axisfor(pos, axis);
      for (var y = 0; y < Sudoku.N; y++) {
        var look = Sudoku.posfor(x, y, axis);
        if (board[look] === null) continue;
        if ((1 << board[look]) & nums) {
          support.push(look);
          if (marked[look] === null) marked[look] = [];
          marked[look].push(pos);
        }
      }
    }
  }
  support.sort(function(a, b) { return marked[b].length - marked[a].length; });
  // Now remove redundant support
  if (poslist.length == 1) {
    var covered = 0;
    var result = [];
    for (var j = 0; covered != nums && j < support.length; j++) {
      if (covered & (1 << board[support[j]])) continue;
      covered |= 1 << board[support[j]];
      result.push(support[j]);
    }
  } else if (Sudoku.listbits(nums).length == 1) {
    var covered = 0;
    var result = [];
    for (var j = 0; covered < poslist.length && j < support.length; j++) {
      for (var k = 0; k < marked[support[j]].length; k++) {
        var pos = marked[support[j]][k];
        if (marked[pos] === null) {
          marked[pos] = true;
          covered += 1;
          if (result.length == 0 || result[result.length - 1] != support[j]) {
            result.push(support[j]);
          }
        }
      }
    }
  } else {
    result = support;
  }
  return result;
}

// Look to find not-yet-noted conflicts that force an answer.

function singlenumdirect(board, fb, unz) {
  var hint = fb.allowed;
  var result = [];
  for (var pos = 0; pos < Sudoku.S; pos++) {
    if (board[pos] !== null) continue;
    var b = unz[pos];
    var forced = hint[pos] & b;
    if (Sudoku.listbits(forced).length != 1) continue;
    result.push({
      exclude: Sudoku.M ^ forced,
      reduced: [pos],
      hint: 'singlenumdirect',
      size: 1,
      support: whyexclude(board, [pos], b & ~forced)
    });
  }
  return result;
}

// Look in each block to find a number which needs to be placed, but which
// is directly excluded in each available square except one.

function singleposdirect(board, fb) {
  var result = [];
  for (var axis = 2; axis >= 0; axis--) {
    for (var x = 0; x < Sudoku.N; x++) {
      var numbers = Sudoku.listbits(fb.needed[axis * Sudoku.N + x]);
      for (var j = 0; j < numbers.length; j++) {
        var num = numbers[j];
        bit = 1 << num;
        var hint = null;
        var poslist = [];
        for (var y = 0; y < Sudoku.N; y++) {
          var pos = Sudoku.posfor(x, y, axis);
          if (fb.allowed[pos] & bit) {
            if (hint !== null) { hint = null; break; }
            hint = pos;
          } else if (board[pos] === null) {
            poslist.push(pos);
          }
        }
        if (hint !== null) {
          result.push({
            exclude: Sudoku.M ^ (1 << num),
            reduced: [hint],
            hint: 'singleposdirect',
            size: 1,
            support: whyexclude(board, poslist, 1 << num)
          });
        }
      }
    }
  }
  return result;
}

// Like singleposdirect, but takes into account work-in-progress marks
// as represented by unz.

function singlepos(board, fb, unz) {
  var result = [];
  // quick check for bits that are all OK
  var hint = fb.allowed;
  for (var j = 0; j < Sudoku.S; j++) {
    if (hint[j] & unz[j]) { hint = null; break; }
  }
  if (hint != null) { return result; }
  var singlepos = Sudoku.emptyboard();
  for (var axis = 2; axis >= 0; axis--) {
    for (var x = 0; x < Sudoku.N; x++) {
      for (var num = 0; num < Sudoku.N; num++) {
        var bit = (1 << num);
        var positions = [];
        var found = null;
        for (var y = 0; y < Sudoku.N; y++) {
          var pos = Sudoku.posfor(x, y, axis);
          if (unz[pos] & bit) {
            if (found != null) {
              found = null;
              break;
            }
            found = pos;
          }
        }
        if (found !== null && singlepos[found] !== null) {
          singlepos[found] = num;
          var support = [];
          for (var y = 0; y < Sudoku.N; y++) {
            var pos = Sudoku.posfor(x, y, axis);
            if (pos != found) {
              support.push(Sudoku.posfor(x, y, axis));
            }
          }
          result.push({
            exclude: Sudoku.M ^ (1 << singlepos[j]),
            reduced: [found],
            hint: 'singlepos',
            size: 1,
            support: support
          });
        }
      }
    }
  }
  return result;
}

// Look to find not-yet-noted conflicts that force an answer.

function singlenum(board, bits) {
  var result = [];
  for (var pos = 0; pos < Sudoku.S; pos++) {
    if (board[pos] === null) continue;
    var num = board[pos];
    var bit = 1 << num;
    var reduced = [];
    for (var axis = 0; axis < 3; axis++) {
      var x = Sudoku.axisfor(pos, axis);
      for (var y = 0; y < Sudoku.N; y++) {
        var pos2 = Sudoku.posfor(x, y, axis);
        if (board[pos2] === null && (bits[pos2] & bit)) {
          if (axis == 2 && (Sudoku.axisfor(pos, 0) == Sudoku.axisfor(pos2, 0) ||
              Sudoku.axisfor(pos, 1) == Sudoku.axisfor(pos2, 1))) { continue; }
          reduced.push(pos2);
        }
      }
    }
    if (reduced.length == 0) continue;
    result.push({
      exclude: bit,
      reduced: reduced,
      hint: 'singlenum',
      size: 1,
      support: [pos]
    });
  }
  return result;
}

// Given a board of known numbers and an array of bitmasks representing
// small guesses, fills in the bits representing what is known as well, and
// returns the resulting array.

function fullbits(board, bits) {
  var result = bits.slice();
  for (var j = 0; j < Sudoku.S; j++) {
    if (board[j] !== null) result[j] = (1 << board[j]);
  }
  return result;
}

// A claiming strategy, for example:
// http://sudoku.ironmonger.com/howto/claiming/docs.tpl

function claiming(board, unz, bits) {
  unz = fullbits(board, unz);
  var result = [];
  for (var axis = 0; axis < 2; axis++) {
    for (var x = 0; x < Sudoku.N; x++) {
      var blockbits = zero_counts(Sudoku.B)
      var solvedbits = 0;
      for (var y = 0; y < Sudoku.N; y++) {
        blockbits[(y - (y % Sudoku.B)) / Sudoku.B] |=
              unz[Sudoku.posfor(x, y, axis)];
        if (board[pos] !== null) solvedbits |= (1 << board[pos]);
      }
      for (var j = 0; j < Sudoku.B; j++) {
        var claimedbits = blockbits[j] & ~solvedbits;
        for (var k = 1; k < Sudoku.B; k++) {
          claimedbits &= ~blockbits[(j + k) % Sudoku.B]
        }
        if (claimedbits == 0) continue;
        var reduced = [];
        var reducedbits = 0;
        var block = Sudoku.axisfor(Sudoku.posfor(x, j * Sudoku.B, axis), 2);
        for (var z = 0; z < Sudoku.N; z++) {
          var pos = Sudoku.posfor(block, z, 2);
          if (Sudoku.axisfor(pos, axis) == x) continue;
          if (claimedbits & bits[pos]) {
            reducedbits |= (claimedbits & bits[pos]);
            reduced.push(pos);
          }
        }
        if (reducedbits == 0) continue;
        var intersection = [];
        for (var z = 0; z < Sudoku.N; z++) {
          var pos = Sudoku.posfor(block, z, 2);
          if (Sudoku.axisfor(pos, axis) != x) continue;
          if (bits[pos] & claimedbits) {
            intersection.push(pos);
          }
        }
        result.push({
          exclude: claimedbits,
          reduced: reduced,
          hint: 'claiming',
          size: 1,
          support: intersection 
        });
      }
    }
  }
  return result;
}

// Implements pointing strategies, e.g.,
// http://www.sudokuwiki.org/intersection_removal

function pointing(board, unz, bits) {
  unz = fullbits(board, unz);
  var result = [];
  for (var block = 0; block < Sudoku.N; block++) {
    for (var axis = 0; axis < 2; axis++) {
      for (var x = 0; x < Sudoku.B; x++) {
        var candbits = 0;
        var notbits = 0;
        for (var y = 0; y < Sudoku.B; y++) {
          candbits |= unz[Sudoku.posforblock(block, axis, x, y)];
          for (var k = 1; k < Sudoku.B; k++) {
            notbits |=
                  unz[Sudoku.posforblock(block, axis, (x + k) % Sudoku.B, y)];
          }
        }
        var candbits = candbits & ~notbits;
        if (candbits == 0) continue;
        var reduced = [];
        var reducedbits = 0;
        for (var y = Sudoku.B; y < Sudoku.N; y++) {
          var pos = Sudoku.posforblock(block, axis, x, y);
          if (bits[pos] & candbits) {
            reducedbits |= (bits[pos] & candbits);
            reduced.push(pos);
          }
        }
        if (reducedbits == 0) continue;
        var candidates = [];
        for (var y = 0; y < Sudoku.B; y++) {
          var pos = Sudoku.posforblock(block, axis, x, y);
          if (bits[pos] & reducedbits) {
            candidates.push(pos);
          }
        }
        result.push({
          exclude: reducedbits,
          reduced: reduced,
          hint: 'pointing',
          size: 1,
          support: candidates
        });
      }
    }
  }
  return result;
}

// A sorting function to prefer easier hints.

function hintsort(x, y) {
  // Seeing when only a single position is available is easiest
  if (x.hint == 'singleposdirect' && y.hint == 'singlenumdirect') {
    return 1;
  }
  // Seeing when only a single number is possible is next
  if (y.hint == 'singleposdirect' && x.hint == 'singlenumdirect') {
    return -1;
  }
  // favor more bits elminiated
  var xb = Sudoku.listbits(x.exclude);
  var yb = Sudoku.listbits(y.exclude);
  if (xb.length != yb.length) {
    return yb.length - xb.length;
  }
  // favor fewer support squares
  if (x.support.length != y.support.length) {
    return x.support.length - y.support.length;
  }
  // favor more squares reduced
  if (x.reduced.length != y.reduced.length) {
    return y.reduced.length - x.reduced.length;
  }
  // randomize ties
  var xs = '' + xb + x.support + ',' + x.reduced
  var ys = '' + yb + y.support + ',' + y.reduced
  if (xs < ys) return -1;
  if (ys < xs) return 1;
  return 0;
}

// Grades a puzzle according to the sequence of hints that would be
// need to solve it.

function hintgrade(puzzle) {
  var answer = Sudoku.emptyboard();
  work = [];
  var unsolved = 0;
  var level = 0;
  for (var j = 0; j < Sudoku.S; j++) {
    if (puzzle[j] === null) { work.push(Sudoku.M); unsolved += 1; }
    else work.push(0);
  }
  var steps = 0;
  while (unsolved) {
    var h = rawhints(puzzle, answer, work, true);
    if (h.hints.length == 0) {
      steps += Math.pow(2, (unsolved - 3) / 2);
      break;
    }
    var difficulty = (h.level - 1) * 4 + 1;
    dumphints(h);
    if (h.hints.length <= 1) { difficulty += 2; }
    steps += difficulty * ((unsolved + 12) / 48);
    for (var k = 0; k < h.hints.length; k++) {
      var hint = h.hints[k];
      var modified = false;
      for (var j = 0; j < hint.reduced.length; j++) {
        var pos = hint.reduced[j];
        if (work[pos] & hint.exclude) {
          modified = true;
          work[pos] = (work[pos] & ~hint.exclude);
        }
      }
    }
    var wasunsolved = unsolved;
    unsolved = 0;
    for (var j = 0; j < Sudoku.S; j++) {
      if (answer[j] !== null || puzzle[j] !== null) continue;
      var nums = Sudoku.listbits(work[j]);
      if (nums.length == 1) { answer[j] = nums[0]; work[j] = 0; }
      else { unsolved += 1; }
    }
    if (unsolved == wasunsolved && difficulty > 2) {
      steps += 1;
    }
  }
  return steps;
}

lib.hint = hint;
lib.conflicts = conflicts;
lib.mistakes = mistakes;
lib.hintgrade = hintgrade;

})(SudokuHint);

