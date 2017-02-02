// A sudoku puzzle-generation and solution backend.
//
// For use in MIT 6.831
// Use and modification permitted under the MIT Open Source License.
//
// Usage:
//
// A board has N^2 entries that are null or 0-(N-1):
//      board = [null, null, 0, null, 5, null, ... etc];
//
// Note that in zero-indexing simplifies the math in this implementation.
//      In the UI, the number represented by "0" in this data structure
//      will typically be rendered as "1"; and "1" will be "2" etc.
//
// Any board can be solved like this - null is returned if no solution:
//      solved = SudokuSolver.solution(board);
//
// Unique solutions can be detected:
//      if (!SudokuSolver.uniquesolution(board)) alert('not solvable');
//
// And random minimal puzzles can be generated:
//      puzzle = SudokuSolver.makepuzzle()

var Sudoku = {

init: (function(B) {

// Within this scope, 'lib' refers to the exported 'Sudoku' object,
// so "lib.B = B" makes B globally available as Sudoku.B.
var lib = this;

// Block size: classic Sudoku has B = 3 with a 9x9 board.
// (You can invoke Sudoku.init(2) to use 4x4 boards instead.)
if (!B) { B = 3; }
lib.B = B;

lib.N = B * B;            // Number of numbers
lib.S = lib.N * lib.N;    // Number of squares
lib.C = lib.N * B;        // Cube of B; number of squares in a strip of blocks
lib.M = (1 << lib.N) - 1; // Bitmask, with one bit per square

// Returns an array of 81 nulls.

function emptyboard() {
  var result = [];
  for (var pos = 0; pos < lib.S; pos++) {
    result.push(null);
  }
  return result;
}

// Given a 81-length array board with numbers 0-8 in some positions
// and null in other positions, returns an 81-length array containing
// a fully filled-in solution, or null if one doesn't exist.  The
// solution does not need to be unique.

function solution(board, limit) {
  if (typeof(limit) == 'undefined') limit = Infinity;
  return solvefast(board, limit).solution;
}

// Returns true if the given board is solvable.  The solution does not
// need to be unique.

function solvable(board, limit) {
  if (typeof(limit) == 'undefined') limit = Infinity;
  return solvefast(board, limit).solution !== null;
}

// Returns true if the given board is solvable and the solution is
// unique.

function uniquesolution(board) {
  var s = solvefast(board, Infinity);
  if (s.solution === null) return false;
  s = solvenext(s.track, Infinity);
  return (s.solution === null);
}

// Makes a minimal sudoku puzzle by generating a random solved board
// and then finding a subset of squares that uniquely determine a
// solution.

function makepuzzle(seed, quick, symmetric) {
  // Apply seed if supplied
  var oldrandom = null;
  if (seed && 'seedrandom' in Math) {
    oldrandom = Math.random;
    Math.seedrandom('sudoku-' + seed);
  }

  // Make a solved board
  var solved = solution(emptyboard());

  // Reveal a subsequence where later squares aren't immediately
  // deduced from earlier ones.  puzzle is a list of [position, value].
  var puzzle = [];
  var deduced = emptyboard();
  for (var k = (symmetric ? 2 : 1); k > 0; --k) {
    // Look at squares in shuffled order
    var order = unconstrained(deduced);
    for (var i = 0; i < order.length; ++i) {
      var pos = order[i];
      if (deduced[pos] === null && (k < 2 || deduced[lib.S - pos-1] === null)) {
        var hint = {pos: pos, num: solved[pos]};
        deduced[pos] = solved[pos];
        if (symmetric) {
          hint.sym = solved[lib.S - pos-1];
          deduced[lib.S - pos-1] = solved[lib.S - pos-1];
        }
        puzzle.push(hint);
        deduce(deduced);
      }
    }
  }

  // Shuffle the revealed squares
  // shuffle(puzzle);
  puzzle.reverse();

  // Restore native prng
  if (oldrandom !== null) {
    Math.random = oldrandom;
  }

  // Remove any revealed squares as long as a unique solution is
  // determined.  The process below is slow and could be skipped
  // if absolutely minimal puzzles are not required.
  if (!quick) {
    for (var i = puzzle.length - 1; i >= 0; i--) {
      var old = puzzle[i];
      puzzle.splice(i, 1);
      if (!uniquesolution(boardforentries(puzzle))) {
        puzzle.splice(i, 0, old);
      }
    }
  }

  // Convert the puzzle list to a 81-square board
  return boardforentries(puzzle);
}

// Solves a partially arbitrarily filled-in board quickly, or returns
// null if there is no solution.  Spends no more than "limit" steps,
// after which no return value is returned.  The parallel solution
// technique here is only needed when the input board is allowed to be
// unsolvable.  Most of the time, a board can be solved or proved to have
// no solution in less than 100 steps.  However, on certain unsolvable
// boards, it is possible for a depthfirst search to get stuck in an
// unlucky path that leads to an exponential explosion of backtracking
// that will never succeed.  Such paths do not have high probability,
// so after 100 steps we simply run "rabbits" in parallel to the main
// "turtle" to expore other paths that allow us to prove unsovability
// quickly in the cases where our turtle happens to be on an unlucky
// path.

function solvefast(original, limit) {
  var turtle = solveboard(original, 100);
  var steps = 100;
  var rabbitsteps = 60;
  while (steps < limit) {
    if (turtle.solution !== null || turtle.track.length == 0) return turtle;
    var rabbit = solveboard(original, rabbitsteps);
    if (rabbit.solution !== null || rabbit.track.length == 0) return rabbit;
    turtle = solvenext(turtle.track, rabbitsteps);
    steps += 2 * rabbitsteps;
    rabbitsteps += 10;
  }
}

// Spends the given (limit) number of iterations on searching for
// a solution to the input (original) board.  The return value is
// an object {track:[some array], solution:board} that represents
// the search state.  If solution is null, no solution has been
// found yet.  If the track additionally has length zero, all
// possible search paths have been exhausted for some ordering of
// the depthfirst search tree and the board has been proved to be
// unsolvable.

function solveboard(original, limit) {
  var board = original.slice();
  var guesses = deduce(board);
  if (guesses === null) return {track:[], solution:null};
  if (guesses.length == 0) return {track:[], solution:board};
  return solvenext([{guesses:guesses, c:0, board:board}], limit);
}

// Spends the given (limit) number of iterations continuing a
// search whose state (remembered) was returned by a previous
// solveboard or solvenext call.  The return value has the
// same form as solveboard.  Notice that depthfirst search
// ordering is randomized, so calling solvenext on the same
// initial search state may result in different paths being
// followed.

function solvenext(remembered, limit) {
  var steps = 0;
  while (remembered.length > 0 && steps < limit) {
    steps += 1;
    var r = remembered.pop();
    if (r.c >= r.guesses.length) continue;
    remembered.push({guesses:r.guesses, c:r.c+1, board:r.board});
    workspace = r.board.slice();
    workspace[r.guesses[r.c].pos] = r.guesses[r.c].num;
    newguesses = deduce(workspace);
    if (newguesses === null) continue;
    if (newguesses.length == 0) return {track:remembered, solution:workspace};
    remembered.push({guesses:newguesses, c:0, board:workspace});
  }
  return {track:remembered, solution:null};
}

// Given a partially-filled in board, continues filling in
// squares that are directly deduced by existing squares.
// When local deductions are no longer possible, returns an array
// of [{pos, val}, {pos, val}, ...] alternatives, or the empty array
// if the board is full and correct, or null if there are no legal
// moves and the board is not finished.

function deduce(board) {
  while (true) {
    var choices = bestchoices(board);
    if (choices === null) return null;
    if (choices.length == 0) return [];
    if (choices[0].length != 1) return choices[0];
    var done = 0;
    for (i = 0; i < choices.length; i++) {
      var num = choices[i][0].num;
      var bit = 1 << num;
      if (!(done & bit)) {
        done |= bit;
        board[choices[i][0].pos] = num;
      }
    }
  }
}

// Given an input 81-number-or-null array (board), returns an array
// of positions, ordered from least-constrained to most-constrained,
// with positions at the same level of constraint shuffled.

function unconstrained(board) {
  var bits = figurebits(board);
  var results = [];
  for (var freedom = 0; freedom < lib.N + 1; freedom++) {
    results.push([]);
  }
  for (var pos = 0; pos < lib.S; pos++) {
    if (board[pos] === null) {
      results[listbits(bits.allowed[pos]).length].push(pos);
    }
  }
  var result = [];
  for (freedom = results.length - 1; freedom >= 0; --freedom) {
    shuffle(results[freedom]);
    result.push.apply(result, results[freedom]);
  }
  return result;
}

// Given an input 81-number-or-null array (board), returns a nested
// array of possible moves that could be filled in without contradicting
// the local rules of sudoku (although the possible moves might contradict
// the global state of the board).  The output is of the form:
//
//     bestchoices = [ choice, choice, choice ]
//
// where each choice is a list of alternative moves
//
//     choice = [{pos, val}, {pos, val}, {pos, val}]
//
// Within each choice, we have a list of {pos, val} moves which are all
// locally legal but which contradict each other.  A depthfirst searcher
// would have to choose one but not the others.
//
// The function applies local sudoku rules to find the maximally
// constrained squares, and then returns a list of choices
// with the same minimized branching factor.  So each choice array
// has the same length as every other, and they are all the minimum
// length arrays that are found.
//
// The returned choices in the bestchoices array are shuffled, and the
// alternatives within the first choice, if any, are shuffled.
//
// If no moves exist that fit with the local rules of sudoku, an empty
// array is returned.

function bestchoices(board) {
  var result = [];
  var bits = figurebits(board);
  var emptycount = 0;
  for (var pos = 0; pos < lib.S; pos++) {
    if (board[pos] === null) {
      emptycount += 1;
      var numbers = listbits(bits.allowed[pos]);
      if (result.length && numbers.length > result[0].length) continue;
      var choices = [];
      for (var i = 0; i < numbers.length; i++) {
        choices.push({pos: pos, num: numbers[i]});
      }
      updatechoices(result, choices);
    }
  }
  if (emptycount == 0) return [];
  for (var axis = 0; axis < 3; axis++) {
    for (var x = 0; x < lib.N; x++) {
      var numbers = listbits(bits.needed[axis * lib.N + x]);
      for (var j = 0; j < numbers.length; j++) {
        bit = 1 << numbers[j];
        var choices = [];
        for (var y = 0; y < lib.N; y++) {
          var pos = posfor(x, y, axis);
          if (bits.allowed[pos] & bit) {
            choices.push({pos: pos, num: numbers[j]});
          }
        }
        updatechoices(result, choices);
      }
    }
  }
  if (result.length == 0 || result[0].length == 0) return null;
  shuffle(result);
  shuffle(result[0]);
  return result;
}

// Given an input (board) returns an object of the form
//
//     {allowed: [81 nums 0-511], needed:[27 nums 0-511]}
//
// where, in the allowed array, each bit represents a number 1<<n that
// would be allowed to be placed in the given square, and in the needed
// array, each bit represents a number 1<<n that is not present in a
// particular row, column, or block.

function figurebits(board) {
  var needed = [];
  var allowed = [];
  for (var i = 0; i < board.length; i++)  {
    allowed.push(board[i] === null ? lib.M : 0);
  }
  for (var axis = 0; axis < 3; axis++) {
    for (var x = 0; x < lib.N; x++) {
      var bits = axismissing(board, x, axis);
      needed.push(bits);
      for (var y = 0; y < lib.N; y++) {
        allowed[posfor(x, y, axis)] &= bits
      }
    }
  }
  return {allowed:allowed, needed:needed};
}

// Precomputes two arrays: first, an array of all the upper-left corners
// of all the N BxB blocks of the sudoku board, and second, an array of
// all the N locations within the 0th block (suitable for shifting to
// locate locations within any block).

function blockpositions(B) {
  var posx = 0;
  var posy = 0;
  var Px = [];
  var Py = [];
  for (var x = 0; x < B; ++x) {
    for (var y = 0; y < B; ++y) {
      Px.push(posx);
      Py.push(posy);
      posx += B;
      posy += 1;
    }
    posx += (B * B * B) - (B * B)
    posy += (B * B) - B
  }
  return [Px, Py];
}

lib.P = blockpositions(B); // used in posfor

// Returns the board position of the given 0-8 (x) and 0-8 (y) when the
// ordering is col-row (axis=0), row-col (axis=1) or block-order (axis=2)

function posfor(x, y, axis) {
  if (axis == 0) return x * lib.N + y;
  if (axis == 1) return y * lib.N + x;
  return lib.P[0][x] + lib.P[1][y];
}

// Returns the column (axis=0), row (axis=1), or block (axis=2) of the
// given position (pos).

function axisfor(pos, axis) {
  if (axis == 0) return (pos - pos % lib.N) / lib.N;
  if (axis == 1) return pos % lib.N;
  return ((pos - pos % lib.C) / lib.C) * lib.B +
         ((pos - pos % lib.B) / lib.B) % lib.B;
}

// Given a block (0-8) and an orientation, returns the position within
// the block for x, y from 0-2, or in other blocks along the same row
// or column for x, y in the range 3-8.
function posforblock(block, axis, x, y) {
  var c = lib.B * (block % lib.B);
  var r = (block - block % lib.B);
  if (axis == 0) { c += x; r += y; }
  else { c += y; r += x; }
  c = c % lib.N;
  r = r % lib.N;
  return r * lib.N + c;
}

// Returns a bitfield (0-511) representing the numbers that are missing
// in the specified (x) column (axis=0), row (axis=1), or block (axis=2).

function axismissing(board, x, axis) {
  var bits = 0
  for (var y = 0; y < lib.N; y++) {
    var e = board[posfor(x, y, axis)];
    if (e !== null) bits |= 1 << e;
  }
  return lib.M ^ bits;
}

// Converts a bitfield (0-511) into an array of integers (0-8), one
// for each bit that was set to "1".

function listbits(bits) {
  var result = [];
  for (var y = 0; y < lib.N; y++) {
    if (0 != (bits & (1 << y))) result.push(y);
  }
  return result;
}

// Helper for the bestchoices() implementation: if the given choice array
// (choices) is better-constrained than the passed result array (result),
// then any existing results are cleared and the choice is added.  If the
// given choices are same-constrained, then the choice is just added on.
// If the given choices are looser-constrained, then they are just
// discarded.

function updatechoices(result, choices) {
  if (result.length) {
    if (choices.length > result[0].length) return;
    if (choices.length < result[0].length) result.length = 0;
  }
  result.push(choices);
}

// Converts a list of {pos, val} moves into a populated 81-square board
// of numbers (0-8) and nulls where there is no move.

function boardforentries(entries) {
  var result = emptyboard();
  for (var i = 0; i < entries.length; i++) {
    result[entries[i].pos] = entries[i].num;
    if (entries[i].sym != null) {
      result[lib.S - entries[i].pos-1] = entries[i].sym;
    }

  }
  return result;
}

// Shuffles the given array in-place using fisher-yates.

function shuffle(o) {
  for (var j, x, i = o.length; i;
       j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
}

// Used by interface.js
lib.emptyboard = emptyboard;
lib.solution = solution;
lib.solvable = solvable;
lib.uniquesolution = uniquesolution;
lib.makepuzzle = makepuzzle;

// Utilities used by hintmaker.js
lib.posfor = posfor;
lib.posforblock = posforblock;
lib.axisfor = axisfor;
lib.figurebits = figurebits;
lib.listbits = listbits;

})
};

Sudoku.init();
