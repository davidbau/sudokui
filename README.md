Sudokui
-------

A computer interface could never be as satisfying as the experience
of solving a good Sudoku on pencil and paper.

Or can it?

This project is the source code for a basic Sudoku UI.  You should
improve the interface, and then run an A/B test to see how users
react to your changes.

[Try it here.](https://rawgit.com/davidbau/sudokui/master/)

This app has a number of features that might be improved. For example...

- Filing a number needs two clicks: pick a number then a square.
- Holding the check button complains about mistakes without explanation.
- Mobile usage works, but it is not very pretty.
- Keystrokes do not do anything at all.
- There is a timer, but there are no other extrinsic motivators.
- You can bookmark and sequence through puzzles, but no other navigation.
- Small numbers can be written with a totally undiscoverable shift-key click.

Can you make it better? To measure your new version, you will need to
collect and analyze logs of user behavior.

Although the code works for traditional 9x9 boards (change Sudoku.init),
you should test your improved interface at 4x4 so that you can collect
more data in a limited amount of time.

This app includes some logging infrastructure for intercepting jQuery
events and sending data to a Google spreadsheet; you will need to
modify logging.js to log to your own spreadsheet.


MIT License
-----------

Portions copyright 2017 MIT,
portions copyright 2010 David Bau

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.

